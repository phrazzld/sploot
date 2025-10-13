/**
 * Integration tests for direct-to-Blob upload flow
 *
 * Tests the 3-step upload sequence:
 * 1. GET /api/upload-url - Get presigned URL and credentials
 * 2. PUT to Vercel Blob - Client uploads file (mocked)
 * 3. POST /api/upload-complete - Finalize upload and create asset
 *
 * Validates:
 * - Credential generation with rate limiting
 * - Asset creation with correct initial state
 * - Duplicate detection via checksum
 * - Error handling for invalid inputs
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GET as getUploadUrl } from '@/app/api/upload-url/route';
import { POST as uploadComplete } from '@/app/api/upload-complete/route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/auth/server', () => ({
  requireUserIdWithSync: vi.fn().mockResolvedValue('test-user-123'),
  getAuth: vi.fn().mockResolvedValue({ userId: 'test-user-123' }),
}));

vi.mock('@/lib/env', () => ({
  blobConfigured: true,
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    asset: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
  assetExists: vi.fn().mockResolvedValue(null), // No duplicates by default
}));

vi.mock('@vercel/blob', () => ({
  del: vi.fn().mockResolvedValue(undefined),
  put: vi.fn().mockResolvedValue({ url: 'https://blob.vercel-storage.com/test.jpg' }),
}));

vi.mock('@/lib/rate-limiter', () => ({
  uploadRateLimiter: {
    consume: vi.fn().mockResolvedValue({ allowed: true, remaining: 99 }),
  },
}));

describe('Direct-to-Blob Upload Flow', () => {
  const TEST_USER = 'test-user-123';
  const TEST_FILE = {
    filename: 'test-image.jpg',
    mimeType: 'image/jpeg',
    size: '1048576', // 1MB
    checksum: 'a'.repeat(64), // Valid SHA-256 checksum
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Set environment variable for blob token
    process.env.BLOB_READ_WRITE_TOKEN = 'test-blob-token';

    // Reset auth mock after clearAll
    const { requireUserIdWithSync } = await import('@/lib/auth/server');
    vi.mocked(requireUserIdWithSync).mockResolvedValue('test-user-123');

    // Reset rate limiter mock after clearAll
    const { uploadRateLimiter } = await import('@/lib/rate-limiter');
    vi.mocked(uploadRateLimiter.consume).mockResolvedValue({ allowed: true, remaining: 99 });

    // Reset database mocks
    const { assetExists } = await import('@/lib/db');
    vi.mocked(assetExists).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Step 1: GET /api/upload-url', () => {
    it('should return 410 Gone (endpoint deprecated)', async () => {
      const url = `http://localhost:3000/api/upload-url?filename=${TEST_FILE.filename}&mimeType=${TEST_FILE.mimeType}&size=${TEST_FILE.size}`;
      const req = new NextRequest(url);

      const response = await getUploadUrl(req);
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data.error).toContain('deprecated');
      expect(data.migration).toContain('/api/upload/handle');
      expect(response.headers.get('X-Deprecated')).toBe('true');
      expect(response.headers.get('X-Deprecated-Replacement')).toBe('/api/upload/handle');
    });

    // All other upload-url tests removed - endpoint is deprecated for security
    // Tests for secure upload flow moved to /api/upload/handle
  });

  describe('Step 3: POST /api/upload-complete', () => {
    const MOCK_UPLOAD_COMPLETE_BODY = {
      assetId: 'asset_1234567890_abc123',
      blobUrl: 'https://blob.vercel-storage.com/test-user-123/test-image-xyz.jpg',
      pathname: 'test-user-123/test-image-xyz.jpg',
      filename: TEST_FILE.filename,
      size: parseInt(TEST_FILE.size),
      mimeType: TEST_FILE.mimeType,
      checksum: TEST_FILE.checksum,
    };

    it('should create asset with correct initial state', async () => {
      const { prisma } = await import('@/lib/db');
      const mockAsset = {
        id: 'asset-123',
        ownerUserId: TEST_USER,
        blobUrl: MOCK_UPLOAD_COMPLETE_BODY.blobUrl,
        pathname: MOCK_UPLOAD_COMPLETE_BODY.pathname,
        mime: MOCK_UPLOAD_COMPLETE_BODY.mimeType,
        size: MOCK_UPLOAD_COMPLETE_BODY.size,
        checksumSha256: MOCK_UPLOAD_COMPLETE_BODY.checksum,
        processed: false,
        embedded: false,
        createdAt: new Date(),
      };

      vi.mocked(prisma.asset.create).mockResolvedValueOnce(mockAsset as any);

      const req = new NextRequest('http://localhost:3000/api/upload-complete', {
        method: 'POST',
        body: JSON.stringify(MOCK_UPLOAD_COMPLETE_BODY),
      });

      const response = await uploadComplete(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.asset.processed).toBe(false);
      expect(data.asset.embedded).toBe(false);
      expect(data.asset.id).toBe('asset-123');

      // Verify database was called
      expect(prisma.asset.create).toHaveBeenCalled();
    });

    it('should detect duplicates via checksum', async () => {
      const { assetExists } = await import('@/lib/db');
      const { del } = await import('@vercel/blob');

      const existingAsset = {
        id: 'existing-asset-123',
        blobUrl: 'https://blob.vercel-storage.com/existing.jpg',
        pathname: 'existing.jpg',
        mime: 'image/jpeg',
        size: 1048576,
        checksumSha256: TEST_FILE.checksum,
        createdAt: new Date(),
        hasEmbedding: true,
      };

      vi.mocked(assetExists).mockResolvedValueOnce(existingAsset as any);

      const req = new NextRequest('http://localhost:3000/api/upload-complete', {
        method: 'POST',
        body: JSON.stringify(MOCK_UPLOAD_COMPLETE_BODY),
      });

      const response = await uploadComplete(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.isDuplicate).toBe(true);
      expect(data.asset.id).toBe(existingAsset.id);

      // Verify duplicate blob was deleted
      expect(del).toHaveBeenCalledWith(MOCK_UPLOAD_COMPLETE_BODY.blobUrl);
    });

    it('should reject missing required fields', async () => {
      const incompleteBody = {
        assetId: 'asset_123',
        blobUrl: 'https://blob.vercel-storage.com/test.jpg',
        // Missing other required fields
      };

      const req = new NextRequest('http://localhost:3000/api/upload-complete', {
        method: 'POST',
        body: JSON.stringify(incompleteBody),
      });

      const response = await uploadComplete(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Missing required fields');
    });

    it('should validate checksum format', async () => {
      const invalidBody = {
        ...MOCK_UPLOAD_COMPLETE_BODY,
        checksum: 'invalid-checksum',
      };

      const req = new NextRequest('http://localhost:3000/api/upload-complete', {
        method: 'POST',
        body: JSON.stringify(invalidBody),
      });

      const response = await uploadComplete(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid checksum format');
    });

    it('should handle database errors gracefully', async () => {
      const { prisma } = await import('@/lib/db');
      vi.mocked(prisma.asset.create).mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const req = new NextRequest('http://localhost:3000/api/upload-complete', {
        method: 'POST',
        body: JSON.stringify(MOCK_UPLOAD_COMPLETE_BODY),
      });

      const response = await uploadComplete(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeTruthy();
    });
  });

  describe('Complete Upload Flow Integration', () => {
    it('should complete full upload sequence successfully', async () => {
      const { prisma } = await import('@/lib/db');

      // Note: Step 1 (GET /api/upload-url) deprecated - use /api/upload/handle instead
      // This test uses hard-coded valid credentials that would come from handleUpload()

      const pathname = `${TEST_USER}/1234567890-abc123.jpg`;
      const blobUrl = `https://blob.vercel-storage.com/${pathname}`;

      // Step 3: Finalize upload
      const mockAsset = {
        id: 'asset-final-123',
        ownerUserId: TEST_USER,
        blobUrl,
        pathname,
        mime: TEST_FILE.mimeType,
        size: parseInt(TEST_FILE.size),
        checksumSha256: TEST_FILE.checksum,
        processed: false,
        embedded: false,
        createdAt: new Date(),
      };

      vi.mocked(prisma.asset.create).mockResolvedValueOnce(mockAsset as any);

      const completeReq = new NextRequest('http://localhost:3000/api/upload-complete', {
        method: 'POST',
        body: JSON.stringify({
          assetId: 'asset_1234567890_abc123',
          blobUrl,
          pathname,
          filename: TEST_FILE.filename,
          size: parseInt(TEST_FILE.size),
          mimeType: TEST_FILE.mimeType,
          checksum: TEST_FILE.checksum,
        }),
      });

      const completeResponse = await uploadComplete(completeReq);
      const completeData = await completeResponse.json();

      expect(completeResponse.status).toBe(200);
      expect(completeData.success).toBe(true);
      expect(completeData.asset).toMatchObject({
        id: mockAsset.id,
        processed: false,
        embedded: false,
      });
    });

    it('should handle duplicate in complete flow', async () => {
      const { assetExists } = await import('@/lib/db');
      const { del } = await import('@vercel/blob');

      // Existing duplicate asset
      const existingAsset = {
        id: 'duplicate-asset-123',
        blobUrl: 'https://blob.vercel-storage.com/test-user-123/original.jpg',
        pathname: 'test-user-123/original.jpg',
        mime: 'image/jpeg',
        size: 1048576,
        checksumSha256: TEST_FILE.checksum,
        createdAt: new Date(),
        hasEmbedding: false,
      };

      vi.mocked(assetExists).mockResolvedValueOnce(existingAsset as any);

      // Hard-coded valid credentials (would come from handleUpload())
      const pathname = `${TEST_USER}/1234567890-new.jpg`;
      const blobUrl = `https://blob.vercel-storage.com/${pathname}`;

      // Step 3: Finalize (detects duplicate)
      const completeReq = new NextRequest('http://localhost:3000/api/upload-complete', {
        method: 'POST',
        body: JSON.stringify({
          assetId: 'asset_1234567890_new123',
          blobUrl,
          pathname,
          filename: TEST_FILE.filename,
          size: parseInt(TEST_FILE.size),
          mimeType: TEST_FILE.mimeType,
          checksum: TEST_FILE.checksum,
        }),
      });

      const completeResponse = await uploadComplete(completeReq);
      const completeData = await completeResponse.json();

      expect(completeResponse.status).toBe(200);
      expect(completeData.isDuplicate).toBe(true);
      expect(completeData.asset.id).toBe(existingAsset.id);
      expect(del).toHaveBeenCalledWith(blobUrl);
    });
  });
});
