import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExistingAssetMetadata } from '@/lib/db';

// Mock Prisma client with proper typing
const mockPrisma = {
  asset: {
    findFirst: vi.fn() as vi.MockedFunction<any>,
    create: vi.fn() as vi.MockedFunction<any>,
  },
  $transaction: vi.fn() as vi.MockedFunction<any>,
};

// Mock the db module
vi.mock('@/lib/db', () => ({
  prisma: null,
  databaseAvailable: true,
  assetExists: vi.fn(),
  findOrCreateAsset: vi.fn(),
}));

// Import and setup mocks
import * as db from '@/lib/db';

// Replace with actual implementations that use our mock
(db as any).prisma = mockPrisma;

// Import actual implementations to test
const { assetExists, findOrCreateAsset } = vi.importActual('@/lib/db') as typeof db;

describe('assetExists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockUserId = 'user123';
  const mockChecksum = 'abc123def456';
  const mockAsset = {
    id: 'asset123',
    blobUrl: 'https://example.com/image.jpg',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    pathname: '/user123/image.jpg',
    mime: 'image/jpeg',
    size: 1024000,
    width: 1920,
    height: 1080,
    checksumSha256: mockChecksum,
    favorite: false,
    createdAt: new Date('2024-01-01'),
  };

  describe('when asset exists', () => {
    it('should return typed asset metadata', async () => {
      mockPrisma.asset.findFirst.mockResolvedValue(mockAsset);

      const result = await assetExists(mockUserId, mockChecksum);

      expect(result).toEqual({
        id: mockAsset.id,
        blobUrl: mockAsset.blobUrl,
        thumbnailUrl: mockAsset.thumbnailUrl,
        pathname: mockAsset.pathname,
        mime: mockAsset.mime,
        size: mockAsset.size,
        width: mockAsset.width,
        height: mockAsset.height,
        checksumSha256: mockAsset.checksumSha256,
        favorite: mockAsset.favorite,
        createdAt: mockAsset.createdAt,
        hasEmbedding: false,
      });
    });

    it('should use transaction when provided', async () => {
      const mockTx = {
        asset: {
          findFirst: vi.fn() as vi.MockedFunction<any>,
        },
      };
      mockTx.asset.findFirst.mockResolvedValue(mockAsset);

      await assetExists(mockUserId, mockChecksum, { tx: mockTx as any });

      expect(mockTx.asset.findFirst).toHaveBeenCalledTimes(1);
      expect(mockPrisma.asset.findFirst).not.toHaveBeenCalled();
    });

    it('should include embedding flag when requested', async () => {
      mockPrisma.asset.findFirst.mockResolvedValue({
        ...mockAsset,
        embedding: {
          assetId: mockAsset.id,
        },
      });

      const result = await assetExists(mockUserId, mockChecksum, { includeEmbedding: true });

      expect(result?.hasEmbedding).toBe(true);
    });
  });

  describe('when asset does not exist', () => {
    it('should return null', async () => {
      mockPrisma.asset.findFirst.mockResolvedValue(null);

      const result = await assetExists(mockUserId, mockChecksum);

      expect(result).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should throw when database error occurs', async () => {
      mockPrisma.asset.findFirst.mockRejectedValue(new Error('Database error'));

      await expect(assetExists(mockUserId, mockChecksum)).rejects.toThrow('Database error');
    });
  });
});

describe('findOrCreateAsset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockUserId = 'user123';
  const mockAssetData = {
    checksumSha256: 'checksum123',
    blobUrl: 'https://example.com/new-image.jpg',
    thumbnailUrl: 'https://example.com/new-thumb.jpg',
    pathname: '/user123/new-image.jpg',
    thumbnailPath: '/user123/new-thumb.jpg',
    mime: 'image/png',
    width: 800,
    height: 600,
    size: 512000,
  };

  const mockCreatedAsset = {
    id: 'newAsset123',
    ...mockAssetData,
    favorite: false,
    createdAt: new Date('2024-01-02'),
  };

  describe('when asset does not exist', () => {
    it('should create new asset', async () => {
      // Mock transaction
      const mockTxAsset = {
        findFirst: (vi.fn() as vi.MockedFunction<any>).mockResolvedValue(null),
        create: (vi.fn() as vi.MockedFunction<any>).mockResolvedValue(mockCreatedAsset),
      };

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        const mockTx = {
          asset: mockTxAsset,
        };
        return callback(mockTx);
      });

      const result = await findOrCreateAsset(mockUserId, mockAssetData);

      expect(result).toEqual({
        id: mockCreatedAsset.id,
        blobUrl: mockCreatedAsset.blobUrl,
        thumbnailUrl: mockCreatedAsset.thumbnailUrl,
        pathname: mockCreatedAsset.pathname,
        mime: mockCreatedAsset.mime,
        size: mockCreatedAsset.size,
        width: mockCreatedAsset.width,
        height: mockCreatedAsset.height,
        checksumSha256: mockCreatedAsset.checksumSha256,
        favorite: mockCreatedAsset.favorite,
        createdAt: mockCreatedAsset.createdAt,
        hasEmbedding: false,
      });
    });
  });

  describe('when asset already exists', () => {
    it('should return existing asset', async () => {
      const existingAsset = {
        ...mockCreatedAsset,
        id: 'existingAsset123',
      };

      // Mock transaction
      const mockTxAsset = {
        findFirst: (vi.fn() as vi.MockedFunction<any>).mockResolvedValue(existingAsset),
        create: vi.fn() as vi.MockedFunction<any>,
      };

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        const mockTx = {
          asset: mockTxAsset,
        };
        return callback(mockTx);
      });

      const result = await findOrCreateAsset(mockUserId, mockAssetData);

      expect(mockTxAsset.create).not.toHaveBeenCalled();
      expect(result.id).toBe('existingAsset123');
    });
  });

  describe('race condition handling', () => {
    it('should handle unique constraint violation', async () => {
      const existingAsset = {
        ...mockCreatedAsset,
        id: 'raceAsset123',
      };

      // Mock transaction - first call for create attempt
      let callCount = 0;
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        callCount++;

        if (callCount === 1) {
          // First call: asset doesn't exist, try to create but fails
          const mockTx = {
            asset: {
              findFirst: (vi.fn() as vi.MockedFunction<any>).mockResolvedValue(null),
              create: (vi.fn() as vi.MockedFunction<any>).mockRejectedValue({ code: 'P2002' }),
            },
          };
          return callback(mockTx);
        } else {
          // Second call: find the existing asset
          const mockTx = {
            asset: {
              findFirst: (vi.fn() as vi.MockedFunction<any>).mockResolvedValue(existingAsset),
            },
          };
          return callback(mockTx);
        }
      });

      const result = await findOrCreateAsset(mockUserId, mockAssetData);

      expect(result.id).toBe('raceAsset123');
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('should throw on other errors', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('Unexpected error'));

      await expect(findOrCreateAsset(mockUserId, mockAssetData)).rejects.toThrow('Unexpected error');
    });
  });
});