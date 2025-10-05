import { vi } from 'vitest';

/**
 * Centralized Prisma mock factory
 *
 * This file provides a single source of truth for Prisma mocking across all tests.
 * It prevents Vitest hoisting conflicts that occur when multiple test files mock
 * @prisma/client or @/lib/db differently.
 *
 * Usage in tests:
 *
 * ```ts
 * import { mockPrisma, setupPrismaMock } from '../mocks/prisma';
 *
 * vi.mock('@/lib/db', () => setupPrismaMock());
 *
 * // In test:
 * mockPrisma.asset.findFirst.mockResolvedValue({ ... });
 * ```
 */

// Create mock functions for all Prisma operations
export const mockPrisma = {
  asset: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  assetEmbedding: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  assetTag: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
  },
  tag: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  searchLog: {
    create: vi.fn(),
    findMany: vi.fn(),
    groupBy: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  $queryRaw: vi.fn(),
  $queryRawUnsafe: vi.fn(),
  $transaction: vi.fn(),
};

// Mock vector search function
export const mockVectorSearch = vi.fn();

// Mock log search function
export const mockLogSearch = vi.fn();

/**
 * Setup function for mocking @/lib/db
 * Use this in vi.mock('@/lib/db', setupPrismaMock)
 *
 * This provides mocked prisma/vectorSearch/logSearch while letting other exports
 * (like assetExists, findOrCreateAsset) use the actual implementations with the
 * mocked database client.
 */
export const setupPrismaMock = async () => {
  // Use dynamic import to avoid hoisting issues
  const { vi: vitestVi } = await import('vitest');
  const actual: any = await vitestVi.importActual('@/lib/db');

  return {
    ...actual,
    prisma: mockPrisma,
    vectorSearch: mockVectorSearch,
    logSearch: mockLogSearch,
    databaseAvailable: true,
  };
};

/**
 * Setup function for mocking @prisma/client directly
 * Use this when tests need to mock PrismaClient constructor
 */
export function setupPrismaClientMock() {
  return {
    PrismaClient: vi.fn().mockImplementation(() => mockPrisma),
    Prisma: {
      PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
        code: string;
        constructor(message: string, code: string) {
          super(message);
          this.code = code;
          this.name = 'PrismaClientKnownRequestError';
        }
      },
      PrismaClientValidationError: class PrismaClientValidationError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'PrismaClientValidationError';
        }
      },
    },
  };
}

/**
 * Reset all mocks - call in beforeEach/afterEach
 */
export function resetPrismaMocks() {
  Object.values(mockPrisma).forEach((model: any) => {
    if (typeof model === 'object') {
      Object.values(model).forEach((fn: any) => {
        if (typeof fn?.mockReset === 'function') {
          fn.mockReset();
        }
      });
    } else if (typeof model?.mockReset === 'function') {
      model.mockReset();
    }
  });

  mockVectorSearch.mockReset();
  mockLogSearch.mockReset();
}
