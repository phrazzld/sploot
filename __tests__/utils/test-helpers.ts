import { NextRequest } from 'next/server';
import { jest } from '@jest/globals';

// Mock Clerk auth
export const mockAuth = (userId: string | null = 'test-user-id') => {
  jest.mock('@clerk/nextjs/server', () => ({
    auth: jest.fn<() => Promise<{ userId: string | null }>>().mockResolvedValue({ userId }),
    currentUser: jest.fn<() => Promise<any>>().mockResolvedValue(
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
      create: jest.fn<() => Promise<any>>().mockResolvedValue(mockAsset),
      findFirst: jest.fn<() => Promise<any>>().mockResolvedValue(null),
      findMany: jest.fn<() => Promise<any>>().mockResolvedValue([mockAsset]),
      findUnique: jest.fn<() => Promise<any>>().mockResolvedValue(mockAsset),
      update: jest.fn<() => Promise<any>>().mockResolvedValue({ ...mockAsset, favorite: true }),
      delete: jest.fn<() => Promise<any>>().mockResolvedValue(mockAsset),
      count: jest.fn<() => Promise<number>>().mockResolvedValue(10),
    },
    assetEmbedding: {
      create: jest.fn<() => Promise<any>>().mockResolvedValue(mockAssetEmbedding),
      findFirst: jest.fn<() => Promise<any>>().mockResolvedValue(null),
      findUnique: jest.fn<() => Promise<any>>().mockResolvedValue(null),
      update: jest.fn<() => Promise<any>>().mockResolvedValue(mockAssetEmbedding),
      upsert: jest.fn<() => Promise<any>>().mockResolvedValue(mockAssetEmbedding),
    },
    assetTag: {
      findMany: jest.fn<() => Promise<any>>().mockResolvedValue([]),
      deleteMany: jest.fn<() => Promise<any>>().mockResolvedValue({ count: 0 }),
      create: jest.fn<() => Promise<any>>().mockResolvedValue({
        id: 'tag-123',
        assetId: 'asset-123',
        tagId: 'tag-456',
      }),
    },
    tag: {
      findFirst: jest.fn<() => Promise<any>>().mockResolvedValue(null),
      create: jest.fn<() => Promise<any>>().mockResolvedValue({
        id: 'tag-456',
        name: 'test-tag',
        userId: 'test-user-id',
      }),
    },
    searchLog: {
      create: jest.fn<() => Promise<any>>().mockResolvedValue({
        id: 'log-123',
        userId: 'test-user-id',
        query: 'test query',
        resultCount: 5,
        queryTime: 100,
        createdAt: new Date(),
      }),
      findMany: jest.fn<() => Promise<any>>().mockResolvedValue([]),
      groupBy: jest.fn<() => Promise<any>>().mockResolvedValue([]),
    },
    $queryRaw: jest.fn<() => Promise<any>>().mockResolvedValue([]),
    $queryRawUnsafe: jest.fn<() => Promise<any>>().mockResolvedValue([]),
    $transaction: jest.fn<(callback: any) => Promise<any>>().mockImplementation((callback) =>
      callback({
        asset: {
          create: jest.fn<() => Promise<any>>().mockResolvedValue(mockAsset),
          update: jest.fn<() => Promise<any>>().mockResolvedValue(mockAsset),
        },
        assetEmbedding: {
          create: jest.fn<() => Promise<any>>().mockResolvedValue(mockAssetEmbedding),
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
    (request as any).json = jest.fn<() => Promise<any>>().mockResolvedValue(body);
  }

  return request;
};

// Mock blob storage functions
export const mockBlobStorage = () => {
  return {
    put: jest.fn<() => Promise<any>>().mockResolvedValue({
      url: 'https://example.blob.vercel-storage.com/test.jpg',
      pathname: 'test.jpg',
      contentType: 'image/jpeg',
      contentDisposition: 'inline',
    }),
    del: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    head: jest.fn<() => Promise<any>>().mockResolvedValue({
      size: 1024000,
      uploadedAt: new Date(),
      pathname: 'test.jpg',
      contentType: 'image/jpeg',
    }),
    list: jest.fn<() => Promise<any>>().mockResolvedValue({
      blobs: [],
      cursor: null,
      hasMore: false,
    }),
  };
};

// Mock embedding service
export const mockEmbeddingService = () => {
  return {
    embedText: jest.fn<() => Promise<any>>().mockResolvedValue({
      embedding: Array(1152).fill(0.1),
      model: 'siglip-large',
      dimension: 1152,
      processingTime: 100,
    }),
    embedImage: jest.fn<() => Promise<any>>().mockResolvedValue({
      embedding: Array(1152).fill(0.1),
      model: 'siglip-large',
      dimension: 1152,
      processingTime: 150,
    }),
    embedBatch: jest.fn<() => Promise<any[]>>().mockResolvedValue([
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
    getTextEmbedding: jest.fn<() => Promise<any>>().mockResolvedValue(null),
    setTextEmbedding: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    getImageEmbedding: jest.fn<() => Promise<any>>().mockResolvedValue(null),
    setImageEmbedding: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    getSearchResults: jest.fn<() => Promise<any>>().mockResolvedValue(null),
    setSearchResults: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    invalidateUserData: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    getUserAssetCount: jest.fn<() => Promise<any>>().mockResolvedValue(null),
    setUserAssetCount: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    isHealthy: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    getStats: jest.fn<() => Promise<any>>().mockResolvedValue({
      enabled: true,
      healthy: true,
    }),
  };
};

// Mock multi-layer cache
export const mockMultiLayerCache = () => {
  return {
    getTextEmbedding: jest.fn<() => Promise<any>>().mockResolvedValue(null),
    setTextEmbedding: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    getImageEmbedding: jest.fn<() => Promise<any>>().mockResolvedValue(null),
    setImageEmbedding: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    getSearchResults: jest.fn<() => Promise<any>>().mockResolvedValue(null),
    setSearchResults: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    invalidateUserData: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    warmCache: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    startAutoWarming: jest.fn<() => void>(),
    stopAutoWarming: jest.fn<() => void>(),
    getStats: jest.fn<() => any>().mockReturnValue({
      l1Hits: 100,
      l1Misses: 20,
      l2Hits: 50,
      l2Misses: 10,
      totalRequests: 180,
      hitRate: 83.33,
      avgLatency: 5.2,
      lastReset: new Date(),
    }),
    isHealthy: jest.fn<() => Promise<any>>().mockResolvedValue({
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
    clearL1Cache: jest.fn<() => void>(),
    clearL2Cache: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    clearAllCaches: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    resetStats: jest.fn<() => void>(),
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
