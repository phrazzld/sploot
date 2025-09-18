import { NextRequest, NextResponse } from 'next/server';
import { getMultiLayerCache, createMultiLayerCache } from '@/lib/multi-layer-cache';
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

    const multiCache = getMultiLayerCache() || createMultiLayerCache();
    const health = await multiCache.isHealthy();
    const stats = multiCache.getStats();

    // Calculate cache effectiveness metrics
    const effectiveHitRate = stats.totalRequests > 0
      ? (stats.hits / stats.totalRequests * 100).toFixed(2)
      : '0.00';

    return NextResponse.json({
      status: 'healthy',
      cache: {
        status: health.l1 ? 'active' : 'inactive',
        hits: stats.hits,
        misses: stats.misses,
        hitRate: stats.totalRequests > 0
          ? ((stats.hits / stats.totalRequests) * 100).toFixed(2)
          : '0.00',
      },
      overall: {
        totalRequests: stats.totalRequests,
        totalHits: stats.hits,
        totalMisses: stats.misses,
        hitRate: `${effectiveHitRate}%`,
        avgLatency: `${stats.avgLatency.toFixed(2)}ms`,
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

    const multiCache = getMultiLayerCache() || createMultiLayerCache();

    switch (action) {
      case 'reset-stats':
        multiCache.resetStats();
        return NextResponse.json({
          message: 'Cache statistics reset successfully',
          timestamp: new Date(),
        });

      case 'clear-l1':
        multiCache.clearL1Cache();
        return NextResponse.json({
          message: 'L1 cache cleared successfully',
          timestamp: new Date(),
        });

      case 'clear-l2':
        await multiCache.clearL2Cache();
        return NextResponse.json({
          message: 'L2 cache cleared successfully',
          timestamp: new Date(),
        });

      case 'clear-all':
        await multiCache.clearAllCaches();
        return NextResponse.json({
          message: 'All caches cleared successfully',
          timestamp: new Date(),
        });

      case 'warm':
        // Start cache warming for the user
        multiCache.startAutoWarming(userId);
        return NextResponse.json({
          message: 'Cache warming started',
          userId,
          timestamp: new Date(),
        });

      case 'invalidate':
        // Invalidate user-specific cache entries
        await multiCache.invalidateUserData(userId);
        return NextResponse.json({
          message: 'User cache invalidated',
          userId,
          timestamp: new Date(),
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: reset-stats, clear-l1, clear-l2, clear-all, warm, or invalidate' },
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
