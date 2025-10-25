import { NextRequest, NextResponse } from 'next/server';
import { getCacheService } from '@/lib/cache';
import { getAuth } from '@/lib/auth/server';

// GET /api/cache/stats - Get cache statistics
export async function GET(req: NextRequest) {
  try {
    const { userId } = await getAuth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const cache = getCacheService();
    const stats = cache.getStats();

    // Calculate cache effectiveness metrics
    const effectiveHitRate = stats.totalRequests > 0
      ? (stats.hitRate * 100).toFixed(2)
      : '0.00';

    return NextResponse.json({
      status: 'healthy',
      cache: {
        status: 'active',
        hits: stats.hits,
        misses: stats.misses,
        hitRate: (stats.hitRate * 100).toFixed(2),
      },
      overall: {
        totalRequests: stats.totalRequests,
        totalHits: stats.hits,
        totalMisses: stats.misses,
        hitRate: `${effectiveHitRate}%`,
      },
      performance: {
        meetsTarget: parseFloat(effectiveHitRate) >= 80,
        targetHitRate: '80%',
        currentHitRate: `${effectiveHitRate}%`,
      },
      lastReset: stats.lastReset,
    });
  } catch (error) {
    // Error fetching cache stats
    return NextResponse.json(
      { error: 'Failed to fetch cache statistics' },
      { status: 500 }
    );
  }
}

// POST /api/cache/stats - Reset cache statistics
export async function POST(req: NextRequest) {
  try {
    const { userId } = await getAuth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    const cache = getCacheService();

    switch (action) {
      case 'reset-stats':
        cache.resetStats();
        return NextResponse.json({
          message: 'Cache statistics reset successfully',
          timestamp: new Date(),
        });

      case 'clear-l1':
      case 'clear-l2':
      case 'clear-all':
      case 'invalidate':
        // Unified memory cache - all clear operations do the same thing
        await cache.clear();
        return NextResponse.json({
          message: 'Cache cleared successfully',
          timestamp: new Date(),
        });

      case 'warm':
        // Cache warming not implemented in MVP (documented in BACKLOG.md)
        return NextResponse.json({
          message: 'Cache warming not available in memory-only mode',
          timestamp: new Date(),
        }, { status: 501 });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: reset-stats, clear-all, or invalidate' },
          { status: 400 }
        );
    }
  } catch (error) {
    // Error managing cache
    return NextResponse.json(
      { error: 'Failed to manage cache' },
      { status: 500 }
    );
  }
}
