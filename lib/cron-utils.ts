import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

/**
 * Shared utilities for cron job endpoints
 */

// Performance tracking interface used by all cron jobs
export interface CronProcessingStats {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  totalProcessingTime: number;
  errors: Array<{ assetId: string; error: string }>;
}

// Stale claim threshold for optimistic locking (shared across all cron jobs)
export const STALE_CLAIM_MINUTES = 10;

/**
 * Initialize empty stats object for cron job
 */
export function initCronStats(): CronProcessingStats {
  return {
    totalProcessed: 0,
    successCount: 0,
    failureCount: 0,
    totalProcessingTime: 0,
    errors: [],
  };
}

/**
 * Verify cron job authorization using Bearer token
 *
 * @param request - Next.js request object
 * @returns Error response if unauthorized, null if authorized
 */
export async function verifyCronAuth(request: NextRequest): Promise<NextResponse | null> {
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

  return null; // Authorized
}

/**
 * Calculate next retry time based on retry count and backoff schedule
 *
 * @param retryCount - Current retry attempt number (0-indexed)
 * @param retryDelaysMs - Array of delay durations in milliseconds
 * @returns Next retry date, or null if max retries exceeded
 */
export function calculateNextRetry(
  retryCount: number,
  retryDelaysMs: number[]
): Date | null {
  const maxRetries = retryDelaysMs.length;

  if (retryCount >= maxRetries) {
    return null; // Max retries exceeded
  }

  const delay = retryDelaysMs[retryCount] ?? retryDelaysMs[retryDelaysMs.length - 1];
  return new Date(Date.now() + delay);
}

/**
 * Format cron job response with stats
 *
 * @param message - Success message
 * @param stats - Processing statistics
 * @param totalTime - Total execution time in milliseconds
 * @returns JSON response with formatted stats
 */
export function formatCronResponse(
  message: string,
  stats: CronProcessingStats,
  totalTime: number
): NextResponse {
  const avgProcessingTime = stats.successCount > 0
    ? Math.round(stats.totalProcessingTime / stats.successCount)
    : 0;

  const successRate = stats.totalProcessed > 0
    ? Math.round((stats.successCount / stats.totalProcessed) * 100)
    : 0;

  return NextResponse.json({
    message,
    stats: {
      ...stats,
      totalTime,
      avgProcessingTime,
      successRate,
    },
  });
}
