import { POST as uploadUrlPOST } from '@/app/api/upload-url/route';
import { POST as assetsPOST } from '@/app/api/assets/route';
import { POST as generateEmbeddingPOST } from '@/app/api/assets/[id]/generate-embedding/route';
import { GET as embeddingStatusGET } from '@/app/api/assets/[id]/embedding-status/route';
import { createMockRequest, mockPrisma, mockEmbeddingService, mockMultiLayerCache } from '../utils/test-helpers';
import { put, del } from '@vercel/blob';

// Mock dependencies
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/db', () => {
  const helpers = require('../utils/test-helpers');
  return {
    prisma: helpers.mockPrisma(),
    vectorSearch: jest.fn(),
    logSearch: jest.fn(),
  };
});

jest.mock('@vercel/blob', () => ({
  put: jest.fn(),
  del: jest.fn(),
}));

jest.mock('@/lib/embeddings', () => ({
  createEmbeddingService: jest.fn(),
  EmbeddingError: class EmbeddingError extends Error {
    constructor(message: string, public statusCode?: number) {
      super(message);
    }
  },
}));

jest.mock('@/lib/multi-layer-cache', () => ({
  createMultiLayerCache: jest.fn(),
  getMultiLayerCache: jest.fn(),
}));

const mockAuth = require('@clerk/nextjs/server').auth;
const mockPut = put as jest.MockedFunction<typeof put>;
const mockDel = del as jest.MockedFunction<typeof del>;
const { createEmbeddingService } = require('@/lib/embeddings');
const { createMultiLayerCache, getMultiLayerCache } = require('@/lib/multi-layer-cache');
const { prisma } = require('@/lib/db');

