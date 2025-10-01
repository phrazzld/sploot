import { POST as searchPOST, GET as searchGET } from '@/app/api/search/route';
import { POST as advancedSearchPOST } from '@/app/api/search/advanced/route';
import { POST as textEmbeddingPOST } from '@/app/api/embeddings/text/route';
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

describe('Search Flow Integration Tests', () => {
  const testUserId = 'test-user-id';
  const testQuery = 'funny cat meme';
  const mockEmbedding = Array(1152).fill(0.1);

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    mockAuth.mockResolvedValue({ userId: testUserId });
    createEmbeddingService.mockReturnValue(mockEmbeddingService());
    const mockCache = mockMultiLayerCache();
    createMultiLayerCache.mockReturnValue(mockCache);
    getMultiLayerCache.mockReturnValue(mockCache);
  });

  describe('Complete Search Flow', () => {
    it('should successfully complete end-to-end search flow', async () => {
      // Setup: Mock cache miss to trigger full search
      const mockCache = mockMultiLayerCache();
      mockCache.getSearchResults.mockResolvedValue(null);
      getMultiLayerCache.mockReturnValue(mockCache);

      // Setup: Mock embedding generation
      const embeddingService = mockEmbeddingService();
      embeddingService.embedText.mockResolvedValue({
        embedding: mockEmbedding,
        model: 'siglip-large',
        dimension: 1152,
        processingTime: 100,
      });
      createEmbeddingService.mockReturnValue(embeddingService);

      // Setup: Mock vector search results
      const mockSearchResults = [
        {
          id: 'asset-1',
          blob_url: 'https://example.blob.vercel-storage.com/cat1.jpg',
          pathname: 'cat1.jpg',
          filename: 'cat1.jpg',
          mime: 'image/jpeg',
          size: 1024000,
          width: 1920,
          height: 1080,
          favorite: false,
          created_at: new Date(),
          distance: 0.2, // High similarity (low distance)
        },
        {
          id: 'asset-2',
          blob_url: 'https://example.blob.vercel-storage.com/cat2.jpg',
          pathname: 'cat2.jpg',
          filename: 'cat2.jpg',
          mime: 'image/jpeg',
          size: 2048000,
          width: 1920,
          height: 1080,
          favorite: true,
          created_at: new Date(),
          distance: 0.3,
        },
      ];
      vectorSearch.mockResolvedValue(mockSearchResults);

      // Setup: Mock tags for assets
      prisma.assetTag.findMany.mockResolvedValue([
        { assetId: 'asset-1', tag: { name: 'funny' } },
        { assetId: 'asset-1', tag: { name: 'cat' } },
      ]);

      // Setup: Mock search logging
      logSearch.mockResolvedValue(undefined);

      // Execute search
      const request = createMockRequest('POST', {
        query: testQuery,
        limit: 30,
        threshold: 0.6,
      });

      const response = await searchPOST(request);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(200);
      expect(data.cached).toBe(false);
      expect(data.results).toHaveLength(2);
      expect(data.results[0].id).toBe('asset-1');
      expect(data.results[0].relevance).toBeGreaterThan(70); // High relevance score
      expect(data.results[0].tags).toEqual(['funny', 'cat']);

      // Verify embedding was generated
      expect(embeddingService.embedText).toHaveBeenCalledWith(testQuery);

      // Verify vector search was called
      expect(vectorSearch).toHaveBeenCalledWith(
        testUserId,
        mockEmbedding,
        { limit: 30, threshold: 0.6 }
      );

      // Verify results were cached
      expect(mockCache.setSearchResults).toHaveBeenCalledWith(
        testUserId,
        testQuery,
        expect.any(Array),
        { limit: 30, threshold: 0.6 }
      );

      // Verify search was logged
      expect(logSearch).toHaveBeenCalledWith(
        testUserId,
        testQuery,
        2,
        expect.any(Number)
      );
    });

    it('should return cached results when available', async () => {
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
          tags: ['meme'],
        },
      ];

      const mockCache = mockMultiLayerCache();
      mockCache.getSearchResults.mockResolvedValue(cachedResults);
      getMultiLayerCache.mockReturnValue(mockCache);

      const request = createMockRequest('POST', {
        query: testQuery,
      });

      const response = await searchPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.cached).toBe(true);
      expect(data.results).toEqual(cachedResults);

      // Verify no embedding generation or vector search occurred
      expect(createEmbeddingService).not.toHaveBeenCalled();
      expect(vectorSearch).not.toHaveBeenCalled();
    });

    it('should handle embedding service failures gracefully', async () => {
      const mockCache = mockMultiLayerCache();
      mockCache.getSearchResults.mockResolvedValue(null);
      getMultiLayerCache.mockReturnValue(mockCache);

      // Simulate embedding service failure
      createEmbeddingService.mockImplementation(() => {
        throw new Error('Embedding service unavailable');
      });

      const request = createMockRequest('POST', {
        query: testQuery,
      });

      const response = await searchPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.results).toEqual([]);
      expect(data.error).toContain('Search is currently unavailable');
    });

    it('should handle vector search failures', async () => {
      const mockCache = mockMultiLayerCache();
      mockCache.getSearchResults.mockResolvedValue(null);
      getMultiLayerCache.mockReturnValue(mockCache);

      const embeddingService = mockEmbeddingService();
      embeddingService.embedText.mockResolvedValue({
        embedding: mockEmbedding,
        model: 'siglip-large',
        dimension: 1152,
        processingTime: 100,
      });
      createEmbeddingService.mockReturnValue(embeddingService);

      // Simulate vector search failure
      vectorSearch.mockRejectedValue(new Error('Database connection lost'));

      const request = createMockRequest('POST', {
        query: testQuery,
      });

      const response = await searchPOST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Search failed');
    });

    it('should enforce query validation', async () => {
      // Test missing query
      let request = createMockRequest('POST', {});
      let response = await searchPOST(request);
      let data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing or invalid query parameter');

      // Test query too long
      const longQuery = 'a'.repeat(501);
      request = createMockRequest('POST', {
        query: longQuery,
      });
      response = await searchPOST(request);
      data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Query text too long (max 500 characters)');

      // Test non-string query
      request = createMockRequest('POST', {
        query: 123,
      });
      response = await searchPOST(request);
      data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing or invalid query parameter');
    });

    it('should prevent cross-user data access', async () => {
      const otherUserId = 'other-user-id';
      mockAuth.mockResolvedValue({ userId: otherUserId });

      const mockCache = mockMultiLayerCache();
      mockCache.getSearchResults.mockResolvedValue(null);
      getMultiLayerCache.mockReturnValue(mockCache);

      const embeddingService = mockEmbeddingService();
      embeddingService.embedText.mockResolvedValue({
        embedding: mockEmbedding,
        model: 'siglip-large',
        dimension: 1152,
        processingTime: 100,
      });
      createEmbeddingService.mockReturnValue(embeddingService);

      // Return results for wrong user (should be filtered)
      vectorSearch.mockResolvedValue([]);

      const request = createMockRequest('POST', {
        query: testQuery,
      });

      const response = await searchPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.results).toEqual([]);

      // Verify search was scoped to correct user
      expect(vectorSearch).toHaveBeenCalledWith(
        otherUserId,
        mockEmbedding,
        expect.any(Object)
      );
    });
  });

  describe('Advanced Search Flow', () => {
    it('should handle advanced search with filters', async () => {
      const mockCache = mockMultiLayerCache();
      mockCache.getSearchResults.mockResolvedValue(null);
      getMultiLayerCache.mockReturnValue(mockCache);

      const embeddingService = mockEmbeddingService();
      embeddingService.embedText.mockResolvedValue({
        embedding: mockEmbedding,
        model: 'siglip-large',
        dimension: 1152,
        processingTime: 100,
      });
      createEmbeddingService.mockReturnValue(embeddingService);

      const filteredResults = [
        {
          id: 'asset-fav-1',
          blob_url: 'https://example.blob.vercel-storage.com/fav.jpg',
          pathname: 'fav.jpg',
          mime: 'image/jpeg',
          width: 1920,
          height: 1080,
          favorite: true,
          created_at: new Date('2024-01-15'),
          distance: 0.25,
        },
      ];
      vectorSearch.mockResolvedValue(filteredResults);
      prisma.assetTag.findMany.mockResolvedValue([]);

      const request = createMockRequest('POST', {
        query: testQuery,
        filters: {
          favorites: true,
          dateRange: {
            from: '2024-01-01',
            to: '2024-12-31',
          },
          mimeTypes: ['image/jpeg', 'image/png'],
          tags: ['funny', 'cat'],
        },
        sortBy: 'relevance',
        sortOrder: 'desc',
        limit: 50,
        offset: 0,
      });

      const response = await advancedSearchPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.filters).toEqual({
        favorites: true,
        dateRange: {
          from: '2024-01-01',
          to: '2024-12-31',
        },
        mimeTypes: ['image/jpeg', 'image/png'],
        tags: ['funny', 'cat'],
      });
      expect(data.results).toHaveLength(1);
      expect(data.results[0].favorite).toBe(true);
    });

    it('should handle sorting options', async () => {
      const mockCache = mockMultiLayerCache();
      mockCache.getSearchResults.mockResolvedValue(null);
      getMultiLayerCache.mockReturnValue(mockCache);

      const embeddingService = mockEmbeddingService();
      embeddingService.embedText.mockResolvedValue({
        embedding: mockEmbedding,
        model: 'siglip-large',
        dimension: 1152,
        processingTime: 100,
      });
      createEmbeddingService.mockReturnValue(embeddingService);

      const results = [
        {
          id: 'asset-old',
          blob_url: 'https://example.blob.vercel-storage.com/old.jpg',
          pathname: 'old.jpg',
          mime: 'image/jpeg',
          width: 1920,
          height: 1080,
          favorite: false,
          created_at: new Date('2024-01-01'),
          distance: 0.2,
        },
        {
          id: 'asset-new',
          blob_url: 'https://example.blob.vercel-storage.com/new.jpg',
          pathname: 'new.jpg',
          mime: 'image/jpeg',
          width: 1920,
          height: 1080,
          favorite: false,
          created_at: new Date('2024-12-01'),
          distance: 0.3,
        },
      ];
      vectorSearch.mockResolvedValue(results);
      prisma.assetTag.findMany.mockResolvedValue([]);

      const request = createMockRequest('POST', {
        query: testQuery,
        sortBy: 'date',
        sortOrder: 'desc',
      });

      const response = await advancedSearchPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.results).toHaveLength(2);
      // Verify sorting by date descending
      const firstDate = new Date(data.results[0].createdAt);
      const secondDate = new Date(data.results[1].createdAt);
      expect(firstDate.getTime()).toBeGreaterThanOrEqual(secondDate.getTime());
    });

    it('should include metadata when requested', async () => {
      const mockCache = mockMultiLayerCache();
      mockCache.getSearchResults.mockResolvedValue(null);
      getMultiLayerCache.mockReturnValue(mockCache);

      const embeddingService = mockEmbeddingService();
      embeddingService.embedText.mockResolvedValue({
        embedding: mockEmbedding,
        model: 'siglip-large',
        dimension: 1152,
        processingTime: 100,
      });
      createEmbeddingService.mockReturnValue(embeddingService);

      vectorSearch.mockResolvedValue([
        {
          id: 'asset-meta',
          blob_url: 'https://example.blob.vercel-storage.com/meta.jpg',
          pathname: 'meta.jpg',
          mime: 'image/jpeg',
          width: 1920,
          height: 1080,
          favorite: false,
          created_at: new Date(),
          distance: 0.25,
        },
      ]);

      prisma.assetTag.findMany.mockResolvedValue([
        { assetId: 'asset-meta', tag: { name: 'funny' } },
        { assetId: 'asset-meta', tag: { name: 'cat' } },
        { assetId: 'asset-meta', tag: { name: 'meme' } },
      ]);

      const request = createMockRequest('POST', {
        query: testQuery,
        includeMetadata: true,
      });

      const response = await advancedSearchPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.results[0].metadata).toBeDefined();
      expect(data.results[0].metadata.tags).toEqual(['funny', 'cat', 'meme']);
      expect(data.results[0].metadata.searchScore).toBeDefined();
      expect(data.results[0].metadata.model).toBe('siglip-large');
    });
  });

  describe('Search Suggestions', () => {
    it('should return recent searches for user', async () => {
      const recentSearches = [
        {
          id: 'log-1',
          userId: testUserId,
          query: 'recent search 1',
          resultCount: 5,
          queryTime: 100,
          createdAt: new Date(),
        },
        {
          id: 'log-2',
          userId: testUserId,
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

      const response = await searchGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.searches).toHaveLength(2);
      expect(data.searches[0].query).toBe('recent search 1');
    });

    it('should return popular searches across all users', async () => {
      const popularSearches = [
        { query: 'trending meme', _count: { query: 100 } },
        { query: 'viral cat', _count: { query: 75 } },
        { query: 'funny dog', _count: { query: 50 } },
      ];

      prisma.searchLog.groupBy.mockResolvedValue(popularSearches);

      const request = createMockRequest('GET', null, {}, {
        type: 'popular',
      });

      const response = await searchGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.searches).toHaveLength(3);
      expect(data.searches[0].query).toBe('trending meme');
      expect(data.searches[0].count).toBe(100);
    });
  });

  describe('Cache Behavior', () => {
    it('should handle multi-layer cache warming', async () => {
      const mockCache = mockMultiLayerCache();

      // First request - cache miss
      mockCache.getSearchResults.mockResolvedValueOnce(null);

      const embeddingService = mockEmbeddingService();
      embeddingService.embedText.mockResolvedValue({
        embedding: mockEmbedding,
        model: 'siglip-large',
        dimension: 1152,
        processingTime: 100,
      });
      createEmbeddingService.mockReturnValue(embeddingService);

      vectorSearch.mockResolvedValue([
        {
          id: 'asset-1',
          blob_url: 'https://example.blob.vercel-storage.com/test.jpg',
          pathname: 'test.jpg',
          mime: 'image/jpeg',
          width: 1920,
          height: 1080,
          favorite: false,
          created_at: new Date(),
          distance: 0.25,
        },
      ]);
      prisma.assetTag.findMany.mockResolvedValue([]);
      logSearch.mockResolvedValue(undefined);

      getMultiLayerCache.mockReturnValue(mockCache);

      // First search - triggers cache population
      const request1 = createMockRequest('POST', {
        query: testQuery,
      });

      const response1 = await searchPOST(request1);
      const data1 = await response1.json();

      expect(response1.status).toBe(200);
      expect(data1.cached).toBe(false);
      expect(mockCache.setSearchResults).toHaveBeenCalled();

      // Second request - cache hit
      const cachedResults = data1.results;
      mockCache.getSearchResults.mockResolvedValueOnce(cachedResults);

      const request2 = createMockRequest('POST', {
        query: testQuery,
      });

      const response2 = await searchPOST(request2);
      const data2 = await response2.json();

      expect(response2.status).toBe(200);
      expect(data2.cached).toBe(true);
      expect(data2.results).toEqual(cachedResults);
    });

    it('should handle cache invalidation gracefully', async () => {
      const mockCache = mockMultiLayerCache();
      mockCache.getSearchResults.mockResolvedValue(null);
      mockCache.setSearchResults.mockRejectedValue(new Error('Cache service down'));
      getMultiLayerCache.mockReturnValue(mockCache);

      const embeddingService = mockEmbeddingService();
      embeddingService.embedText.mockResolvedValue({
        embedding: mockEmbedding,
        model: 'siglip-large',
        dimension: 1152,
        processingTime: 100,
      });
      createEmbeddingService.mockReturnValue(embeddingService);

      vectorSearch.mockResolvedValue([
        {
          id: 'asset-1',
          blob_url: 'https://example.blob.vercel-storage.com/test.jpg',
          pathname: 'test.jpg',
          mime: 'image/jpeg',
          width: 1920,
          height: 1080,
          favorite: false,
          created_at: new Date(),
          distance: 0.25,
        },
      ]);
      prisma.assetTag.findMany.mockResolvedValue([]);
      logSearch.mockResolvedValue(undefined);

      const request = createMockRequest('POST', {
        query: testQuery,
      });

      const response = await searchPOST(request);
      const data = await response.json();

      // Search should still succeed despite cache failure
      expect(response.status).toBe(200);
      expect(data.results).toHaveLength(1);
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle concurrent searches efficiently', async () => {
      const mockCache = mockMultiLayerCache();
      mockCache.getSearchResults.mockResolvedValue(null);
      getMultiLayerCache.mockReturnValue(mockCache);

      const embeddingService = mockEmbeddingService();
      embeddingService.embedText.mockResolvedValue({
        embedding: mockEmbedding,
        model: 'siglip-large',
        dimension: 1152,
        processingTime: 100,
      });
      createEmbeddingService.mockReturnValue(embeddingService);

      vectorSearch.mockResolvedValue([]);
      prisma.assetTag.findMany.mockResolvedValue([]);
      logSearch.mockResolvedValue(undefined);

      const queries = ['cat meme', 'dog meme', 'bird meme'];
      const searchPromises = queries.map(query => {
        const request = createMockRequest('POST', { query });
        return searchPOST(request);
      });

      const responses = await Promise.all(searchPromises);
      const results = await Promise.all(responses.map(r => r.json()));

      expect(responses).toHaveLength(3);
      expect(responses.every(r => r.status === 200)).toBe(true);
      expect(embeddingService.embedText).toHaveBeenCalledTimes(3);
      expect(vectorSearch).toHaveBeenCalledTimes(3);
    });

    it('should handle large result sets with pagination', async () => {
      const mockCache = mockMultiLayerCache();
      mockCache.getSearchResults.mockResolvedValue(null);
      getMultiLayerCache.mockReturnValue(mockCache);

      const embeddingService = mockEmbeddingService();
      embeddingService.embedText.mockResolvedValue({
        embedding: mockEmbedding,
        model: 'siglip-large',
        dimension: 1152,
        processingTime: 100,
      });
      createEmbeddingService.mockReturnValue(embeddingService);

      // Generate 100 mock results
      const largeResultSet = Array.from({ length: 100 }, (_, i) => ({
        id: `asset-${i}`,
        blob_url: `https://example.blob.vercel-storage.com/img${i}.jpg`,
        pathname: `img${i}.jpg`,
        mime: 'image/jpeg',
        width: 1920,
        height: 1080,
        favorite: false,
        created_at: new Date(),
        distance: 0.1 + (i * 0.001), // Increasing distance
      }));

      vectorSearch.mockResolvedValue(largeResultSet.slice(0, 30)); // Return first 30
      prisma.assetTag.findMany.mockResolvedValue([]);
      logSearch.mockResolvedValue(undefined);

      const request = createMockRequest('POST', {
        query: testQuery,
        limit: 30,
      });

      const response = await searchPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.results).toHaveLength(30);
      expect(vectorSearch).toHaveBeenCalledWith(
        testUserId,
        mockEmbedding,
        { limit: 30, threshold: 0.2 }
      );
    });
  });
});
