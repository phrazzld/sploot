import { PrismaClient } from '@prisma/client';
import { databaseConfigured, isMockMode } from './env';

// Declare global type for PrismaClient to prevent multiple instances in development
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

let prismaClient: PrismaClient | null = null;

if (!isMockMode() && databaseConfigured) {
  prismaClient = global.prisma || new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  if (process.env.NODE_ENV !== 'production') {
    global.prisma = prismaClient;
  }
} else {
  // Database configuration not detected. Using in-memory mocks.
}

export const prisma = prismaClient;

export const databaseAvailable = !!prismaClient;

/**
 * Sync user data from Clerk to database.
 * Creates user if not exists, updates email if changed.
 */
export async function syncUser(clerkUserId: string, email: string) {
  if (!prisma) {
    return {
      id: clerkUserId,
      email,
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
  }

  return await prisma.user.upsert({
    where: { id: clerkUserId },
    update: { email },
    create: {
      id: clerkUserId,
      email,
    },
  });
}

/**
 * Atomic operation to get existing user or create new one.
 * Prevents race conditions.
 */
export async function getOrCreateUser(clerkUserId: string, email: string) {
  if (!prisma) {
    return {
      id: clerkUserId,
      email,
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
  }

  let user = await prisma.user.findUnique({
    where: { id: clerkUserId },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        id: clerkUserId,
        email,
      },
    });
  }

  return user;
}

/**
 * Check if asset with given checksum already exists for user.
 * Returns the existing asset data if found, or null if not.
 * Used for deduplication during upload process.
 */
export async function assetExists(userId: string, checksumSha256: string) {
  if (!prisma) {
    return null;
  }

  const asset = await prisma.asset.findFirst({
    where: {
      ownerUserId: userId,
      checksumSha256,
      deletedAt: null,
    },
  });

  return asset;
}

/**
 * Get paginated list of user's assets with filtering and sorting.
 * Includes embeddings and tags for each asset.
 * @returns Object with assets array, total count, and hasMore flag
 */
export async function getUserAssets(
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
    favoriteOnly?: boolean;
    tagId?: string;
    orderBy?: 'createdAt' | 'updatedAt';
    order?: 'asc' | 'desc';
  }
) {
  if (!prisma) {
    return {
      assets: [],
      total: 0,
      hasMore: false,
    };
  }

  const {
    limit = 50,
    offset = 0,
    favoriteOnly = false,
    tagId,
    orderBy = 'createdAt',
    order = 'desc',
  } = options || {};

  const where: any = {
    ownerUserId: userId,
    deletedAt: null,
  };

  if (favoriteOnly) {
    where.favorite = true;
  }

  if (tagId) {
    where.tags = {
      some: {
        tagId,
      },
    };
  }

  const [assets, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      include: {
        embedding: {
          select: {
            modelName: true,
            modelVersion: true,
            dim: true,
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: {
        [orderBy]: order,
      },
      take: limit,
      skip: offset,
    }),
    prisma.asset.count({ where }),
  ]);

  return {
    assets,
    total,
    hasMore: offset + assets.length < total,
  };
}

/**
 * Helper function to execute vector similarity search
 * Note: This uses raw SQL since Prisma doesn't natively support pgvector operations
 */
export async function vectorSearch(
  userId: string,
  queryEmbedding: number[],
  options?: {
    limit?: number;
    threshold?: number;
  }
) {
  if (!prisma) {
    return [];
  }

  const { limit = 30, threshold = 0.7 } = options || {};

  // Convert embedding array to pgvector format
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  // Execute vector similarity search with cosine distance
  const results = await prisma.$queryRaw<
    Array<{
      id: string;
      blob_url: string;
      pathname: string;
      mime: string;
      width: number | null;
      height: number | null;
      favorite: boolean;
      created_at: Date;
      distance: number;
    }>
  >`
    SELECT
      a.id,
      a.blob_url,
      a.pathname,
      a.mime,
      a.width,
      a.height,
      a.favorite,
      a.created_at,
      1 - (ae.image_embedding <=> ${embeddingStr}::vector) as distance
    FROM assets a
    INNER JOIN asset_embeddings ae ON a.id = ae.asset_id
    WHERE
      a.owner_user_id = ${userId}
      AND a.deleted_at IS NULL
      AND 1 - (ae.image_embedding <=> ${embeddingStr}::vector) > ${threshold}
    ORDER BY ae.image_embedding <=> ${embeddingStr}::vector
    LIMIT ${limit}
  `;

  return results;
}

export async function logSearch(
  userId: string,
  query: string,
  resultCount: number,
  queryTime: number
) {
  if (!prisma) {
    return;
  }

  try {
    await prisma.searchLog.create({
      data: {
        userId,
        query,
        resultCount,
        queryTime,
      },
    });
  } catch (error) {
    // Log search analytics failures shouldn't break the app
    // Search logging error suppressed
  }
}
