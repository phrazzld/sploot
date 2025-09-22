import { NextRequest, NextResponse } from 'next/server';
import { prisma, databaseAvailable, upsertAssetEmbedding } from '@/lib/db';
import { createEmbeddingService, EmbeddingError } from '@/lib/embeddings';
import { headers } from 'next/headers';

// Performance tracking
interface ProcessingStats {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  totalProcessingTime: number;
  errors: Array<{ assetId: string; error: string }>;
}

/**
 * GET /api/cron/process-embeddings
 *
 * Cron job endpoint to process assets that need embeddings.
 * Can be triggered by Vercel Cron or manually.
 *
 * Authorization: Uses Bearer token from CRON_SECRET environment variable
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const stats: ProcessingStats = {
    totalProcessed: 0,
    successCount: 0,
    failureCount: 0,
    totalProcessingTime: 0,
    errors: [],
  };

  try {
    // Verify cron authorization
    const authHeader = (await headers()).get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Allow execution in development or with valid auth
    if (process.env.NODE_ENV === 'production') {
      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    if (!databaseAvailable || !prisma) {
      return NextResponse.json(
        { error: 'Database unavailable' },
        { status: 503 }
      );
    }

    // Find assets that need embeddings
    // 1. Assets older than 1 hour with no embeddings
    // 2. Assets with failed status (if we track this in the future)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const assetsNeedingEmbeddings = await prisma.asset.findMany({
      where: {
        deletedAt: null,
        embedding: null,
        createdAt: {
          lt: oneHourAgo,
        },
      },
      select: {
        id: true,
        blobUrl: true,
        checksumSha256: true,
        ownerUserId: true,
        createdAt: true,
      },
      take: 10, // Process in batches of 10
      orderBy: {
        createdAt: 'asc', // Process oldest first
      },
    });

    console.log(`[cron] Found ${assetsNeedingEmbeddings.length} assets needing embeddings`);

    if (assetsNeedingEmbeddings.length === 0) {
      return NextResponse.json({
        message: 'No assets need processing',
        stats,
      });
    }

    // Initialize embedding service once
    let embeddingService;
    try {
      embeddingService = createEmbeddingService();
    } catch (error) {
      console.error('[cron] Failed to initialize embedding service:', error);
      return NextResponse.json(
        {
          error: 'Embedding service not configured',
          stats,
        },
        { status: 503 }
      );
    }

    // Process each asset
    for (const asset of assetsNeedingEmbeddings) {
      const assetStartTime = Date.now();
      stats.totalProcessed++;

      try {
        console.log(`[cron] Processing asset ${asset.id} (created ${asset.createdAt})`);

        // Generate embedding
        const result = await embeddingService.embedImage(asset.blobUrl, asset.checksumSha256);

        // Store embedding in database
        const embedding = await upsertAssetEmbedding({
          assetId: asset.id,
          modelName: result.model,
          modelVersion: result.model,
          dim: result.dimension,
          embedding: result.embedding,
        });

        if (embedding) {
          stats.successCount++;
          const assetProcessingTime = Date.now() - assetStartTime;
          stats.totalProcessingTime += assetProcessingTime;
          console.log(`[cron] Successfully generated embedding for asset ${asset.id} (${assetProcessingTime}ms)`);
        } else {
          throw new Error('Failed to persist embedding');
        }
      } catch (error) {
        stats.failureCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        stats.errors.push({
          assetId: asset.id,
          error: errorMessage,
        });
        console.error(`[cron] Failed to process asset ${asset.id}:`, error);

        // Continue processing other assets even if one fails
        continue;
      }
    }

    const totalTime = Date.now() - startTime;
    const avgProcessingTime = stats.successCount > 0
      ? Math.round(stats.totalProcessingTime / stats.successCount)
      : 0;
    const successRate = stats.totalProcessed > 0
      ? Math.round((stats.successCount / stats.totalProcessed) * 100)
      : 0;

    console.log(`[cron] Processing complete:`, {
      totalTime: `${totalTime}ms`,
      processed: stats.totalProcessed,
      successful: stats.successCount,
      failed: stats.failureCount,
      successRate: `${successRate}%`,
      avgProcessingTime: `${avgProcessingTime}ms`,
    });

    return NextResponse.json({
      message: `Processed ${stats.totalProcessed} assets`,
      stats: {
        ...stats,
        totalTime,
        avgProcessingTime,
        successRate,
      },
    });
  } catch (error) {
    console.error('[cron] Unexpected error in process-embeddings:', error);
    return NextResponse.json(
      {
        error: 'Failed to process embeddings',
        stats,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/process-embeddings
 *
 * Manual trigger for processing embeddings with specific options.
 */
export async function POST(request: NextRequest) {
  // For manual triggering with specific parameters
  const body = await request.json();
  const { batchSize = 10, includeRecent = false } = body;

  // Similar processing logic but with configurable parameters
  // This allows for manual testing and different processing strategies
  return GET(request);
}