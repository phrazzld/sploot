import { POST, GET } from '@/app/api/assets/route';
import { createMockRequest, mockEmbeddingService, mockMultiLayerCache } from '../utils/test-helpers';
import { auth } from '@clerk/nextjs/server';
import { createEmbeddingService } from '@/lib/embeddings';
import { createMultiLayerCache, getMultiLayerCache } from '@/lib/multi-layer-cache';
import { mockPrisma, setupPrismaMock, resetPrismaMocks } from '../mocks/prisma';

// Mock dependencies
vi.mock('@clerk/nextjs/server');
vi.mock('@/lib/db', setupPrismaMock);
vi.mock('@/lib/embeddings');
vi.mock('@/lib/multi-layer-cache');

const mockAuth = vi.mocked(auth);
const mockCreateEmbeddingService = vi.mocked(createEmbeddingService);
const mockCreateMultiLayerCache = vi.mocked(createMultiLayerCache);
const mockGetMultiLayerCache = vi.mocked(getMultiLayerCache);

describe('/api/assets', () => {
  beforeEach(() => {
    resetPrismaMocks();
    vi.clearAllMocks();
    mockCreateEmbeddingService.mockReturnValue(mockEmbeddingService());
    const mockCache = mockMultiLayerCache();
    mockCreateMultiLayerCache.mockReturnValue(mockCache);
    mockGetMultiLayerCache.mockReturnValue(mockCache);
  });

  describe('POST', () => {
    const validAssetData = {
      blobUrl: 'https://example.blob.vercel-storage.com/test.jpg',
      pathname: 'test.jpg',
      filename: 'test.jpg',
      mimeType: 'image/jpeg',
      size: 1024000,
      checksum: 'abc123',
      width: 1920,
      height: 1080,
    };

    it('should return 401 if user is not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const request = createMockRequest('POST', validAssetData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 if required fields are missing', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const request = createMockRequest('POST', {
        blobUrl: 'https://example.blob.vercel-storage.com/test.jpg',
        // Missing other required fields
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Missing required parameters');
    });

    it('should return 400 for invalid file type', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const request = createMockRequest('POST', {
        ...validAssetData,
        mimeType: 'application/pdf',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid file type');
    });

    it('should return 400 for file size exceeding limit', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const request = createMockRequest('POST', {
        ...validAssetData,
        size: 11 * 1024 * 1024, // 11MB
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('File size must be between');
    });

    it('should detect and handle duplicate assets', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const existingAsset = {
        id: 'existing-123',
        ownerUserId: 'test-user-id',
        blobUrl: 'https://example.blob.vercel-storage.com/existing.jpg',
        pathname: 'existing.jpg',
        filename: 'existing.jpg',
        mime: 'image/jpeg',
        size: 1024000,
        checksumSha256: 'abc123',
        width: 1920,
        height: 1080,
        favorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        phash: null,
      };

      prisma.asset.findFirst.mockResolvedValue(existingAsset);

      const request = createMockRequest('POST', validAssetData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.duplicate).toBe(true);
      expect(data.message).toBe('Asset already exists');
      expect(data.asset.id).toBe('existing-123');
    });

    it('should successfully create a new asset', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });
      prisma.asset.findFirst.mockResolvedValue(null); // No duplicate

      const request = createMockRequest('POST', validAssetData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Asset created successfully');
      expect(data.asset).toBeDefined();
      expect(prisma.asset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ownerUserId: 'test-user-id',
            blobUrl: validAssetData.blobUrl,
            pathname: validAssetData.pathname,
            mime: validAssetData.mimeType,
            size: validAssetData.size,
            checksumSha256: validAssetData.checksum,
          }),
        })
      );
    });

    it('should invalidate user cache after creating asset', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });
      prisma.asset.findFirst.mockResolvedValue(null);

      const mockCache = mockMultiLayerCache();
      getMultiLayerCache.mockReturnValue(mockCache);

      const request = createMockRequest('POST', validAssetData);
      await POST(request);

      expect(mockCache.invalidateUserData).toHaveBeenCalledWith('test-user-id');
    });
  });

  describe('GET', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const request = createMockRequest('GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return assets with default pagination', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const mockAssets = [
        {
          id: 'asset-1',
          ownerUserId: 'test-user-id',
          blobUrl: 'https://example.blob.vercel-storage.com/test1.jpg',
          pathname: 'test1.jpg',
          mime: 'image/jpeg',
          size: 1024000,
          checksumSha256: 'checksum1',
          width: 1920,
          height: 1080,
          favorite: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          phash: null,
          embedding: null,
          tags: [],
        },
      ];

      prisma.asset.findMany.mockResolvedValue(mockAssets);
      prisma.asset.count.mockResolvedValue(1);

      const request = createMockRequest('GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.assets).toHaveLength(1);
      expect(data.total).toBe(1);
      expect(data.limit).toBe(30);
      expect(data.offset).toBe(0);
    });

    it('should support pagination parameters', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });
      prisma.asset.findMany.mockResolvedValue([]);
      prisma.asset.count.mockResolvedValue(100);

      const request = createMockRequest('GET', null, {}, {
        limit: '10',
        offset: '20',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.limit).toBe(10);
      expect(data.offset).toBe(20);
      expect(prisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        })
      );
    });

    it('should filter by favorites when requested', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });
      prisma.asset.findMany.mockResolvedValue([]);
      prisma.asset.count.mockResolvedValue(5);

      const request = createMockRequest('GET', null, {}, {
        favorites: 'true',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            favorite: true,
          }),
        })
      );
    });

    it('should sort assets by creation date by default', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });
      prisma.asset.findMany.mockResolvedValue([]);

      const request = createMockRequest('GET');
      await GET(request);

      expect(prisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });
  });
});