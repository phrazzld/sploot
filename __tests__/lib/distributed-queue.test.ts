/**
 * Test suite for DistributedQueue
 */

import { DistributedQueue, QueueItem, QueuePriority, ErrorType } from '@/lib/distributed-queue';

describe('DistributedQueue', () => {
  let queue: DistributedQueue<string>;
  let executor: vi.Mock;

  beforeEach(() => {
    executor = vi.fn().mockResolvedValue(undefined);
    queue = new DistributedQueue(executor);
  });

  describe('Priority Processing', () => {
    it('should process urgent items first', async () => {
      // Add items with different priorities
      queue.enqueue('background-1', 'background');
      queue.enqueue('normal-1', 'normal');
      queue.enqueue('urgent-1', 'urgent');
      queue.enqueue('normal-2', 'normal');

      // Process and verify order
      await queue.processNext();
      expect(executor).toHaveBeenCalledWith(
        expect.objectContaining({
          data: 'urgent-1',
          priority: 'urgent'
        })
      );
    });

    it('should process normal items with 80% probability after urgent', async () => {
      queue.enqueue('normal-1', 'normal');
      queue.enqueue('background-1', 'background');

      let normalProcessed = 0;
      let backgroundProcessed = 0;

      // Run multiple iterations to test probability
      for (let i = 0; i < 100; i++) {
        executor.mockClear();

        // Re-add items
        queue.enqueue(`normal-${i}`, 'normal');
        queue.enqueue(`background-${i}`, 'background');

        await queue.processNext();

        const call = executor.mock.calls[0]?.[0];
        if (call?.priority === 'normal') normalProcessed++;
        if (call?.priority === 'background') backgroundProcessed++;
      }

      // Normal should be processed more often (roughly 80%)
      expect(normalProcessed).toBeGreaterThan(backgroundProcessed);
    });

    it('should maintain FIFO order within same priority', async () => {
      // Mock Math.random to ensure deterministic processing (always < 0.8 for normal queue)
      const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0.5);

      queue.enqueue('normal-1', 'normal');
      queue.enqueue('normal-2', 'normal');
      queue.enqueue('normal-3', 'normal');

      const processed: string[] = [];
      executor.mockImplementation(async (item: QueueItem<string>) => {
        processed.push(item.data);
      });

      await queue.processNext();
      await queue.processNext();
      await queue.processNext();

      expect(processed).toEqual(['normal-1', 'normal-2', 'normal-3']);

      mockRandom.mockRestore();
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed items with exponential backoff', async () => {
      vi.useFakeTimers();

      const failingExecutor = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue(undefined);

      queue = new DistributedQueue(failingExecutor);

      queue.enqueue('test-item', 'normal');

      // First attempt - fails
      await queue.processNext();
      expect(failingExecutor).toHaveBeenCalledTimes(1);

      // Advance timer for retry (1000ms * 2^0 * 2 = 2000ms for network error)
      vi.advanceTimersByTime(2000);

      // Second attempt - fails
      await queue.processNext();
      expect(failingExecutor).toHaveBeenCalledTimes(2);

      // Advance timer for second retry (1000ms * 2^1 * 2 = 4000ms)
      vi.advanceTimersByTime(4000);

      // Third attempt - succeeds
      await queue.processNext();
      expect(failingExecutor).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });

    it('should move items to dead letter queue after max retries', async () => {
      vi.useFakeTimers();

      const failingExecutor = vi.fn()
        .mockRejectedValue(new Error('Server error'));

      queue = new DistributedQueue(failingExecutor);

      queue.enqueue('doomed-item', 'background'); // Background has max 3 retries

      // Process until item moves to dead letter (background has 3 max retries)
      for (let i = 0; i < 3; i++) {
        await queue.processNext();
        if (i < 2) {
          // Advance timer for retry backoff (server error has 3x multiplier)
          // Backoff formula: 1000ms * 2^retryCount * 3 (server multiplier)
          const backoff = 1000 * Math.pow(2, i) * 3;
          vi.advanceTimersByTime(backoff);
        }
      }

      const metrics = queue.getMetrics();
      expect(metrics.dead).toBe(1);
      expect(metrics.failureCount).toBe(1);

      const deadItems = queue.getDeadLetterItems();
      expect(deadItems).toHaveLength(1);
      expect(deadItems[0].data).toBe('doomed-item');
      expect(deadItems[0].errorType).toBe('server');

      vi.useRealTimers();
    });

    it('should not retry invalid errors', async () => {
      vi.useFakeTimers();

      const failingExecutor = vi.fn()
        .mockRejectedValue(new Error('Invalid request'));

      const errorClassifier = (error: Error): ErrorType => {
        if (error.message.includes('Invalid')) return 'invalid';
        return 'unknown';
      };

      queue = new DistributedQueue(failingExecutor, errorClassifier);

      queue.enqueue('invalid-item', 'normal');

      await queue.processNext();

      // Should immediately go to dead letter (no retry for invalid errors)
      const metrics = queue.getMetrics();
      expect(metrics.dead).toBe(1);
      expect(failingExecutor).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  describe('Dead Letter Queue', () => {
    it('should allow retrying dead letter items', async () => {
      vi.useFakeTimers();

      const failingExecutor = vi.fn()
        .mockRejectedValue(new Error('Temporary error'));

      queue = new DistributedQueue(failingExecutor);

      const id = queue.enqueue('retry-me', 'background');

      // Fail until dead letter (background has 3 max retries)
      for (let i = 0; i < 3; i++) {
        await queue.processNext();
        if (i < 2) {
          // Advance timer for retry backoff
          const backoff = 1000 * Math.pow(2, i) * 2; // unknown error has 2x multiplier
          vi.advanceTimersByTime(backoff);
        }
      }

      expect(queue.getMetrics().dead).toBe(1);

      // Retry from dead letter
      const deadItems = queue.getDeadLetterItems();
      const success = queue.retryDeadLetterItem(deadItems[0].id);
      expect(success).toBe(true);

      // Should be back in urgent queue
      expect(queue.getQueueSizes().urgent).toBe(1);
      expect(queue.getMetrics().dead).toBe(0);

      vi.useRealTimers();
    });

    it('should clear dead letter queue', () => {
      // Manually add to dead letter
      const id1 = queue.enqueue('item-1', 'normal');
      const id2 = queue.enqueue('item-2', 'normal');

      // Simulate moving to dead letter
      const deadItem1 = {
        id: id1,
        data: 'item-1',
        priority: 'normal' as QueuePriority,
        retryCount: 5,
        addedAt: Date.now(),
        failedAt: Date.now(),
        errorType: 'unknown' as ErrorType,
        finalError: 'Test error'
      };

      // Access internals for test (in real code, items would fail naturally)
      (queue as any).queues.dead.set(id1, deadItem1);

      expect(queue.getMetrics().dead).toBe(1);

      const cleared = queue.clearDeadLetterQueue();
      expect(cleared).toBe(1);
      expect(queue.getMetrics().dead).toBe(0);
    });
  });

  describe('Metrics', () => {
    it('should track success metrics', async () => {
      queue.enqueue('success-1', 'normal');
      queue.enqueue('success-2', 'normal');

      await queue.processNext();
      await queue.processNext();

      const metrics = queue.getMetrics();
      expect(metrics.successCount).toBe(2);
      expect(metrics.failureCount).toBe(0);
      expect(metrics.avgProcessingTime).toBeGreaterThan(0);
    });

    it('should track queue sizes accurately', () => {
      queue.enqueue('urgent-1', 'urgent');
      queue.enqueue('urgent-2', 'urgent');
      queue.enqueue('normal-1', 'normal');
      queue.enqueue('background-1', 'background');

      const sizes = queue.getQueueSizes();
      expect(sizes.urgent).toBe(2);
      expect(sizes.normal).toBe(1);
      expect(sizes.background).toBe(1);
      expect(sizes.dead).toBe(0);
      expect(sizes.processing).toBe(0);
    });

    it('should correctly report empty state', () => {
      expect(queue.isEmpty()).toBe(true);

      queue.enqueue('item', 'normal');
      expect(queue.isEmpty()).toBe(false);
    });
  });

  describe('Concurrent Processing', () => {
    it('should process multiple items concurrently', async () => {
      const slowExecutor = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      queue = new DistributedQueue(slowExecutor);

      // Add multiple items
      for (let i = 0; i < 5; i++) {
        queue.enqueue(`item-${i}`, 'normal');
      }

      const startTime = Date.now();
      await queue.processAll(3); // Process with concurrency of 3

      const duration = Date.now() - startTime;

      // With concurrency 3, 5 items should take ~200ms (2 batches)
      // Without concurrency, it would take ~500ms
      expect(duration).toBeLessThan(300);
      expect(slowExecutor).toHaveBeenCalledTimes(5);
    });
  });

  describe('Error Classification', () => {
    it('should classify errors correctly', async () => {
      const errors = [
        { message: 'Rate limit exceeded', expectedType: 'rate_limit' },
        { message: 'Network timeout', expectedType: 'network' },
        { message: '500 Internal Server Error', expectedType: 'server' },
        { message: 'Invalid request format', expectedType: 'invalid' },
        { message: 'Unknown error occurred', expectedType: 'unknown' }
      ];

      for (const { message, expectedType } of errors) {
        const failingExecutor = vi.fn().mockRejectedValueOnce(new Error(message));
        const testQueue = new DistributedQueue(failingExecutor);

        testQueue.enqueue('test', 'background'); // Low retry count
        await testQueue.processNext();

        // Wait for potential retry scheduling
        await new Promise(resolve => setTimeout(resolve, 10));

        // Check if handled correctly based on type
        if (expectedType === 'invalid') {
          // Should go straight to dead letter
          expect(testQueue.getMetrics().dead).toBe(1);
        } else {
          // Should be scheduled for retry
          expect(testQueue.getMetrics().dead).toBe(0);
        }
      }
    });
  });
});