describe('Upload Flow Integration Tests', () => {
  const testUserId = 'test-user-id';
  const testImageFile = {
    filename: 'test-meme.jpg',
    mimeType: 'image/jpeg',
    size: 1024000, // 1MB
    checksum: 'sha256-test-checksum',
    width: 1920,
    height: 1080,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockAuth.mockResolvedValue({ userId: testUserId });
    createEmbeddingService.mockReturnValue(mockEmbeddingService());
    const mockCache = mockMultiLayerCache();
    createMultiLayerCache.mockReturnValue(mockCache);
    getMultiLayerCache.mockReturnValue(mockCache);
  });

  describe('Complete Upload Flow', () => {
    it('should successfully complete end-to-end upload flow', async () => {
      // Step 1: Generate upload URL
      const uploadUrlRequest = createMockRequest('POST', {
        filename: testImageFile.filename,
        mimeType: testImageFile.mimeType,
        size: testImageFile.size,
      });

      mockPut.mockResolvedValue({
        url: 'https://example.blob.vercel-storage.com/test-meme-123.jpg',
        downloadUrl: 'https://example.blob.vercel-storage.com/test-meme-123.jpg',
        pathname: 'test-meme-123.jpg',
        contentType: testImageFile.mimeType,
        contentDisposition: 'inline',
      });

      const uploadUrlResponse = await uploadUrlPOST(uploadUrlRequest);
      const uploadData = await uploadUrlResponse.json();

      expect(uploadUrlResponse.status).toBe(200);
      expect(uploadData.uploadUrl).toBeDefined();
      expect(uploadData.pathname).toBeDefined();

      // Step 2: Create asset record
      const createAssetRequest = createMockRequest('POST', {
        blobUrl: uploadData.uploadUrl || 'https://example.blob.vercel-storage.com/test-meme-123.jpg',
        pathname: uploadData.pathname,
        filename: testImageFile.filename,
        mimeType: testImageFile.mimeType,
        size: testImageFile.size,
        checksum: testImageFile.checksum,
        width: testImageFile.width,
        height: testImageFile.height,
      });

      const mockAsset = {
        id: 'asset-123',
        ownerUserId: testUserId,
        blobUrl: uploadData.url,
        pathname: uploadData.pathname,
        filename: testImageFile.filename,
        mime: testImageFile.mimeType,
        size: testImageFile.size,
        checksumSha256: testImageFile.checksum,
        width: testImageFile.width,
        height: testImageFile.height,
        favorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        phash: null,
      };

      prisma.asset.findFirst.mockResolvedValue(null); // No duplicate
      prisma.asset.create.mockResolvedValue(mockAsset);

      const assetResponse = await assetsPOST(createAssetRequest);
      const assetData = await assetResponse.json();

      expect(assetResponse.status).toBe(200);
      expect(assetData.message).toBe('Asset created successfully');
      expect(assetData.asset.id).toBe('asset-123');

      // Verify cache invalidation was called
      const mockCache = getMultiLayerCache();
      expect(mockCache.invalidateUserData).toHaveBeenCalledWith(testUserId);

      // Step 3: Verify embedding generation can be triggered
      const mockEmbedding = Array(1152).fill(0.1);
      const embeddingService = mockEmbeddingService();
      embeddingService.embedImage.mockResolvedValue({
        embedding: mockEmbedding,
        model: 'siglip-large',
        dimension: 1152,
        processingTime: 150,
      });

      prisma.asset.findUnique.mockResolvedValue(mockAsset);
      prisma.assetEmbedding.upsert.mockResolvedValue({
        id: 'embedding-123',
        assetId: 'asset-123',
        imageEmbedding: mockEmbedding,
        createdAt: new Date(),
      });

      const generateEmbeddingRequest = createMockRequest('POST');
      const embeddingResponse = await generateEmbeddingPOST(
        generateEmbeddingRequest,
        { params: { id: 'asset-123' } }
      );

      expect(embeddingResponse.status).toBe(200);
      const embeddingData = await embeddingResponse.json();
      expect(embeddingData.message).toContain('started');
    });

    it('should handle duplicate asset detection', async () => {
      const existingAsset = {
        id: 'existing-asset',
        ownerUserId: testUserId,
        blobUrl: 'https://example.blob.vercel-storage.com/existing.jpg',
        pathname: 'existing.jpg',
        filename: 'existing.jpg',
        mime: testImageFile.mimeType,
        size: testImageFile.size,
        checksumSha256: testImageFile.checksum,
        width: testImageFile.width,
        height: testImageFile.height,
        favorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        phash: null,
      };

      prisma.asset.findFirst.mockResolvedValue(existingAsset);

      const request = createMockRequest('POST', {
        blobUrl: 'https://example.blob.vercel-storage.com/new.jpg',
        pathname: 'new.jpg',
        filename: 'new.jpg',
        mimeType: testImageFile.mimeType,
        size: testImageFile.size,
        checksum: testImageFile.checksum,
        width: testImageFile.width,
        height: testImageFile.height,
      });

      const response = await assetsPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.duplicate).toBe(true);
      expect(data.message).toBe('Asset already exists');
      expect(data.asset.id).toBe('existing-asset');

      // Verify no new asset was created
      expect(prisma.asset.create).not.toHaveBeenCalled();
    });

    it('should handle upload with embedding service failure gracefully', async () => {
      // Asset creation should succeed even if embedding fails
      prisma.asset.findFirst.mockResolvedValue(null);
      prisma.asset.create.mockResolvedValue({
        id: 'asset-456',
        ownerUserId: testUserId,
        blobUrl: 'https://example.blob.vercel-storage.com/test.jpg',
        pathname: 'test.jpg',
        filename: 'test.jpg',
        mime: testImageFile.mimeType,
        size: testImageFile.size,
        checksumSha256: testImageFile.checksum,
        width: testImageFile.width,
        height: testImageFile.height,
        favorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        phash: null,
      });

      const request = createMockRequest('POST', {
        blobUrl: 'https://example.blob.vercel-storage.com/test.jpg',
        pathname: 'test.jpg',
        filename: 'test.jpg',
        mimeType: testImageFile.mimeType,
        size: testImageFile.size,
        checksum: testImageFile.checksum,
        width: testImageFile.width,
        height: testImageFile.height,
      });

      // Simulate embedding service failure
      const embeddingService = mockEmbeddingService();
      embeddingService.embedImage.mockRejectedValue(new Error('Embedding service unavailable'));
      createEmbeddingService.mockReturnValue(embeddingService);

      const response = await assetsPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Asset created successfully');
      expect(data.asset.id).toBe('asset-456');
      // Asset should be created successfully despite embedding failure
    });

    it('should handle concurrent uploads correctly', async () => {
      const uploads = [
        {
          filename: 'meme1.jpg',
          checksum: 'checksum1',
        },
        {
          filename: 'meme2.jpg',
          checksum: 'checksum2',
        },
        {
          filename: 'meme3.jpg',
          checksum: 'checksum3',
        },
      ];

      prisma.asset.findFirst.mockResolvedValue(null);
      prisma.asset.create.mockImplementation((data) =>
        Promise.resolve({
          id: `asset-${data.data.filename}`,
          ...data.data,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          phash: null,
        })
      );

      const uploadPromises = uploads.map(async (upload) => {
        const request = createMockRequest('POST', {
          blobUrl: `https://example.blob.vercel-storage.com/${upload.filename}`,
          pathname: upload.filename,
          filename: upload.filename,
          mimeType: testImageFile.mimeType,
          size: testImageFile.size,
          checksum: upload.checksum,
          width: testImageFile.width,
          height: testImageFile.height,
        });

        return assetsPOST(request);
      });

      const responses = await Promise.all(uploadPromises);
      const results = await Promise.all(responses.map(r => r.json()));

      expect(responses).toHaveLength(3);
      expect(responses.every(r => r.status === 200)).toBe(true);
      expect(results.every(r => r.message === 'Asset created successfully')).toBe(true);
      expect(prisma.asset.create).toHaveBeenCalledTimes(3);
    });

    it('should validate file type restrictions', async () => {
      const invalidFiles = [
        { filename: 'document.pdf', mimeType: 'application/pdf' },
        { filename: 'video.mp4', mimeType: 'video/mp4' },
        { filename: 'script.js', mimeType: 'text/javascript' },
      ];

      for (const file of invalidFiles) {
        const request = createMockRequest('POST', {
          filename: file.filename,
          mimeType: file.mimeType,
          size: 1000,
        });

        const response = await uploadUrlPOST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('Invalid file type');
      }
    });

    it('should enforce file size limits', async () => {
      const oversizedRequest = createMockRequest('POST', {
        filename: 'huge.jpg',
        mimeType: 'image/jpeg',
        size: 11 * 1024 * 1024, // 11MB (over 10MB limit)
      });

      const response = await uploadUrlPOST(oversizedRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('File size must be between');
    });

    it('should handle blob storage failures with rollback', async () => {
      mockPut.mockRejectedValue(new Error('Blob storage unavailable'));

      const request = createMockRequest('POST', {
        filename: testImageFile.filename,
        mimeType: testImageFile.mimeType,
        size: testImageFile.size,
      });

      const response = await uploadUrlPOST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to generate upload URL');
    });

    it('should check embedding status correctly', async () => {
      prisma.asset.findUnique.mockResolvedValue({
        id: 'asset-123',
        ownerUserId: testUserId,
        blobUrl: 'https://example.blob.vercel-storage.com/test.jpg',
        pathname: 'test.jpg',
        embedding: {
          id: 'embedding-123',
          imageEmbedding: Array(1152).fill(0.1),
        },
      });

      const request = createMockRequest('GET');
      const response = await embeddingStatusGET(
        request,
        { params: { id: 'asset-123' } }
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.hasEmbedding).toBe(true);
      expect(data.embeddingId).toBe('embedding-123');
    });

    it('should handle cross-user asset access prevention', async () => {
      mockAuth.mockResolvedValue({ userId: 'different-user' });

      prisma.asset.findUnique.mockResolvedValue({
        id: 'asset-123',
        ownerUserId: testUserId, // Different from auth user
        blobUrl: 'https://example.blob.vercel-storage.com/test.jpg',
        pathname: 'test.jpg',
      });

      const request = createMockRequest('GET');
      const response = await embeddingStatusGET(
        request,
        { params: { id: 'asset-123' } }
      );
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });
  });

  describe('Upload Recovery and Resilience', () => {
    it('should recover from partial upload failure', async () => {
      // First attempt fails
      mockPut.mockRejectedValueOnce(new Error('Network error'));

      // Second attempt succeeds
      mockPut.mockResolvedValueOnce({
        url: 'https://example.blob.vercel-storage.com/recovered.jpg',
        downloadUrl: 'https://example.blob.vercel-storage.com/recovered.jpg',
        pathname: 'recovered.jpg',
        contentType: 'image/jpeg',
        contentDisposition: 'inline',
      });

      const request = createMockRequest('POST', {
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        size: 1024000,
      });

      // First attempt
      const response1 = await uploadUrlPOST(request);
      expect(response1.status).toBe(500);

      // Second attempt (retry)
      const response2 = await uploadUrlPOST(request);
      const data = await response2.json();

      expect(response2.status).toBe(200);
      expect(data.uploadUrl).toBeDefined();
      expect(data.pathname).toBe('recovered.jpg');
    });

    it('should handle database transaction failures', async () => {
      prisma.asset.findFirst.mockResolvedValue(null);
      prisma.asset.create.mockRejectedValue(new Error('Database connection lost'));

      const request = createMockRequest('POST', {
        blobUrl: 'https://example.blob.vercel-storage.com/test.jpg',
        pathname: 'test.jpg',
        filename: 'test.jpg',
        mimeType: testImageFile.mimeType,
        size: testImageFile.size,
        checksum: testImageFile.checksum,
        width: testImageFile.width,
        height: testImageFile.height,
      });

      const response = await assetsPOST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to create asset');
    });

    it('should handle cache invalidation failures gracefully', async () => {
      const mockCache = mockMultiLayerCache();
      mockCache.invalidateUserData.mockRejectedValue(new Error('Cache service down'));
      getMultiLayerCache.mockReturnValue(mockCache);

      prisma.asset.findFirst.mockResolvedValue(null);
      prisma.asset.create.mockResolvedValue({
        id: 'asset-789',
        ownerUserId: testUserId,
        blobUrl: 'https://example.blob.vercel-storage.com/test.jpg',
        pathname: 'test.jpg',
        filename: 'test.jpg',
        mime: testImageFile.mimeType,
        size: testImageFile.size,
        checksumSha256: testImageFile.checksum,
        width: testImageFile.width,
        height: testImageFile.height,
        favorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        phash: null,
      });

      const request = createMockRequest('POST', {
        blobUrl: 'https://example.blob.vercel-storage.com/test.jpg',
        pathname: 'test.jpg',
        filename: 'test.jpg',
        mimeType: testImageFile.mimeType,
        size: testImageFile.size,
        checksum: testImageFile.checksum,
        width: testImageFile.width,
        height: testImageFile.height,
      });

      const response = await assetsPOST(request);
      const data = await response.json();

      // Asset creation should still succeed despite cache failure
      expect(response.status).toBe(200);
      expect(data.message).toBe('Asset created successfully');
      expect(data.asset.id).toBe('asset-789');
    });
  });
});