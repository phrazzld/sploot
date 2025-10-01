import { POST } from '@/app/api/search/advanced/route';
import { createMockRequest, mockPrisma, mockEmbeddingService, mockMultiLayerCache } from '../utils/test-helpers';

// Mock dependencies
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => {
  const helpers = require('../utils/test-helpers');
  return {
    prisma: helpers.mockPrisma(),
    vectorSearch: vi.fn(),
    logSearch: vi.fn(),
  };
});

vi.mock('@/lib/embeddings', () => ({
  createEmbeddingService: vi.fn(),
  EmbeddingError: class EmbeddingError extends Error {
    constructor(message: string, public statusCode?: number) {
      super(message);
    }
  },
}));

vi.mock('@/lib/multi-layer-cache', () => ({
  createMultiLayerCache: vi.fn(),
  getMultiLayerCache: vi.fn(),
}));

const mockAuth = require('@clerk/nextjs/server').auth;
const { createEmbeddingService } = require('@/lib/embeddings');
const { createMultiLayerCache, getMultiLayerCache } = require('@/lib/multi-layer-cache');
const { prisma, vectorSearch, logSearch } = require('@/lib/db');

describe('/api/search/advanced', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createEmbeddingService.mockReturnValue(mockEmbeddingService());
    const mockCache = mockMultiLayerCache();
    createMultiLayerCache.mockReturnValue(mockCache);
    getMultiLayerCache.mockReturnValue(mockCache);
  });

  describe('POST', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const request = createMockRequest('POST', {
        query: 'test search',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 if query is missing', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const request = createMockRequest('POST', {});
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing or invalid query parameter');
    });

    it('should handle filters properly', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const mockCache = mockMultiLayerCache();
      mockCache.getSearchResults.mockResolvedValue(null);
      getMultiLayerCache.mockReturnValue(mockCache);

      vectorSearch.mockResolvedValue([
        {
          id: 'result-1',
          blob_url: 'https://example.blob.vercel-storage.com/result.jpg',
          pathname: 'result.jpg',
          mime: 'image/jpeg',
          width: 1920,
          height: 1080,
          favorite: true,
          created_at: new Date('2024-01-15'),
          distance: 0.9,
        },
      ]);
      prisma.assetTag.findMany.mockResolvedValue([]);

      const request = createMockRequest('POST', {
        query: 'test search',
        filters: {
          favorites: true,
          dateRange: {
            from: '2024-01-01',
            to: '2024-12-31',
          },
          tags: ['meme', 'funny'],
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.cached).toBe(false);
      expect(data.filters).toEqual({
        favorites: true,
        dateRange: {
          from: '2024-01-01',
          to: '2024-12-31',
        },
        tags: ['meme', 'funny'],
      });
    });

    it('should handle sorting options', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const mockCache = mockMultiLayerCache();
      mockCache.getSearchResults.mockResolvedValue(null);
      getMultiLayerCache.mockReturnValue(mockCache);

      const results = [
        {
          id: 'result-1',
          blob_url: 'https://example.blob.vercel-storage.com/1.jpg',
          pathname: '1.jpg',
          mime: 'image/jpeg',
          width: 1920,
          height: 1080,
          favorite: false,
          created_at: new Date('2024-01-15'),
          distance: 0.8,
        },
        {
          id: 'result-2',
          blob_url: 'https://example.blob.vercel-storage.com/2.jpg',
          pathname: '2.jpg',
          mime: 'image/jpeg',
          width: 1920,
          height: 1080,
          favorite: false,
          created_at: new Date('2024-01-20'),
          distance: 0.9,
        },
      ];

      vectorSearch.mockResolvedValue(results);
      prisma.assetTag.findMany.mockResolvedValue([]);

      const request = createMockRequest('POST', {
        query: 'test search',
        sortBy: 'date',
        sortOrder: 'desc',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.results).toHaveLength(2);
      // Should be sorted by date descending
      expect(new Date(data.results[0].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(data.results[1].createdAt).getTime()
      );
    });

    it('should include metadata when requested', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const mockCache = mockMultiLayerCache();
      mockCache.getSearchResults.mockResolvedValue(null);
      getMultiLayerCache.mockReturnValue(mockCache);

      vectorSearch.mockResolvedValue([
        {
          id: 'result-1',
          blob_url: 'https://example.blob.vercel-storage.com/result.jpg',
          pathname: 'result.jpg',
          mime: 'image/jpeg',
          width: 1920,
          height: 1080,
          favorite: false,
          created_at: new Date(),
          distance: 0.9,
        },
      ]);
      prisma.assetTag.findMany.mockResolvedValue([
        {
          assetId: 'result-1',
          tag: { name: 'funny' },
        },
      ]);

      const request = createMockRequest('POST', {
        query: 'test search',
        includeMetadata: true,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.results[0].metadata).toBeDefined();
      expect(data.results[0].metadata.tags).toEqual(['funny']);
    });

    it('should respect pagination parameters', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const mockCache = mockMultiLayerCache();
      mockCache.getSearchResults.mockResolvedValue(null);
      getMultiLayerCache.mockReturnValue(mockCache);

      vectorSearch.mockResolvedValue([]);
      prisma.assetTag.findMany.mockResolvedValue([]);

      const request = createMockRequest('POST', {
        query: 'test search',
        limit: 50,
        offset: 100,
      });

      await POST(request);

      expect(vectorSearch).toHaveBeenCalledWith(
        'test-user-id',
        expect.any(Array),
        expect.objectContaining({
          limit: 50,
          offset: 100,
        })
      );
    });
  });
});