import { GET, PATCH, DELETE } from '@/app/api/assets/[id]/route';
import { createMockRequest, mockPrisma, mockMultiLayerCache } from '../utils/test-helpers';
import { del } from '@vercel/blob';

// Mock dependencies
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/db', () => {
  const helpers = require('../utils/test-helpers');
  return {
    prisma: helpers.mockPrisma(),
  };
});

jest.mock('@vercel/blob', () => ({
  del: jest.fn(),
}));

jest.mock('@/lib/multi-layer-cache', () => ({
  createMultiLayerCache: jest.fn(),
  getMultiLayerCache: jest.fn(),
}));

const mockAuth = require('@clerk/nextjs/server').auth;
const mockDel = del as jest.MockedFunction<typeof del>;
const { createMultiLayerCache, getMultiLayerCache } = require('@/lib/multi-layer-cache');
const { prisma } = require('@/lib/db');

describe('/api/assets/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const mockCache = mockMultiLayerCache();
    createMultiLayerCache.mockReturnValue(mockCache);
    getMultiLayerCache.mockReturnValue(mockCache);
  });

  const mockAsset = {
    id: 'asset-123',
    ownerUserId: 'test-user-id',
    blobUrl: 'https://example.blob.vercel-storage.com/test.jpg',
    pathname: 'test.jpg',
    filename: 'test.jpg',
    mime: 'image/jpeg',
    size: 1024000,
    checksumSha256: 'checksum',
    width: 1920,
    height: 1080,
    favorite: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    phash: null,
  };

  describe('GET', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const request = createMockRequest('GET');
      const response = await GET(request, { params: { id: 'asset-123' } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 if asset not found', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });
      prisma.asset.findUnique.mockResolvedValue(null);

      const request = createMockRequest('GET');
      const response = await GET(request, { params: { id: 'asset-123' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Asset not found');
    });

    it('should return 403 if user does not own the asset', async () => {
      mockAuth.mockResolvedValue({ userId: 'different-user' });
      prisma.asset.findUnique.mockResolvedValue({
        ...mockAsset,
        ownerUserId: 'test-user-id',
      });

      const request = createMockRequest('GET');
      const response = await GET(request, { params: { id: 'asset-123' } });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should return asset details for valid owner', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });
      prisma.asset.findUnique.mockResolvedValue(mockAsset);
      prisma.assetTag.findMany.mockResolvedValue([
        { tag: { name: 'funny' } },
        { tag: { name: 'meme' } },
      ]);

      const request = createMockRequest('GET');
      const response = await GET(request, { params: { id: 'asset-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('asset-123');
      expect(data.tags).toEqual(['funny', 'meme']);
    });
  });

  describe('PATCH', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const request = createMockRequest('PATCH', {
        favorite: true,
      });
      const response = await PATCH(request, { params: { id: 'asset-123' } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 if asset not found', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });
      prisma.asset.findUnique.mockResolvedValue(null);

      const request = createMockRequest('PATCH', {
        favorite: true,
      });
      const response = await PATCH(request, { params: { id: 'asset-123' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Asset not found');
    });

    it('should update favorite status', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });
      prisma.asset.findUnique.mockResolvedValue(mockAsset);
      prisma.asset.update.mockResolvedValue({
        ...mockAsset,
        favorite: true,
      });

      const request = createMockRequest('PATCH', {
        favorite: true,
      });
      const response = await PATCH(request, { params: { id: 'asset-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.favorite).toBe(true);
      expect(prisma.asset.update).toHaveBeenCalledWith({
        where: { id: 'asset-123' },
        data: { favorite: true },
      });
    });

    it('should update tags', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });
      prisma.asset.findUnique.mockResolvedValue(mockAsset);
      prisma.asset.update.mockResolvedValue(mockAsset);
      prisma.tag.findFirst.mockResolvedValue(null);
      prisma.tag.create.mockResolvedValue({
        id: 'tag-123',
        name: 'new-tag',
        userId: 'test-user-id',
      });

      const request = createMockRequest('PATCH', {
        tags: ['new-tag', 'another-tag'],
      });
      const response = await PATCH(request, { params: { id: 'asset-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.assetTag.deleteMany).toHaveBeenCalledWith({
        where: { assetId: 'asset-123' },
      });
    });

    it('should invalidate cache after update', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });
      prisma.asset.findUnique.mockResolvedValue(mockAsset);
      prisma.asset.update.mockResolvedValue({
        ...mockAsset,
        favorite: true,
      });

      const mockCache = mockMultiLayerCache();
      getMultiLayerCache.mockReturnValue(mockCache);

      const request = createMockRequest('PATCH', {
        favorite: true,
      });
      await PATCH(request, { params: { id: 'asset-123' } });

      expect(mockCache.invalidateUserData).toHaveBeenCalledWith('test-user-id');
    });
  });

  describe('DELETE', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const request = createMockRequest('DELETE');
      const response = await DELETE(request, { params: { id: 'asset-123' } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 if asset not found', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });
      prisma.asset.findUnique.mockResolvedValue(null);

      const request = createMockRequest('DELETE');
      const response = await DELETE(request, { params: { id: 'asset-123' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Asset not found');
    });

    it('should soft delete asset', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });
      prisma.asset.findUnique.mockResolvedValue(mockAsset);
      prisma.asset.update.mockResolvedValue({
        ...mockAsset,
        deletedAt: new Date(),
      });

      const request = createMockRequest('DELETE');
      const response = await DELETE(request, { params: { id: 'asset-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Asset deleted successfully');
      expect(prisma.asset.update).toHaveBeenCalledWith({
        where: { id: 'asset-123' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should delete blob storage file', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });
      prisma.asset.findUnique.mockResolvedValue(mockAsset);
      prisma.asset.update.mockResolvedValue({
        ...mockAsset,
        deletedAt: new Date(),
      });

      const request = createMockRequest('DELETE');
      await DELETE(request, { params: { id: 'asset-123' } });

      expect(mockDel).toHaveBeenCalledWith(mockAsset.blobUrl);
    });

    it('should invalidate cache after deletion', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });
      prisma.asset.findUnique.mockResolvedValue(mockAsset);
      prisma.asset.update.mockResolvedValue({
        ...mockAsset,
        deletedAt: new Date(),
      });

      const mockCache = mockMultiLayerCache();
      getMultiLayerCache.mockReturnValue(mockCache);

      const request = createMockRequest('DELETE');
      await DELETE(request, { params: { id: 'asset-123' } });

      expect(mockCache.invalidateUserData).toHaveBeenCalledWith('test-user-id');
    });
  });
});