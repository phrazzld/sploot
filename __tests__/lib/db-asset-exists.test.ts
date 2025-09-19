import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { ExistingAssetMetadata } from '@/lib/db';

// Mock Prisma client
const mockPrisma = {
  asset: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

// Mock the db module before importing functions that use it
jest.mock('@/lib/db', () => {
  const actual = jest.requireActual('@/lib/db');
  return {
    ...actual,
    prisma: mockPrisma,
    databaseAvailable: true,
  };
});

// Import after mocking
const { assetExists, findOrCreateAsset } = require('@/lib/db');

describe('assetExists', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

      expect(result).toEqual<ExistingAssetMetadata>({
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
      });

      expect(mockPrisma.asset.findFirst).toHaveBeenCalledWith({
        where: {
          ownerUserId: mockUserId,
          checksumSha256: mockChecksum,
          deletedAt: null,
        },
        select: expect.objectContaining({
          id: true,
          blobUrl: true,
          thumbnailUrl: true,
          pathname: true,
        }),
      });
    });

    it('should include embedding status when requested', async () => {
      const assetWithEmbedding = {
        ...mockAsset,
        embedding: { assetId: mockAsset.id },
      };
      mockPrisma.asset.findFirst.mockResolvedValue(assetWithEmbedding);

      const result = await assetExists(mockUserId, mockChecksum, {
        includeEmbedding: true,
      });

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

  describe('when database is not available', () => {
    it('should return null gracefully', async () => {
      const originalPrisma = (global as any).prisma;
      (global as any).prisma = null;

      const result = await assetExists(mockUserId, mockChecksum);

      expect(result).toBeNull();

      (global as any).prisma = originalPrisma;
    });
  });

  describe('error handling', () => {
    it('should return null on database error', async () => {
      mockPrisma.asset.findFirst.mockRejectedValue(new Error('Database error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await assetExists(mockUserId, mockChecksum);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error checking asset existence:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});

describe('findOrCreateAsset', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockUserId = 'user123';
  const mockAssetData = {
    checksumSha256: 'abc123def456',
    blobUrl: 'https://example.com/image.jpg',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    pathname: '/user123/image.jpg',
    thumbnailPath: '/user123/thumb.jpg',
    mime: 'image/jpeg',
    width: 1920,
    height: 1080,
    size: 1024000,
  };

  describe('when asset does not exist', () => {
    it('should create new asset within transaction', async () => {
      const createdAsset = {
        id: 'new123',
        ...mockAssetData,
        favorite: false,
        createdAt: new Date(),
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        // Mock transaction context
        const txMock = {
          asset: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(createdAsset),
          },
        };
        return callback(txMock);
      });

      const result = await findOrCreateAsset(mockUserId, mockAssetData);

      expect(result).toEqual<ExistingAssetMetadata>({
        id: createdAsset.id,
        blobUrl: createdAsset.blobUrl,
        thumbnailUrl: createdAsset.thumbnailUrl,
        pathname: createdAsset.pathname,
        mime: createdAsset.mime,
        size: createdAsset.size,
        width: createdAsset.width,
        height: createdAsset.height,
        checksumSha256: createdAsset.checksumSha256,
        favorite: createdAsset.favorite,
        createdAt: createdAsset.createdAt,
      });
    });
  });

  describe('when asset already exists', () => {
    it('should return existing asset without creating', async () => {
      const existingAsset = {
        id: 'existing123',
        ...mockAssetData,
        favorite: true,
        createdAt: new Date('2024-01-01'),
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const txMock = {
          asset: {
            findFirst: jest.fn().mockResolvedValue(existingAsset),
            create: jest.fn(),
          },
        };
        return callback(txMock);
      });

      const result = await findOrCreateAsset(mockUserId, mockAssetData);

      expect(result.id).toBe(existingAsset.id);
      expect(result.favorite).toBe(true);
    });
  });

  describe('race condition handling', () => {
    it('should handle unique constraint violation gracefully', async () => {
      const existingAsset = {
        id: 'existing123',
        ...mockAssetData,
        favorite: false,
        createdAt: new Date(),
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const txMock = {
          asset: {
            findFirst: jest.fn()
              .mockResolvedValueOnce(null) // First check: not found
              .mockResolvedValueOnce(existingAsset), // Second check after error: found
            create: jest.fn().mockRejectedValue(
              new Error('Unique constraint failed on the fields: (`owner_user_id`,`checksum_sha256`)')
            ),
          },
        };
        return callback(txMock);
      });

      const result = await findOrCreateAsset(mockUserId, mockAssetData);

      expect(result.id).toBe(existingAsset.id);
    });
  });

  describe('error handling', () => {
    it('should throw error when database is not available', async () => {
      const originalPrisma = (global as any).prisma;
      (global as any).prisma = null;

      await expect(
        findOrCreateAsset(mockUserId, mockAssetData)
      ).rejects.toThrow('Database not available');

      (global as any).prisma = originalPrisma;
    });

    it('should propagate non-constraint errors', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('Connection failed'));

      await expect(
        findOrCreateAsset(mockUserId, mockAssetData)
      ).rejects.toThrow('Connection failed');
    });
  });
});