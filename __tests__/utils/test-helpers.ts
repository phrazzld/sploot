import { NextRequest } from 'next/server';
import { jest } from '@jest/globals';

// Mock Clerk auth
export const mockAuth = (userId: string | null = 'test-user-id') => {
  jest.mock('@clerk/nextjs/server', () => ({
    auth: jest.fn().mockResolvedValue({ userId }),
    currentUser: jest.fn().mockResolvedValue(
      userId
        ? {
            id: userId,
            emailAddresses: [{ emailAddress: 'test@example.com' }],
            firstName: 'Test',
            lastName: 'User',
          }
        : null
    ),
  }));
};

// Mock Prisma client
export const mockPrisma = () => {
  const mockAsset = {
    id: 'asset-123',
    ownerUserId: 'test-user-id',
    blobUrl: 'https://example.blob.vercel-storage.com/test.jpg',
    pathname: 'test.jpg',
    mime: 'image/jpeg',
    size: 1024000,
    checksumSha256: 'mock-checksum',
    width: 1920,
    height: 1080,
    favorite: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    phash: null,
  };

  const mockAssetEmbedding = {
    id: 'embedding-123',
    assetId: 'asset-123',
    imageEmbedding: Array(1152).fill(0.1),
    createdAt: new Date(),
  };

  return {
    asset: {
      create: jest.fn().mockResolvedValue(mockAsset),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([mockAsset]),
      findUnique: jest.fn().mockResolvedValue(mockAsset),
      update: jest.fn().mockResolvedValue({ ...mockAsset, favorite: true }),
      delete: jest.fn().mockResolvedValue(mockAsset),
      count: jest.fn().mockResolvedValue(10),
    },
    assetEmbedding: {
      create: jest.fn().mockResolvedValue(mockAssetEmbedding),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(mockAssetEmbedding),
      upsert: jest.fn().mockResolvedValue(mockAssetEmbedding),
    },
    assetTag: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({
        id: 'tag-123',
        assetId: 'asset-123',
        tagId: 'tag-456',
      }),
    },
    tag: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'tag-456',
        name: 'test-tag',
        userId: 'test-user-id',
      }),
    },
    searchLog: {
      create: jest.fn().mockResolvedValue({
        id: 'log-123',
        userId: 'test-user-id',
        query: 'test query',
        resultCount: 5,
        queryTime: 100,
        createdAt: new Date(),
      }),
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn().mockImplementation((callback) =>
      callback({
        asset: {
          create: jest.fn().mockResolvedValue(mockAsset),
          update: jest.fn().mockResolvedValue(mockAsset),
        },
        assetEmbedding: {
          create: jest.fn().mockResolvedValue(mockAssetEmbedding),
        },
      })
    ),
  };
};

// Create mock NextRequest
export const createMockRequest = (
  method: string,
  body?: any,
  headers?: Record<string, string>,
  searchParams?: Record<string, string>
): NextRequest => {
  const url = new URL('http://localhost:3000/api/test');

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const request = new NextRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // Mock json() method
  if (body) {
    (request as any).json = jest.fn().mockResolvedValue(body);
  }

  return request;
};

// Mock blob storage functions
export const mockBlobStorage = () => {
  return {
    put: jest.fn().mockResolvedValue({
      url: 'https://example.blob.vercel-storage.com/test.jpg',
      pathname: 'test.jpg',
      contentType: 'image/jpeg',
      contentDisposition: 'inline',
    }),
    del: jest.fn().mockResolvedValue(undefined),
    head: jest.fn().mockResolvedValue({
      size: 1024000,
      uploadedAt: new Date(),
      pathname: 'test.jpg',
      contentType: 'image/jpeg',
    }),
    list: jest.fn().mockResolvedValue({
      blobs: [],
      cursor: null,
      hasMore: false,
    }),
  };
};

// Mock embedding service
export const mockEmbeddingService = () => {
  return {
    embedText: jest.fn().mockResolvedValue({
      embedding: Array(1152).fill(0.1),
      model: 'siglip-large',
      dimension: 1152,
      processingTime: 100,
    }),
    embedImage: jest.fn().mockResolvedValue({
      embedding: Array(1152).fill(0.1),
      model: 'siglip-large',
      dimension: 1152,
      processingTime: 150,
    }),
    embedBatch: jest.fn().mockResolvedValue([
      {
        embedding: Array(1152).fill(0.1),
        model: 'siglip-large',
        dimension: 1152,
        processingTime: 100,
      },
    ]),
  };
};

// Mock cache service
export const mockCacheService = () => {
  return {
    getTextEmbedding: jest.fn().mockResolvedValue(null),
    setTextEmbedding: jest.fn().mockResolvedValue(undefined),
    getImageEmbedding: jest.fn().mockResolvedValue(null),
    setImageEmbedding: jest.fn().mockResolvedValue(undefined),
    getSearchResults: jest.fn().mockResolvedValue(null),
    setSearchResults: jest.fn().mockResolvedValue(undefined),
    invalidateUserData: jest.fn().mockResolvedValue(undefined),
    getUserAssetCount: jest.fn().mockResolvedValue(null),
    setUserAssetCount: jest.fn().mockResolvedValue(undefined),
    isHealthy: jest.fn().mockResolvedValue(true),
    getStats: jest.fn().mockResolvedValue({
      enabled: true,
      healthy: true,
    }),
  };
};

// Mock multi-layer cache
export const mockMultiLayerCache = () => {
  return {
    getTextEmbedding: jest.fn().mockResolvedValue(null),
    setTextEmbedding: jest.fn().mockResolvedValue(undefined),
    getImageEmbedding: jest.fn().mockResolvedValue(null),
    setImageEmbedding: jest.fn().mockResolvedValue(undefined),
    getSearchResults: jest.fn().mockResolvedValue(null),
    setSearchResults: jest.fn().mockResolvedValue(undefined),
    invalidateUserData: jest.fn().mockResolvedValue(undefined),
    warmCache: jest.fn().mockResolvedValue(undefined),
    startAutoWarming: jest.fn(),
    stopAutoWarming: jest.fn(),
    getStats: jest.fn().mockResolvedValue({
      l1Hits: 100,
      l1Misses: 20,
      l2Hits: 50,
      l2Misses: 10,
      totalRequests: 180,
      hitRate: 83.33,
      avgLatency: 5.2,
      lastReset: new Date(),
    }),
    isHealthy: jest.fn().mockResolvedValue({
      l1: true,
      l2: true,
      stats: {
        l1Hits: 100,
        l1Misses: 20,
        l2Hits: 50,
        l2Misses: 10,
        totalRequests: 180,
        hitRate: 83.33,
        avgLatency: 5.2,
        lastReset: new Date(),
      },
    }),
    clearL1Cache: jest.fn(),
    clearL2Cache: jest.fn().mockResolvedValue(undefined),
    clearAllCaches: jest.fn().mockResolvedValue(undefined),
    resetStats: jest.fn(),
  };
};

// Helper to parse response
export const parseResponse = async (response: Response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

// Add a dummy test to prevent Jest from complaining
describe('test-helpers', () => {
  it('exports helper functions', () => {
    expect(createMockRequest).toBeDefined();
    expect(mockPrisma).toBeDefined();
    expect(mockEmbeddingService).toBeDefined();
    expect(mockMultiLayerCache).toBeDefined();
  });
});