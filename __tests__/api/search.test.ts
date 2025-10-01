import { POST, GET } from '@/app/api/search/route';
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
const { createEmbeddingService, EmbeddingError } = require('@/lib/embeddings');
const { createMultiLayerCache, getMultiLayerCache } = require('@/lib/multi-layer-cache');
const { prisma, vectorSearch, logSearch } = require('@/lib/db');

describe('/api/search', () => {
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

    it('should return 400 if query is not a string', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const request = createMockRequest('POST', {
        query: 123,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing or invalid query parameter');
    });

    it('should return 400 if query exceeds 500 characters', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const longQuery = 'a'.repeat(501);
      const request = createMockRequest('POST', {
        query: longQuery,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Query text too long (max 500 characters)');
    });

    it('should return cached results when available', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const cachedResults = [
        {
          id: 'cached-1',
          blobUrl: 'https://example.blob.vercel-storage.com/cached.jpg',
          pathname: 'cached.jpg',
          mime: 'image/jpeg',
          width: 1920,
          height: 1080,
          favorite: false,
          createdAt: new Date(),
          similarity: 0.95,
          relevance: 95,
          tags: [],
        },
      ];

      const mockCache = mockMultiLayerCache();
      mockCache.getSearchResults.mockResolvedValue(cachedResults);
      getMultiLayerCache.mockReturnValue(mockCache);

      const request = createMockRequest('POST', {
        query: 'cached search',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.cached).toBe(true);
      expect(data.results).toEqual(cachedResults);
      expect(vectorSearch).not.toHaveBeenCalled();
    });

    it('should perform vector search when cache misses', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const mockCache = mockMultiLayerCache();
      mockCache.getSearchResults.mockResolvedValue(null); // Cache miss
      getMultiLayerCache.mockReturnValue(mockCache);

      const searchResults = [
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
      ];

      vectorSearch.mockResolvedValue(searchResults);
      prisma.assetTag.findMany.mockResolvedValue([]);

      const request = createMockRequest('POST', {
        query: 'test search',
        limit: 20,
        threshold: 0.7,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.cached).toBe(false);
      expect(data.results).toHaveLength(1);
      expect(data.results[0].relevance).toBe(90);
      expect(vectorSearch).toHaveBeenCalledWith(
        'test-user-id',
        expect.any(Array),
        { limit: 20, threshold: 0.7 }
      );
    });

    it('should cache search results after performing search', async () => {
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
      prisma.assetTag.findMany.mockResolvedValue([]);

      const request = createMockRequest('POST', {
        query: 'test search',
      });

      await POST(request);

      expect(mockCache.setSearchResults).toHaveBeenCalledWith(
        'test-user-id',
        'test search',
        expect.any(Array),
        expect.objectContaining({ limit: 30, threshold: 0.2 })
      );
    });

    it('should include fallback matches when fewer than ten results meet the threshold', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const mockCache = mockMultiLayerCache();
      mockCache.getSearchResults.mockResolvedValue(null);
      getMultiLayerCache.mockReturnValue(mockCache);

      const primaryResults = [
        {
          id: 'asset-primary-1',
          blob_url: 'https://example.blob.vercel-storage.com/primary1.jpg',
          pathname: 'primary1.jpg',
          mime: 'image/jpeg',
          width: 1024,
          height: 768,
          favorite: false,
          size: 150000,
          created_at: new Date(),
          distance: 0.86,
        },
        {
          id: 'asset-primary-2',
          blob_url: 'https://example.blob.vercel-storage.com/primary2.jpg',
          pathname: 'primary2.jpg',
          mime: 'image/jpeg',
          width: 900,
          height: 900,
          favorite: false,
          size: 150000,
          created_at: new Date(),
          distance: 0.81,
        },
      ];

      const fallbackResults = [
        ...primaryResults,
        ...Array.from({ length: 10 }).map((_, index) => ({
          id: `asset-fallback-${index}`,
          blob_url: `https://example.blob.vercel-storage.com/fallback-${index}.jpg`,
          pathname: `fallback-${index}.jpg`,
          mime: 'image/jpeg',
          width: 800,
          height: 800,
          favorite: false,
          size: 120000,
          created_at: new Date(),
          distance: Number((0.45 - index * 0.01).toFixed(2)),
        })),
      ];

      vectorSearch
        .mockResolvedValueOnce(primaryResults)
        .mockResolvedValueOnce(fallbackResults);

      prisma.assetTag.findMany.mockResolvedValue([]);

      const request = createMockRequest('POST', {
        query: 'test search',
        limit: 12,
        threshold: 0.8,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(vectorSearch).toHaveBeenNthCalledWith(
        1,
        'test-user-id',
        expect.any(Array),
        { limit: 12, threshold: 0.8 }
      );
      expect(vectorSearch).toHaveBeenNthCalledWith(
        2,
        'test-user-id',
        expect.any(Array),
        { limit: 12, threshold: 0 }
      );

      expect(data.thresholdFallback).toBe(true);
      expect(data.results).toHaveLength(12);
      const belowThresholdMatches = data.results.filter((result: any) => result.belowThreshold);
      expect(belowThresholdMatches.length).toBeGreaterThan(0);
      expect(belowThresholdMatches.every((result: any) => result.relevance < 80)).toBe(true);
    });

    it('should handle embedding service errors gracefully', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const mockCache = mockMultiLayerCache();
      mockCache.getSearchResults.mockResolvedValue(null);
      getMultiLayerCache.mockReturnValue(mockCache);

      createEmbeddingService.mockImplementation(() => {
        throw new Error('Embedding service not configured');
      });

      const request = createMockRequest('POST', {
        query: 'test search',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.results).toEqual([]);
      expect(data.error).toContain('Search is currently unavailable');
    });

    it('should log search analytics', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const mockCache = mockMultiLayerCache();
      mockCache.getSearchResults.mockResolvedValue(null);
      getMultiLayerCache.mockReturnValue(mockCache);

      vectorSearch.mockResolvedValue([]);
      logSearch.mockResolvedValue(undefined);

      const request = createMockRequest('POST', {
        query: 'test search',
      });

      await POST(request);

      expect(logSearch).toHaveBeenCalledWith(
        'test-user-id',
        'test search',
        0,
        expect.any(Number)
      );
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

    it('should return recent searches for user', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const recentSearches = [
        {
          id: 'log-1',
          userId: 'test-user-id',
          query: 'recent search 1',
          resultCount: 5,
          queryTime: 100,
          createdAt: new Date(),
        },
        {
          id: 'log-2',
          userId: 'test-user-id',
          query: 'recent search 2',
          resultCount: 10,
          queryTime: 150,
          createdAt: new Date(),
        },
      ];

      prisma.searchLog.findMany.mockResolvedValue(recentSearches);

      const request = createMockRequest('GET', null, {}, {
        type: 'recent',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.searches).toHaveLength(2);
      expect(data.searches[0].query).toBe('recent search 1');
      expect(prisma.searchLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'test-user-id' },
          orderBy: { createdAt: 'desc' },
          take: 10,
          distinct: ['query'],
        })
      );
    });

    it('should return popular searches', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const popularSearches = [
        { query: 'popular 1', _count: { query: 50 } },
        { query: 'popular 2', _count: { query: 30 } },
      ];

      prisma.searchLog.groupBy.mockResolvedValue(popularSearches);

      const request = createMockRequest('GET', null, {}, {
        type: 'popular',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.searches).toHaveLength(2);
      expect(data.searches[0].query).toBe('popular 1');
      expect(data.searches[0].count).toBe(50);
    });

    it('should return 400 for invalid search type', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const request = createMockRequest('GET', null, {}, {
        type: 'invalid',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid search type');
    });
  });
});
