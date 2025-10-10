import { NextRequest, NextResponse } from 'next/server';
import { prisma, upsertAssetEmbedding } from '@/lib/db';
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

// Exponential backoff schedule: 1min, 5min, 15min, 1hr, 6hr (max 5 retries)
const RETRY_DELAYS_MS = [
  60 * 1000,        // 1 minute
  5 * 60 * 1000,    // 5 minutes
  15 * 60 * 1000,   // 15 minutes
  60 * 60 * 1000,   // 1 hour
  6 * 60 * 60 * 1000, // 6 hours
];
const MAX_RETRIES = 5;

/**
 * Calculate next retry time based on retry count.
 * Returns null if max retries exceeded.
 */
function calculateNextRetry(retryCount: number): Date | null {
  if (retryCount >= MAX_RETRIES) {
    return null; // Max retries exceeded, no more retries
  }
  const delay = RETRY_DELAYS_MS[retryCount] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
  return new Date(Date.now() + delay);
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
    // Verify cron authorization - required in all environments
    const authHeader = (await headers()).get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json(
        { error: 'CRON_SECRET not configured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if ( !prisma) {
      return NextResponse.json(
        { error: 'Database unavailable' },
        { status: 503 }
      );
    }

    // Find assets that need embeddings that are unclaimed or have stale claims (>10min old)
    // Only process assets that have been image-processed (processed=true)
    // This ensures we don't try to embed unprocessed images
    const STALE_CLAIM_MINUTES = 10;
    const now = new Date();
    const staleClaimThreshold = new Date(Date.now() - STALE_CLAIM_MINUTES * 60 * 1000);
    const claimTime = new Date();

    const assetsNeedingEmbeddings = await prisma.asset.findMany({
      where: {
        deletedAt: null,
        processed: true, // Wait for image processing to complete
        embedded: false, // Not yet embedded
        embeddingRetryCount: {
          lt: MAX_RETRIES, // Skip assets that hit max retries
        },
        OR: [
          {
            embeddingNextRetry: null, // First attempt
            embeddingClaimedAt: null, // Unclaimed
          },
          {
            embeddingNextRetry: { lt: now }, // Retry time has passed
            embeddingClaimedAt: null, // Unclaimed
          },
          {
            embeddingClaimedAt: { lt: staleClaimThreshold }, // Stale claims
          },
        ],
      },
      select: {
        id: true,
        blobUrl: true,
        checksumSha256: true,
        ownerUserId: true,
        createdAt: true,
        embeddingRetryCount: true,
        embeddingClaimedAt: true,
      },
      take: 5, // Process max 5 per invocation to respect Replicate rate limits
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

    // Claim assets atomically using updateMany with WHERE condition
    // Only claim if still unclaimed (prevents race condition)
    const assetIds = assetsNeedingEmbeddings.map(a => a.id);
    const claimResult = await prisma.asset.updateMany({
      where: {
        id: { in: assetIds },
        OR: [
          { embeddingClaimedAt: null },
          { embeddingClaimedAt: { lt: staleClaimThreshold } },
        ],
      },
      data: {
        embeddingClaimedAt: claimTime,
      },
    });

    console.log(`[cron] Claimed ${claimResult.count} assets for embedding generation`);

    // Verify which assets we successfully claimed by re-querying
    const claimedAssets = await prisma.asset.findMany({
      where: {
        id: { in: assetIds },
        embeddingClaimedAt: claimTime,
      },
      select: {
        id: true,
        blobUrl: true,
        checksumSha256: true,
        ownerUserId: true,
        createdAt: true,
        embeddingRetryCount: true,
      },
    });

    if (claimedAssets.length === 0) {
      console.log(`[cron] Failed to claim any assets (lost race to another cron instance)`);
      return NextResponse.json({
        message: 'No assets claimed (concurrent execution)',
        stats,
      });
    }

    console.log(`[cron] Successfully claimed ${claimedAssets.length} assets`);

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

    // Process only the assets we successfully claimed
    for (const asset of claimedAssets) {
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

        if (!embedding) {
          throw new Error('Failed to persist embedding');
        }

        // Mark asset as embedded, reset retry counters, and clear claim
        await prisma.asset.update({
          where: { id: asset.id },
          data: {
            embedded: true,
            embeddingError: null,
            embeddingRetryCount: 0,
            embeddingNextRetry: null,
            embeddingClaimedAt: null, // Release claim
          },
        });

        stats.successCount++;
        const assetProcessingTime = Date.now() - assetStartTime;
        stats.totalProcessingTime += assetProcessingTime;
        console.log(`[cron] Successfully generated embedding for asset ${asset.id} (${assetProcessingTime}ms)`);
      } catch (error) {
        stats.failureCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        stats.errors.push({
          assetId: asset.id,
          error: errorMessage,
        });

        // Increment retry count and calculate next retry time
        const newRetryCount = asset.embeddingRetryCount + 1;
        const nextRetry = calculateNextRetry(newRetryCount);

        // Update asset with error and retry info
        try {
          if (nextRetry === null) {
            // Max retries exceeded - mark as permanently failed and clear claim
            await prisma.asset.update({
              where: { id: asset.id },
              data: {
                embeddingError: `Max retries exceeded (${MAX_RETRIES}). Last error: ${errorMessage}`,
                embeddingRetryCount: newRetryCount,
                embeddingNextRetry: null,
                embeddingClaimedAt: null, // Release claim for permanent failures
              },
            });
            console.log(`[cron] Asset ${asset.id} permanently failed after ${MAX_RETRIES} retries`);
          } else {
            // Schedule retry with exponential backoff, clear claim so it can be retried
            await prisma.asset.update({
              where: { id: asset.id },
              data: {
                embeddingError: errorMessage,
                embeddingRetryCount: newRetryCount,
                embeddingNextRetry: nextRetry,
                embeddingClaimedAt: null, // Clear claim so it can be picked up again after delay
              },
            });
            console.log(`[cron] Asset ${asset.id} will retry at ${nextRetry.toISOString()} (attempt ${newRetryCount}/${MAX_RETRIES})`);
          }
        } catch (dbError) {
          console.error(`[cron] Failed to update error for asset ${asset.id}:`, dbError);
        }

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