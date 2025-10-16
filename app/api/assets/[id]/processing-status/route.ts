import { NextRequest, NextResponse } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
import { requireUserIdWithSync } from '@/lib/auth/server';
import { prisma } from '@/lib/db';

// Simple in-memory cache for processing status (5 second TTL)
interface CachedStatus {
  status: ProcessingStatus;
  timestamp: number;
}

interface ProcessingStatus {
  processed: boolean;
  embedded: boolean;
  processingError: string | null;
  embeddingError: string | null;
  processingRetryCount: number;
  embeddingRetryCount: number;
}

const CACHE_TTL_MS = 5000; // 5 seconds
const statusCache = new Map<string, CachedStatus>();

// Clean up stale cache entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of statusCache.entries()) {
    if (now - value.timestamp > 60000) { // Remove entries older than 1 minute
      statusCache.delete(key);
    }
  }
}, 60000);

/**
 * GET /api/assets/[id]/processing-status
 *
 * Returns processing and embedding status for a single asset.
 * Uses efficient caching (5s TTL) to reduce database load.
 *
 * Response format:
 * {
 *   processed: boolean,
 *   embedded: boolean,
 *   processingError: string | null,
 *   embeddingError: string | null,
 *   processingRetryCount: number,
 *   embeddingRetryCount: number,
 *   timestamp: string
 * }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

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

    // Check cache first
    const cacheKey = `${userId}:${id}`;
    const cached = statusCache.get(cacheKey);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
      return NextResponse.json({
        ...cached.status,
        timestamp: new Date(cached.timestamp).toISOString(),
        cached: true,
      });
    }

    // Fetch asset with ownership validation
    const asset = await prisma.asset.findFirst({
      where: {
        id,
        ownerUserId: userId,
        deletedAt: null,
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

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    const status: ProcessingStatus = {
      processed: asset.processed,
      embedded: asset.embedded,
      processingError: asset.processingError,
      embeddingError: asset.embeddingError,
      processingRetryCount: asset.processingRetryCount,
      embeddingRetryCount: asset.embeddingRetryCount,
    };

    // Update cache
    statusCache.set(cacheKey, {
      status,
      timestamp: now,
    });

    const duration = Date.now() - startTime;
    console.log(`[processing-status] Fetched status for asset ${id} in ${duration}ms`);

    return NextResponse.json({
      ...status,
      timestamp: new Date(now).toISOString(),
      cached: false,
    });
  } catch (error) {
    unstable_rethrow(error);
    console.error('[processing-status] Error fetching status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch processing status' },
      { status: 500 }
    );
  }
}
