/**
 * Unit tests for TokenBucketRateLimiter
 *
 * Tests cover:
 * - Token consumption and refill mechanics
 * - Burst capacity handling
 * - Multi-user isolation
 * - Retry timing calculations
 * - Memory management (cleanup, max buckets)
 * - Edge cases (concurrent requests, time boundaries)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TokenBucketRateLimiter } from '@/lib/rate-limiter';

describe('TokenBucketRateLimiter', () => {
  let limiter: TokenBucketRateLimiter;
  const TEST_USER = 'user-123';
  const TEST_USER_2 = 'user-456';

  beforeEach(() => {
    // Create limiter with test-friendly values: 10 max tokens, 6 tokens/minute (0.1/sec)
    limiter = new TokenBucketRateLimiter(10, 6);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Token Consumption', () => {
    it('should allow request when tokens are available', async () => {
      const result = await limiter.consume(TEST_USER, 1);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9); // 10 - 1 = 9
      expect(result.retryAfter).toBeUndefined();
    });

    it('should consume multiple tokens at once', async () => {
      const result = await limiter.consume(TEST_USER, 5);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5); // 10 - 5 = 5
    });

    it('should reject when insufficient tokens', async () => {
      // Consume all tokens
      await limiter.consume(TEST_USER, 10);

      // Try to consume more
      const result = await limiter.consume(TEST_USER, 1);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should calculate correct retry time', async () => {
      // Consume all tokens
      await limiter.consume(TEST_USER, 10);

      // Try to consume 1 more token
      // Refill rate: 6 tokens/minute = 0.1 tokens/second
      // Need 1 token → 10 seconds wait
      const result = await limiter.consume(TEST_USER, 1);

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBe(10); // ceil(1 / 0.1) = 10 seconds
    });
  });

  describe('Token Refill', () => {
    it('should refill tokens over time', async () => {
      // Consume 5 tokens
      await limiter.consume(TEST_USER, 5);
      expect((await limiter.getBucketState(TEST_USER))?.tokens).toBeCloseTo(5, 1);

      // Advance time by 10 seconds (0.1 tokens/sec × 10 = 1 token)
      vi.advanceTimersByTime(10_000);

      const result = await limiter.consume(TEST_USER, 1);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5); // 5 + 1 - 1 = 5
    });

    it('should not exceed max token capacity', async () => {
      // Start with full bucket
      await limiter.consume(TEST_USER, 1); // 9 tokens left

      // Advance time by 2 minutes (should refill > 10 tokens, but capped at 10)
      vi.advanceTimersByTime(120_000);

      const state = await limiter.getBucketState(TEST_USER);
      expect(state?.tokens).toBeLessThanOrEqual(10);
      expect(state?.tokens).toBeGreaterThan(9);
    });

    it('should refill at correct rate', async () => {
      // Consume all tokens
      await limiter.consume(TEST_USER, 10);

      // Advance 1 minute (should add 6 tokens: 6 tokens/minute)
      vi.advanceTimersByTime(60_000);

      const state = await limiter.getBucketState(TEST_USER);
      expect(state?.tokens).toBeCloseTo(6, 1);
    });

    it('should handle fractional token refills', async () => {
      // Consume 5 tokens
      await limiter.consume(TEST_USER, 5);

      // Advance 5 seconds (0.1 tokens/sec × 5 = 0.5 tokens)
      vi.advanceTimersByTime(5_000);

      const state = await limiter.getBucketState(TEST_USER);
      expect(state?.tokens).toBeCloseTo(5.5, 1);
    });
  });

  describe('Burst Handling', () => {
    it('should allow burst of max tokens', async () => {
      const results = [];

      // Try to consume 10 tokens (full burst capacity)
      for (let i = 0; i < 10; i++) {
        results.push(await limiter.consume(TEST_USER, 1));
      }

      const allAllowed = results.every(r => r.allowed);
      expect(allAllowed).toBe(true);
    });

    it('should reject 101st request after burst', async () => {
      // Create limiter with 100 max tokens (production config)
      const prodLimiter = new TokenBucketRateLimiter(100, 10);

      // Consume 100 tokens
      for (let i = 0; i < 100; i++) {
        await prodLimiter.consume(TEST_USER, 1);
      }

      // 101st request should be rejected
      const result = await prodLimiter.consume(TEST_USER, 1);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should allow sustained rate after burst', async () => {
      // Create limiter with 10 max, 60 tokens/minute (1/sec)
      const fastLimiter = new TokenBucketRateLimiter(10, 60);

      // Burst: consume all 10 tokens
      for (let i = 0; i < 10; i++) {
        await fastLimiter.consume(TEST_USER, 1);
      }

      // Sustained: 1 request per second should work indefinitely
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(1_000); // Wait 1 second
        const result = await fastLimiter.consume(TEST_USER, 1);
        expect(result.allowed).toBe(true);
      }
    });
  });

  describe('Multi-User Isolation', () => {
    it('should maintain separate buckets per user', async () => {
      // User 1 consumes tokens
      await limiter.consume(TEST_USER, 5);

      // User 2 should have full bucket
      const result = await limiter.consume(TEST_USER_2, 1);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should not affect other users when one is rate limited', async () => {
      // Exhaust User 1's tokens
      await limiter.consume(TEST_USER, 10);
      const result1 = await limiter.consume(TEST_USER, 1);
      expect(result1.allowed).toBe(false);

      // User 2 should still have tokens
      const result2 = await limiter.consume(TEST_USER_2, 1);
      expect(result2.allowed).toBe(true);
    });

    it('should handle hundreds of concurrent users', async () => {
      const users = Array.from({ length: 500 }, (_, i) => `user-${i}`);
      const results = await Promise.all(
        users.map(userId => limiter.consume(userId, 1))
      );

      const allAllowed = results.every(r => r.allowed);
      expect(allAllowed).toBe(true);
    });
  });

  describe('Bucket State', () => {
    it('should return null for non-existent user', async () => {
      const state = await limiter.getBucketState('non-existent');
      expect(state).toBeNull();
    });

    it('should return current bucket state', async () => {
      await limiter.consume(TEST_USER, 3);

      const state = await limiter.getBucketState(TEST_USER);
      expect(state).not.toBeNull();
      expect(state?.tokens).toBeCloseTo(7, 1);
      expect(state?.lastRefill).toBeGreaterThan(0);
    });

    it('should calculate current tokens with refill in getBucketState', async () => {
      await limiter.consume(TEST_USER, 5);

      vi.advanceTimersByTime(30_000); // 30 seconds = 3 tokens

      const state = await limiter.getBucketState(TEST_USER);
      expect(state?.tokens).toBeCloseTo(8, 1); // 5 + 3 = 8
    });
  });

  describe('Memory Management', () => {
    it('should clean up old buckets after expiry', async () => {
      // Create bucket for user
      await limiter.consume(TEST_USER, 1);

      // Advance time beyond expiry (1 hour + 1ms)
      vi.advanceTimersByTime(60 * 60 * 1000 + 1);

      // Trigger cleanup by consuming for another user
      await limiter.consume(TEST_USER_2, 1);

      // Original user should have fresh bucket (not cleaned state)
      const state = await limiter.getBucketState(TEST_USER);
      expect(state).toBeNull(); // Bucket was cleaned up
    });

    it('should limit max buckets to prevent memory exhaustion', async () => {
      // Create limiter and consume for 10,001 users (exceeds MAX_BUCKETS)
      const users = Array.from({ length: 10_001 }, (_, i) => `user-${i}`);

      // Add small delays to ensure distinct timestamps for proper sorting
      for (let i = 0; i < users.length; i++) {
        await limiter.consume(users[i], 1);
        if (i % 100 === 0) {
          vi.advanceTimersByTime(1); // Advance 1ms every 100 users
        }
      }

      // Should have triggered cleanup to keep only 5000 newest
      // First 5001 buckets (0-5000) should be cleared, last 5000 (5001-10000) kept
      const stateFirst = await limiter.getBucketState(users[0]);
      const stateMiddle = await limiter.getBucketState(users[5000]);
      const stateLast = await limiter.getBucketState(users[10_000]);

      // Oldest buckets should be cleared
      expect(stateFirst).toBeNull();
      expect(stateMiddle).toBeNull();
      // Newest buckets should exist
      expect(stateLast).not.toBeNull();
    });

    it('should keep newest buckets when clearing oldest', async () => {
      // Create 100 users with staggered timestamps
      for (let i = 0; i < 100; i++) {
        vi.advanceTimersByTime(1000); // 1 second apart
        await limiter.consume(`user-${i}`, 1);
      }

      // Manually trigger cleanup (in real scenario, triggered at 10k buckets)
      // @ts-expect-error - accessing private method for testing
      limiter.clearOldestBuckets(50);

      // First 50 should be gone, last 50 should remain
      expect(await limiter.getBucketState('user-0')).toBeNull();
      expect(await limiter.getBucketState('user-99')).not.toBeNull();
    });
  });

  describe('Reset and Clear', () => {
    it('should reset individual user bucket', async () => {
      await limiter.consume(TEST_USER, 5);

      limiter.reset(TEST_USER);

      const state = await limiter.getBucketState(TEST_USER);
      expect(state).toBeNull();
    });

    it('should clear all buckets', async () => {
      await limiter.consume(TEST_USER, 1);
      await limiter.consume(TEST_USER_2, 1);

      limiter.clear();

      expect(await limiter.getBucketState(TEST_USER)).toBeNull();
      expect(await limiter.getBucketState(TEST_USER_2)).toBeNull();
    });

    it('should allow full tokens after reset', async () => {
      // Exhaust tokens
      await limiter.consume(TEST_USER, 10);

      limiter.reset(TEST_USER);

      // Should have full bucket again
      const result = await limiter.consume(TEST_USER, 10);
      expect(result.allowed).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero token consumption', async () => {
      const result = await limiter.consume(TEST_USER, 0);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
    });

    it('should handle concurrent requests from same user', async () => {
      // Simulate 5 concurrent requests
      const promises = Array.from({ length: 5 }, () =>
        limiter.consume(TEST_USER, 1)
      );

      const results = await Promise.all(promises);

      // All should succeed (10 tokens available)
      expect(results.every(r => r.allowed)).toBe(true);
    });

    it('should handle time boundaries correctly', async () => {
      // Consume tokens at end of second
      vi.setSystemTime(999);
      await limiter.consume(TEST_USER, 5);

      // Advance to start of next second
      vi.setSystemTime(1000);

      const result = await limiter.consume(TEST_USER, 1);
      expect(result.allowed).toBe(true);
    });

    it('should handle very small time intervals', async () => {
      await limiter.consume(TEST_USER, 5);

      // Advance 1ms (should refill ~0.0001 tokens)
      vi.advanceTimersByTime(1);

      const state = await limiter.getBucketState(TEST_USER);
      expect(state?.tokens).toBeGreaterThanOrEqual(5);
      expect(state?.tokens).toBeLessThan(5.01);
    });
  });

  describe('Production Configuration', () => {
    it('should match production rate limits', async () => {
      // Production: 100 max tokens, 10 tokens/minute
      const prodLimiter = new TokenBucketRateLimiter(100, 10);

      // Should allow burst of 100
      for (let i = 0; i < 100; i++) {
        const result = await prodLimiter.consume(TEST_USER, 1);
        expect(result.allowed).toBe(true);
      }

      // Should reject 101st
      const result = await prodLimiter.consume(TEST_USER, 1);
      expect(result.allowed).toBe(false);

      // Should allow sustained 10/minute
      vi.advanceTimersByTime(60_000); // 1 minute

      for (let i = 0; i < 10; i++) {
        const result = await prodLimiter.consume(TEST_USER, 1);
        expect(result.allowed).toBe(true);
      }
    });

    it('should calculate correct retry time for production rate', async () => {
      const prodLimiter = new TokenBucketRateLimiter(100, 10);

      // Exhaust tokens
      await prodLimiter.consume(TEST_USER, 100);

      // Try to consume 1 more
      // Refill: 10 tokens/minute = 1 token/6 seconds
      const result = await prodLimiter.consume(TEST_USER, 1);

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBe(6); // 1 token needs 6 seconds
    });
  });
});
