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
    it('should generate upload credentials with valid parameters', async () => {
      const url = `http://localhost:3000/api/upload-url?filename=${TEST_FILE.filename}&mimeType=${TEST_FILE.mimeType}&size=${TEST_FILE.size}`;
      const req = new NextRequest(url);

      const response = await getUploadUrl(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('assetId');
      expect(data).toHaveProperty('pathname');
      expect(data).toHaveProperty('token', 'test-blob-token');
      expect(data).toHaveProperty('expiresAt');

      // Verify expiry is ~5 minutes in future
      const expiresAt = data.expiresAt;
      const now = Date.now();
      expect(expiresAt).toBeGreaterThan(now);
      expect(expiresAt).toBeLessThan(now + 6 * 60 * 1000); // < 6 minutes
    });

    it('should include rate limit headers', async () => {
      const url = `http://localhost:3000/api/upload-url?filename=${TEST_FILE.filename}&mimeType=${TEST_FILE.mimeType}&size=${TEST_FILE.size}`;
      const req = new NextRequest(url);

      const response = await getUploadUrl(req);

      expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('99');
      expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
    });

    it('should reject missing required parameters', async () => {
      const url = 'http://localhost:3000/api/upload-url?filename=test.jpg';
      const req = new NextRequest(url);

      const response = await getUploadUrl(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Missing required parameters');
    });

    it('should reject invalid file types', async () => {
      const url = `http://localhost:3000/api/upload-url?filename=test.pdf&mimeType=application/pdf&size=1000`;
      const req = new NextRequest(url);

      const response = await getUploadUrl(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid file type');
      expect(data.errorType).toBe('invalid_type');
    });

    it('should reject files exceeding size limit', async () => {
      const url = `http://localhost:3000/api/upload-url?filename=test.jpg&mimeType=image/jpeg&size=11000000`; // 11MB
      const req = new NextRequest(url);

      const response = await getUploadUrl(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('File size must be between');
      expect(data.errorType).toBe('file_too_large');
    });

    it('should enforce rate limiting', async () => {
      const { uploadRateLimiter } = await import('@/lib/rate-limiter');
      vi.mocked(uploadRateLimiter.consume).mockResolvedValueOnce({
        allowed: false,
        retryAfter: 30,
        remaining: 0,
      });

      const url = `http://localhost:3000/api/upload-url?filename=${TEST_FILE.filename}&mimeType=${TEST_FILE.mimeType}&size=${TEST_FILE.size}`;
      const req = new NextRequest(url);

      const response = await getUploadUrl(req);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toContain('Too many uploads');
      expect(data.retryAfter).toBe(30);
      expect(data.errorType).toBe('rate_limited');
      expect(response.headers.get('Retry-After')).toBe('30');
    });

    it('should generate unique pathnames for same filename', async () => {
      const url = `http://localhost:3000/api/upload-url?filename=${TEST_FILE.filename}&mimeType=${TEST_FILE.mimeType}&size=${TEST_FILE.size}`;

      const req1 = new NextRequest(url);
      const req2 = new NextRequest(url);

      const response1 = await getUploadUrl(req1);
      const response2 = await getUploadUrl(req2);

      const data1 = await response1.json();
      const data2 = await response2.json();

      expect(data1.pathname).not.toBe(data2.pathname);
      expect(data1.assetId).not.toBe(data2.assetId);
    });
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

      // Step 1: Get upload credentials
      const uploadUrlReq = new NextRequest(
        `http://localhost:3000/api/upload-url?filename=${TEST_FILE.filename}&mimeType=${TEST_FILE.mimeType}&size=${TEST_FILE.size}`
      );
      const uploadUrlResponse = await getUploadUrl(uploadUrlReq);
      const credentials = await uploadUrlResponse.json();

      expect(uploadUrlResponse.status).toBe(200);
      expect(credentials).toHaveProperty('assetId');
      expect(credentials).toHaveProperty('pathname');
      expect(credentials).toHaveProperty('token');

      // Step 2: Client uploads to Blob (mocked - would be done by @vercel/blob SDK)
      const blobUrl = `https://blob.vercel-storage.com/${credentials.pathname}`;

      // Step 3: Finalize upload
      const mockAsset = {
        id: 'asset-final-123',
        ownerUserId: TEST_USER,
        blobUrl,
        pathname: credentials.pathname,
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
          assetId: credentials.assetId,
          blobUrl,
          pathname: credentials.pathname,
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
        blobUrl: 'https://blob.vercel-storage.com/original.jpg',
        pathname: 'original.jpg',
        mime: 'image/jpeg',
        size: 1048576,
        checksumSha256: TEST_FILE.checksum,
        createdAt: new Date(),
        hasEmbedding: false,
      };

      vi.mocked(assetExists).mockResolvedValueOnce(existingAsset as any);

      // Step 1: Get credentials (succeeds)
      const uploadUrlReq = new NextRequest(
        `http://localhost:3000/api/upload-url?filename=${TEST_FILE.filename}&mimeType=${TEST_FILE.mimeType}&size=${TEST_FILE.size}`
      );
      const uploadUrlResponse = await getUploadUrl(uploadUrlReq);
      const credentials = await uploadUrlResponse.json();

      // Step 3: Finalize (detects duplicate)
      const blobUrl = `https://blob.vercel-storage.com/${credentials.pathname}`;
      const completeReq = new NextRequest('http://localhost:3000/api/upload-complete', {
        method: 'POST',
        body: JSON.stringify({
          assetId: credentials.assetId,
          blobUrl,
          pathname: credentials.pathname,
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
