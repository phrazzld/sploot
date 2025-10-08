/**
 * Token bucket rate limiter for upload protection
 *
 * Algorithm:
 * - Each user has a bucket with max capacity (e.g., 100 tokens)
 * - Tokens refill at a constant rate (e.g., 10 tokens/minute)
 * - Each upload consumes 1 token
 * - If bucket empty, request is rate limited
 *
 * Benefits over alternatives:
 * - Fixed window: Allows bursts at window boundaries (100 at :59, 100 at :00)
 * - Sliding window: More complex, requires storing all request timestamps
 * - Token bucket: Allows controlled bursts, smooth refill, simple implementation
 */

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number; // Seconds to wait before retry
  remaining?: number; // Tokens remaining
}

export class TokenBucketRateLimiter {
  private buckets: Map<string, TokenBucket>;
  private maxTokens: number;
  private refillRate: number; // Tokens per second
  private cleanupInterval: NodeJS.Timeout | null;

  /**
   * @param maxTokens - Maximum tokens in bucket (burst capacity)
   * @param refillPerMinute - Tokens added per minute (sustained rate)
   */
  constructor(maxTokens: number = 100, refillPerMinute: number = 10) {
    this.buckets = new Map();
    this.maxTokens = maxTokens;
    this.refillRate = refillPerMinute / 60; // Convert to tokens per second
    this.cleanupInterval = null;

    // Clean up old buckets every 10 minutes to prevent memory leaks
    this.startCleanup();
  }

  /**
   * Attempt to consume tokens from user's bucket
   *
   * @param userId - Unique user identifier
   * @param tokens - Number of tokens to consume (default: 1)
   * @returns Result indicating if request is allowed and retry timing
   */
  async consume(userId: string, tokens: number = 1): Promise<RateLimitResult> {
    const now = Date.now();
    let bucket = this.buckets.get(userId);

    // Initialize bucket if it doesn't exist
    if (!bucket) {
      bucket = {
        tokens: this.maxTokens,
        lastRefill: now,
      };
      this.buckets.set(userId, bucket);
    }

    // Refill tokens based on time elapsed
    const elapsedMs = now - bucket.lastRefill;
    const elapsedSeconds = elapsedMs / 1000;
    const tokensToAdd = elapsedSeconds * this.refillRate;

    bucket.tokens = Math.min(this.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    // Check if enough tokens available
    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
      };
    }

    // Not enough tokens - calculate retry time
    const tokensNeeded = tokens - bucket.tokens;
    const secondsToWait = Math.ceil(tokensNeeded / this.refillRate);

    return {
      allowed: false,
      retryAfter: secondsToWait,
      remaining: 0,
    };
  }

  /**
   * Start periodic cleanup of old buckets to prevent memory leaks
   * Removes buckets that haven't been used in 1 hour
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const oneHourMs = 60 * 60 * 1000;

      for (const [userId, bucket] of this.buckets.entries()) {
        if (now - bucket.lastRefill > oneHourMs) {
          this.buckets.delete(userId);
        }
      }
    }, 10 * 60 * 1000); // Run every 10 minutes

    // Don't keep process alive for cleanup interval
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Stop cleanup interval (for testing or shutdown)
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get current state of a user's bucket (for debugging/monitoring)
   */
  getBucketState(userId: string): { tokens: number; lastRefill: number } | null {
    const bucket = this.buckets.get(userId);
    if (!bucket) return null;

    // Calculate current tokens with refill
    const now = Date.now();
    const elapsedSeconds = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = elapsedSeconds * this.refillRate;
    const currentTokens = Math.min(this.maxTokens, bucket.tokens + tokensToAdd);

    return {
      tokens: currentTokens,
      lastRefill: bucket.lastRefill,
    };
  }

  /**
   * Reset a user's bucket (for testing)
   */
  reset(userId: string): void {
    this.buckets.delete(userId);
  }

  /**
   * Clear all buckets (for testing)
   */
  clear(): void {
    this.buckets.clear();
  }
}

// Singleton instance for app-wide use
// Configuration: 100 tokens max, refill 10 per minute
// This allows bursts of 100 uploads, then sustained 10/minute
export const uploadRateLimiter = new TokenBucketRateLimiter(100, 10);
