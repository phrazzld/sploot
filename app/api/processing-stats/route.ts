import { NextRequest, NextResponse } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
import { requireUserIdWithSync } from '@/lib/auth/server';
import { prisma } from '@/lib/db';

// Simple in-memory cache for stats (5 second TTL)
interface CachedStats {
  stats: ProcessingStats;
  timestamp: number;
  userId: string;
}

interface ProcessingStats {
  total: number;
  uploaded: number;
  processing: number;
  embedding: number;
  ready: number;
  failed: number;
}

const CACHE_TTL_MS = 5000; // 5 seconds
const statsCache = new Map<string, CachedStats>();

/**
 * GET /api/processing-stats
 *
 * Returns aggregated queue statistics for the authenticated user.
 * Uses efficient COUNT queries and caches results for 5 seconds.
 *
 * Response format:
 * {
 *   stats: {
 *     total: number,        // Total assets
 *     uploaded: number,     // Uploaded but not processed
 *     processing: number,   // Processing in progress
 *     embedding: number,    // Embedding in progress
 *     ready: number,        // Fully processed and embedded
 *     failed: number        // Failed processing or embedding
 *   },
 *   timestamp: string       // ISO timestamp of stats
 * }
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Validate authentication
    const userId = await requireUserIdWithSync();

    if (!prisma) {
      return NextResponse.json(
        { error: 'Database unavailable' },
        { status: 503 }
      );
    }

    // Check cache first
    const cached = statsCache.get(userId);
    const now = Date.now();

    // Clean up stale entries inline (serverless-compatible)
    for (const [key, value] of statsCache.entries()) {
      if (now - value.timestamp > 60000) { // Remove entries older than 1 minute
        statsCache.delete(key);
      }
    }

    if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
      return NextResponse.json({
        stats: cached.stats,
        timestamp: new Date(cached.timestamp).toISOString(),
        cached: true,
      });
    }

    // Fetch fresh stats with parallel queries for efficiency
    const [
      total,
      uploaded,
      processing,
      embedding,
      ready,
      failed,
    ] = await Promise.all([
      // Total assets (excluding deleted)
      prisma.asset.count({
        where: {
          ownerUserId: userId,
          deletedAt: null,
        },
      }),
      // Uploaded but not processed
      prisma.asset.count({
        where: {
          ownerUserId: userId,
          deletedAt: null,
          processed: false,
          processingError: null,
        },
      }),
      // Processing (has error, will retry or manual intervention needed)
      prisma.asset.count({
        where: {
          ownerUserId: userId,
          deletedAt: null,
          processed: false,
          processingError: { not: null },
        },
      }),
      // Embedding (processed but not embedded, no error)
      prisma.asset.count({
        where: {
          ownerUserId: userId,
          deletedAt: null,
          processed: true,
          embedded: false,
          embeddingError: null,
        },
      }),
      // Ready (fully processed and embedded)
      prisma.asset.count({
        where: {
          ownerUserId: userId,
          deletedAt: null,
          processed: true,
          embedded: true,
        },
      }),
      // Failed (has embedding error)
      prisma.asset.count({
        where: {
          ownerUserId: userId,
          deletedAt: null,
          embeddingError: { not: null },
        },
      }),
    ]);

    const stats: ProcessingStats = {
      total,
      uploaded,
      processing,
      embedding,
      ready,
      failed,
    };

    // Update cache
    statsCache.set(userId, {
      stats,
      timestamp: now,
      userId,
    });

    const duration = Date.now() - startTime;
    console.log(`[processing-stats] Fetched stats for user ${userId} in ${duration}ms`);

    return NextResponse.json({
      stats,
      timestamp: new Date(now).toISOString(),
      cached: false,
    });
  } catch (error) {
    unstable_rethrow(error);
    console.error('[processing-stats] Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch processing stats' },
      { status: 500 }
    );
  }
}
