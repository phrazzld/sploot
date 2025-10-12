import { NextRequest, NextResponse } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
import { requireUserIdWithSync } from '@/lib/auth/server';
import { prisma } from '@/lib/db';

/**
 * POST /api/assets/[id]/retry-processing
 *
 * Retries image processing for a failed asset.
 * Resets error state and retry count, allowing cron job to pick it up.
 *
 * Returns updated processing status.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Validate authentication
    const userId = await requireUserIdWithSync();
    const { id } = await params;

    if (!prisma) {
      return NextResponse.json(
        { error: 'Database unavailable' },
        { status: 503 }
      );
    }

    // Fetch asset with ownership validation
    const asset = await prisma.asset.findUnique({
      where: {
        id,
        ownerUserId: userId,
        deletedAt: null,
      },
      select: {
        id: true,
        processed: true,
        processingError: true,
        processingRetryCount: true,
      },
    });

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Validate that asset has a processing error
    if (!asset.processingError) {
      return NextResponse.json(
        { error: 'Asset does not have a processing error' },
        { status: 400 }
      );
    }

    // Reset processing error and retry count
    const updatedAsset = await prisma.asset.update({
      where: {
        id,
      },
      data: {
        processingError: null,
        processingRetryCount: 0,
        processingNextRetry: null,
        processingClaimedAt: null, // Release any stale claim
      },
      select: {
        processed: true,
        embedded: true,
        processingError: true,
        embeddingError: true,
        processingRetryCount: true,
        embeddingRetryCount: true,
      },
    });

    console.log(`[retry-processing] Reset error for asset ${id}, will be picked up by cron`);

    return NextResponse.json({
      success: true,
      status: {
        processed: updatedAsset.processed,
        embedded: updatedAsset.embedded,
        processingError: updatedAsset.processingError,
        embeddingError: updatedAsset.embeddingError,
        processingRetryCount: updatedAsset.processingRetryCount,
        embeddingRetryCount: updatedAsset.embeddingRetryCount,
      },
    });
  } catch (error) {
    unstable_rethrow(error);
    console.error('[retry-processing] Error retrying processing:', error);
    return NextResponse.json(
      { error: 'Failed to retry processing' },
      { status: 500 }
    );
  }
}
