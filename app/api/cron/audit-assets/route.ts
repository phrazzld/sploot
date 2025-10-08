import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { headers } from 'next/headers';

interface AuditStats {
  totalAssets: number;
  validCount: number;
  brokenCount: number;
  errorCount: number;
  usersAffected: number;
  brokenAssetIds: string[];
}

interface UserAuditResult {
  userId: string;
  brokenCount: number;
  brokenAssets: Array<{
    id: string;
    blobUrl: string;
    filename: string;
  }>;
}

/**
 * GET /api/cron/audit-assets
 *
 * Daily cron job to audit all blob URLs across all users.
 * Detects broken blobs (404/403) and logs alerts if >10 broken assets found.
 *
 * Authorization: Uses Bearer token from CRON_SECRET environment variable
 * Schedule: Daily via Vercel Cron (configured in vercel.json)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const stats: AuditStats = {
    totalAssets: 0,
    validCount: 0,
    brokenCount: 0,
    errorCount: 0,
    usersAffected: 0,
    brokenAssetIds: [],
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

    // Fetch all non-deleted assets across all users
    const assets = await prisma.asset.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        blobUrl: true,
        pathname: true,
        ownerUserId: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    stats.totalAssets = assets.length;
    console.log(`[cron] Auditing ${assets.length} assets across all users...`);

    if (assets.length === 0) {
      return NextResponse.json({
        message: 'No assets to audit',
        stats,
        totalTime: Date.now() - startTime,
      });
    }

    // Track broken assets per user for reporting
    const userAuditMap = new Map<string, UserAuditResult>();

    // Validate each blob URL with HEAD request
    for (const asset of assets) {
      try {
        // Use HEAD request to check if blob exists without downloading
        const response = await fetch(asset.blobUrl, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000), // 5s timeout
        });

        if (response.ok) {
          stats.validCount++;
        } else {
          // 404 (Not Found), 403 (Forbidden), or other error status
          stats.brokenCount++;
          stats.brokenAssetIds.push(asset.id);

          // Track per user
          if (!userAuditMap.has(asset.ownerUserId)) {
            userAuditMap.set(asset.ownerUserId, {
              userId: asset.ownerUserId,
              brokenCount: 0,
              brokenAssets: [],
            });
          }

          const userResult = userAuditMap.get(asset.ownerUserId)!;
          userResult.brokenCount++;
          userResult.brokenAssets.push({
            id: asset.id,
            blobUrl: asset.blobUrl,
            filename: asset.pathname.split('/').pop() || asset.pathname,
          });
        }
      } catch (err) {
        // Network error, timeout, or other fetch failure
        stats.errorCount++;
        console.error(`[cron] Error checking asset ${asset.id}:`, err);
      }
    }

    stats.usersAffected = userAuditMap.size;
    const totalTime = Date.now() - startTime;

    // Log summary
    const percentBroken = stats.totalAssets > 0
      ? ((stats.brokenCount / stats.totalAssets) * 100).toFixed(2)
      : '0.00';

    console.log(`[cron] Audit complete:`, {
      totalTime: `${totalTime}ms`,
      totalAssets: stats.totalAssets,
      valid: stats.validCount,
      broken: stats.brokenCount,
      errors: stats.errorCount,
      percentBroken: `${percentBroken}%`,
      usersAffected: stats.usersAffected,
    });

    // ALERT: If >10 broken blobs found, log detailed alert
    if (stats.brokenCount > 10) {
      console.error(`[cron] 🚨 ALERT: ${stats.brokenCount} broken blobs detected!`);
      console.error(`[cron] Users affected: ${stats.usersAffected}`);

      // Log per-user breakdown for debugging
      for (const [userId, userResult] of userAuditMap.entries()) {
        console.error(`[cron]   User ${userId}: ${userResult.brokenCount} broken assets`);
        // Log first 3 broken assets per user for debugging
        userResult.brokenAssets.slice(0, 3).forEach((asset) => {
          console.error(`[cron]     - ${asset.id}: ${asset.filename}`);
        });
      }

      // TODO: Send email alert via Vercel Email API or SendGrid
      // For now, console alerts are sufficient for monitoring via Vercel logs
    }

    // Return detailed stats
    return NextResponse.json({
      message: `Audited ${stats.totalAssets} assets`,
      stats: {
        ...stats,
        totalTime,
        percentBroken,
      },
      alert: stats.brokenCount > 10 ? 'Critical: >10 broken blobs detected' : null,
      affectedUsers: Array.from(userAuditMap.entries()).map(([userId, result]) => ({
        userId,
        brokenCount: result.brokenCount,
      })),
    });
  } catch (error) {
    console.error('[cron] Unexpected error in audit-assets:', error);
    return NextResponse.json(
      {
        error: 'Failed to audit assets',
        stats,
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}