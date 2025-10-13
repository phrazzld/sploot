import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { processUploadedImage } from '@/lib/image-processing';
import { put } from '@vercel/blob';
import {
  initCronStats,
  verifyCronAuth,
  calculateNextRetry,
  formatCronResponse,
  STALE_CLAIM_MINUTES,
} from '@/lib/cron-utils';

// Exponential backoff schedule: 1min, 5min, 15min (max 3 retries)
// Shorter than embeddings since Sharp failures are more likely permanent
const RETRY_DELAYS_MS = [
  60 * 1000,        // 1 minute
  5 * 60 * 1000,    // 5 minutes
  15 * 60 * 1000,   // 15 minutes
];
const MAX_RETRIES = 3;

/**
 * GET /api/cron/process-images
 *
 * Cron job endpoint to process uploaded images asynchronously.
 * Downloads images from Blob, processes with Sharp (resize + thumbnail),
 * uploads processed versions, and updates asset records.
 *
 * Authorization: Uses Bearer token from CRON_SECRET environment variable
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const stats = initCronStats();

  try {
    // Verify cron authorization
    const authError = await verifyCronAuth(request);
    if (authError) {
      return authError;
    }

    if (!prisma) {
      return NextResponse.json(
        { error: 'Database unavailable' },
        { status: 503 }
      );
    }

    // Find unprocessed assets that are unclaimed or have stale claims
    const now = new Date();
    const staleClaimThreshold = new Date(Date.now() - STALE_CLAIM_MINUTES * 60 * 1000);
    const claimTime = new Date();

    const assetsNeedingProcessing = await prisma.asset.findMany({
      where: {
        deletedAt: null,
        processed: false,
        processingRetryCount: {
          lt: MAX_RETRIES, // Skip assets that hit max retries
        },
        OR: [
          {
            processingError: null, // Never failed
            processingClaimedAt: null, // Unclaimed
          },
          {
            processingNextRetry: { lt: now }, // Retry time has passed
            processingClaimedAt: null, // Unclaimed
          },
          {
            processingClaimedAt: { lt: staleClaimThreshold }, // Stale claims
          },
        ],
      },
      select: {
        id: true,
        blobUrl: true,
        pathname: true,
        mime: true,
        ownerUserId: true,
        createdAt: true,
        processingClaimedAt: true,
        processingRetryCount: true,
      },
      take: 10, // Process max 10 per invocation to avoid timeout
      orderBy: {
        createdAt: 'asc', // Process oldest first
      },
    });

    console.log(`[cron] Found ${assetsNeedingProcessing.length} assets needing processing`);

    if (assetsNeedingProcessing.length === 0) {
      return NextResponse.json({
        message: 'No assets need processing',
        stats,
      });
    }

    // Claim assets atomically using updateMany with WHERE condition
    // Only claim if still unclaimed (prevents race condition)
    const assetIds = assetsNeedingProcessing.map(a => a.id);
    const claimResult = await prisma.asset.updateMany({
      where: {
        id: { in: assetIds },
        OR: [
          { processingClaimedAt: null },
          { processingClaimedAt: { lt: staleClaimThreshold } },
        ],
      },
      data: {
        processingClaimedAt: claimTime,
      },
    });

    console.log(`[cron] Claimed ${claimResult.count} assets for processing`);

    // Verify which assets we successfully claimed by re-querying
    const claimedAssets = await prisma.asset.findMany({
      where: {
        id: { in: assetIds },
        processingClaimedAt: claimTime,
      },
      select: {
        id: true,
        blobUrl: true,
        pathname: true,
        mime: true,
        ownerUserId: true,
        createdAt: true,
        processingRetryCount: true,
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

    // Process only the assets we successfully claimed
    for (const asset of claimedAssets) {
      const assetStartTime = Date.now();
      stats.totalProcessed++;

      try {
        console.log(`[cron] Processing asset ${asset.id} (created ${asset.createdAt})`);

        // Download image from Blob
        const response = await fetch(asset.blobUrl);
        if (!response.ok) {
          throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Process image with Sharp
        const result = await processUploadedImage(buffer, asset.mime);

        // Upload processed main image (replace original)
        const mainBlob = await put(asset.pathname, result.main.buffer, {
          access: 'public',
          contentType: `image/${result.main.format}`,
        });

        // Upload thumbnail with -thumb suffix
        const thumbnailPathname = asset.pathname.replace(
          /\.([^.]+)$/,
          `-thumb.${result.thumbnail.format}`
        );
        const thumbnailBlob = await put(thumbnailPathname, result.thumbnail.buffer, {
          access: 'public',
          contentType: `image/${result.thumbnail.format}`,
        });

        // Update asset record with processed data, clear error and retry state, release claim
        await prisma.asset.update({
          where: { id: asset.id },
          data: {
            processed: true,
            thumbnailUrl: thumbnailBlob.url,
            thumbnailPath: thumbnailBlob.pathname,
            width: result.main.width,
            height: result.main.height,
            size: result.main.size,
            processingError: null,
            processingRetryCount: 0,
            processingNextRetry: null,
            processingClaimedAt: null, // Release claim
          },
        });

        stats.successCount++;
        const assetProcessingTime = Date.now() - assetStartTime;
        stats.totalProcessingTime += assetProcessingTime;
        console.log(`[cron] Successfully processed asset ${asset.id} (${assetProcessingTime}ms)`);
      } catch (error) {
        stats.failureCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        stats.errors.push({
          assetId: asset.id,
          error: errorMessage,
        });

        // Calculate next retry based on current count (0-indexed), then increment
        const nextRetry = calculateNextRetry(asset.processingRetryCount, RETRY_DELAYS_MS);
        const newRetryCount = asset.processingRetryCount + 1;

        // Update asset with error and retry info
        try {
          if (nextRetry === null) {
            // Max retries exceeded - mark as permanently failed and clear claim
            await prisma.asset.update({
              where: { id: asset.id },
              data: {
                processingError: `Max retries exceeded (${MAX_RETRIES}). Last error: ${errorMessage}`,
                processingRetryCount: newRetryCount,
                processingNextRetry: null,
                processingClaimedAt: null, // Release claim for permanent failures
              },
            });
            console.log(`[cron] Asset ${asset.id} permanently failed after ${MAX_RETRIES} retries`);
          } else {
            // Schedule retry with exponential backoff, clear claim so it can be retried
            await prisma.asset.update({
              where: { id: asset.id },
              data: {
                processingError: errorMessage,
                processingRetryCount: newRetryCount,
                processingNextRetry: nextRetry,
                processingClaimedAt: null, // Clear claim so it can be picked up again after delay
              },
            });
            console.log(`[cron] Asset ${asset.id} will retry at ${nextRetry.toISOString()} (attempt ${newRetryCount}/${MAX_RETRIES})`);
          }
        } catch (dbError) {
          console.error(`[cron] Failed to update error for asset ${asset.id}:`, dbError);
        }

        console.error(`[cron] Failed to process asset ${asset.id}:`, error);
        // Continue processing other assets
        continue;
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`[cron] Processing complete:`, {
      totalTime: `${totalTime}ms`,
      processed: stats.totalProcessed,
      successful: stats.successCount,
      failed: stats.failureCount,
    });

    return formatCronResponse(
      `Processed ${stats.totalProcessed} assets`,
      stats,
      totalTime
    );
  } catch (error) {
    console.error('[cron] Unexpected error in process-images:', error);
    return NextResponse.json(
      {
        error: 'Failed to process images',
        stats,
      },
      { status: 500 }
    );
  }
}
