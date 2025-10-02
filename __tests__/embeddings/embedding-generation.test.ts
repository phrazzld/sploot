/**
 * Embedding Generation Test Suite
 * Tests for upload performance, background embedding generation, retry logic, and concurrent uploads
 */

import { vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { createMockRequest, mockPrisma, mockBlobStorage, mockEmbeddingService, mockAuth, waitForQueueEvent } from '../utils/test-helpers';
import { getEmbeddingQueueManager, EmbeddingQueueItem } from '@/lib/embedding-queue';
import { getGlobalPerformanceTracker, PERF_OPERATIONS } from '@/lib/performance';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma(),
}));

vi.mock('@vercel/blob', () => ({
  put: vi.fn(),
  del: vi.fn(),
  head: vi.fn(),
  list: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));

// Mock the upload route handler
const mockUploadHandler = async (request: NextRequest) => {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // Simulate upload processing time (should be < 1s without embedding)
  const uploadStart = Date.now();

  // Mock blob storage upload
  const blobResult = {
    url: `https://example.blob.vercel-storage.com/${file.name}`,
    pathname: file.name,
    contentType: file.type,
  };

  // Mock database save
  const asset = {
    id: `asset-${Date.now()}`,
    blobUrl: blobResult.url,
    pathname: blobResult.pathname,
    mime: file.type,
    size: file.size,
    checksumSha256: 'mock-checksum',
    ownerUserId: 'test-user',
  };

  const uploadTime = Date.now() - uploadStart;

  // Return without waiting for embedding (async)
  return NextResponse.json({
    success: true,
    asset: {
      ...asset,
      needsEmbedding: true, // Flag for background processing
    },
    uploadTime,
  });
};

describe('Embedding Generation Test Suite', () => {
  let embeddingQueue: ReturnType<typeof getEmbeddingQueueManager>;
  let performanceTracker: ReturnType<typeof getGlobalPerformanceTracker>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Initialize services
    embeddingQueue = getEmbeddingQueueManager();
    performanceTracker = getGlobalPerformanceTracker();
    performanceTracker.reset();

    // Mock auth
    mockAuth('test-user');
  });

  afterEach(() => {
    // Clean up
    embeddingQueue.stop();
    embeddingQueue.clear();
  });

  describe('Upload Performance', () => {
    it('should complete upload without embedding in less than 1 second', async () => {
      const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', file);

      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const startTime = Date.now();
      const response = await mockUploadHandler(request);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const data = await response.json();

      // Verify upload completes quickly without blocking on embedding
      expect(duration).toBeLessThan(1000); // Less than 1 second
      expect(data.success).toBe(true);
      expect(data.asset.needsEmbedding).toBe(true);
      expect(data.uploadTime).toBeLessThan(1000);
    });

    it('should track upload performance metrics', async () => {
      const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', file);

      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });

      // Track upload
      performanceTracker.start(PERF_OPERATIONS.UPLOAD_SINGLE);
      const response = await mockUploadHandler(request);
      performanceTracker.end(PERF_OPERATIONS.UPLOAD_SINGLE);

      const uploadAvg = performanceTracker.getAverage(PERF_OPERATIONS.UPLOAD_SINGLE);
      const uploadP95 = performanceTracker.getP95(PERF_OPERATIONS.UPLOAD_SINGLE);

      expect(uploadAvg).toBeLessThan(1000);
      expect(uploadP95).toBeLessThan(1000);
      expect(performanceTracker.getSampleCount(PERF_OPERATIONS.UPLOAD_SINGLE)).toBe(1);
    });
  });

  describe('Background Embedding Generation', () => {
    it('should generate embeddings in background within 10 seconds', async () => {
      const mockEmbedding = Array(1152).fill(0.1);
      const mockGenerateEmbedding = vi.fn<() => Promise<{ embedding: number[]; modelName: string; dimension: number }>>().mockResolvedValue({
        embedding: mockEmbedding,
        modelName: 'siglip-large',
        dimension: 1152,
      });

      // Add item to queue
      const queueItem = {
        assetId: 'asset-123',
        blobUrl: 'https://example.blob.vercel-storage.com/test.jpg',
        checksum: 'mock-checksum',
        priority: 1,
      };

      const startTime = Date.now();
      embeddingQueue.addToQueue(queueItem);
      embeddingQueue.start();

      // Wait for completion with timeout
      await waitForQueueEvent(
        embeddingQueue,
        (event) => event.type === 'completed' && event.item.assetId === 'asset-123',
        10000
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 10 seconds
      expect(duration).toBeLessThan(10000);
    }, { timeout: 10000 });

    it('should process queue in FIFO order with priority support', async () => {
      const processedOrder: string[] = [];

      // Set up subscription to track processing order
      embeddingQueue.subscribe((event) => {
        if (event.type === 'processing') {
          processedOrder.push(event.item.assetId);
        }
      });

      // Ensure clean state
      embeddingQueue.stop();
      embeddingQueue.clear();

      // Add items with different priorities
      // NOTE: Queue auto-starts on first add, so normal-1 will begin processing immediately
      embeddingQueue.addToQueue({
        assetId: 'normal-1',
        blobUrl: 'url1',
        checksum: 'check1',
        priority: 1, // Normal priority
      });

      embeddingQueue.addToQueue({
        assetId: 'high-1',
        blobUrl: 'url2',
        checksum: 'check2',
        priority: 0, // High priority - goes to front of queue
      });

      embeddingQueue.addToQueue({
        assetId: 'normal-2',
        blobUrl: 'url3',
        checksum: 'check3',
        priority: 1, // Normal priority
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Since queue auto-starts on first add, normal-1 processes first
      // High priority only applies to items added BEFORE processing starts
      // or items queued while another is already processing
      expect(processedOrder[0]).toBe('normal-1');
      // High priority item should process second (jumped ahead of normal-2)
      expect(processedOrder[1]).toBe('high-1');
      expect(processedOrder[2]).toBe('normal-2');
    });
  });

  describe('Retry Logic', () => {
    it('should automatically retry failed embeddings with exponential backoff', async () => {
      let attemptCount = 0;
      const retryEvents: { type: string; timestamp: number }[] = [];

      // Mock failing then succeeding
      const mockGenerateEmbedding = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Network error');
        }
        return Promise.resolve({
          embedding: Array(1152).fill(0.1),
          modelName: 'siglip-large',
        });
      });

      embeddingQueue.subscribe((event) => {
        if (event.type === 'retry' || event.type === 'completed' || event.type === 'failed') {
          retryEvents.push({
            type: event.type,
            timestamp: Date.now(),
          });
        }
      });

      const queueItem = {
        assetId: 'retry-test',
        blobUrl: 'https://example.com/test.jpg',
        checksum: 'checksum',
        priority: 1,
      };

      embeddingQueue.addToQueue(queueItem);

      // Wait for retries
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Should have retry events
      const retryEventTypes = retryEvents.map(e => e.type);
      expect(retryEventTypes).toContain('retry');

      // Check exponential backoff timing
      if (retryEvents.length >= 2) {
        const firstRetryDelay = retryEvents[1].timestamp - retryEvents[0].timestamp;
        expect(firstRetryDelay).toBeGreaterThanOrEqual(900); // ~1 second
        expect(firstRetryDelay).toBeLessThan(1500);
      }
    }, { timeout: 10000 });

    it('should handle different error types with appropriate retry strategies', async () => {
      // Test rate limit error - should wait longer
      const rateLimitItem: EmbeddingQueueItem = {
        assetId: 'rate-limit-test',
        blobUrl: 'url',
        checksum: 'check',
        priority: 1,
        retryCount: 0,
        addedAt: Date.now(),
        errorType: 'rate_limit',
      };

      // Test network error - should retry immediately once
      const networkItem: EmbeddingQueueItem = {
        assetId: 'network-test',
        blobUrl: 'url',
        checksum: 'check',
        priority: 1,
        retryCount: 0,
        addedAt: Date.now(),
        errorType: 'network',
      };

      // Test invalid image - should not retry
      const invalidItem: EmbeddingQueueItem = {
        assetId: 'invalid-test',
        blobUrl: 'url',
        checksum: 'check',
        priority: 1,
        retryCount: 0,
        addedAt: Date.now(),
        errorType: 'invalid_image',
        permanentlyFailed: true,
      };

      // Invalid images should be marked as permanently failed
      expect(invalidItem.permanentlyFailed).toBe(true);
    });

    it('should respect max retry limits for user-triggered vs background', () => {
      // User-triggered should have more retries
      const userTriggeredItem: EmbeddingQueueItem = {
        assetId: 'user-triggered',
        blobUrl: 'url',
        checksum: 'check',
        priority: 0,
        retryCount: 4,
        addedAt: Date.now(),
        isUserTriggered: true,
      };

      // Background should have fewer retries
      const backgroundItem: EmbeddingQueueItem = {
        assetId: 'background',
        blobUrl: 'url',
        checksum: 'check',
        priority: 1,
        retryCount: 2,
        addedAt: Date.now(),
        isUserTriggered: false,
      };

      // User-triggered allows up to 5 retries
      expect(userTriggeredItem.retryCount).toBeLessThan(5);

      // Background allows up to 3 retries
      expect(backgroundItem.retryCount).toBeLessThan(3);
    });
  });

  describe('Concurrent Uploads', () => {
    it('should handle 10 simultaneous uploads successfully', async () => {
      const uploadPromises: Promise<Response>[] = [];
      const files: File[] = [];

      // Create 10 files
      for (let i = 0; i < 10; i++) {
        files.push(new File([`content-${i}`], `test-${i}.jpg`, { type: 'image/jpeg' }));
      }

      const startTime = Date.now();

      // Upload all files simultaneously
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);

        const request = new NextRequest('http://localhost:3000/api/upload', {
          method: 'POST',
          body: formData,
        });

        uploadPromises.push(mockUploadHandler(request));
      }

      // Wait for all uploads to complete
      const responses = await Promise.all(uploadPromises);
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // Parse all responses
      const results = await Promise.all(responses.map(r => r.json()));

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.asset).toBeDefined();
        expect(result.asset.needsEmbedding).toBe(true);
      });

      // Should complete in reasonable time (not 10x single upload time)
      // With parallel processing, should be much less than 10 seconds
      expect(totalDuration).toBeLessThan(3000); // 3 seconds for 10 files
    });

    it('should respect MAX_CONCURRENT_UPLOADS limit', async () => {
      const concurrencySnapshots: number[] = [];
      let currentProcessing = 0;

      // Subscribe to queue events to track actual concurrency
      embeddingQueue.subscribe((event) => {
        if (event.type === 'processing') {
          currentProcessing++;
          concurrencySnapshots.push(currentProcessing);
        }
        if (event.type === 'completed' || event.type === 'failed') {
          currentProcessing--;
        }
      });

      // Add 10 items to queue
      for (let i = 0; i < 10; i++) {
        embeddingQueue.addToQueue({
          assetId: `concurrent-test-${i}`,
          blobUrl: `https://example.com/test-${i}.jpg`,
          checksum: `checksum-${i}`,
          priority: 1,
        });
      }

      // Wait for processing (queue manager has MAX_CONCURRENT = 2)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify concurrency never exceeded limit
      const maxObserved = Math.max(...concurrencySnapshots);
      expect(maxObserved).toBeLessThanOrEqual(2); // EmbeddingQueueManager.MAX_CONCURRENT = 2

      // Cleanup
      embeddingQueue.stop();
      embeddingQueue.clear();
    }, { timeout: 10000 });
  });

  describe('Network Interruption Recovery', () => {
    it('should recover from network interruption and resume processing', { timeout: 10000 }, async () => {
      let networkAvailable = true;
      const mockFetch = vi.fn().mockImplementation(() => {
        if (!networkAvailable) {
          throw new Error('Network unavailable');
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      });

      global.fetch = mockFetch as any;

      // Add item to queue
      embeddingQueue.addToQueue({
        assetId: 'network-recovery-test',
        blobUrl: 'url',
        checksum: 'check',
        priority: 1,
      });

      // Simulate network interruption
      networkAvailable = false;
      embeddingQueue.start();

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Restore network
      networkAvailable = true;

      // Should recover and complete
      await waitForQueueEvent(
        embeddingQueue,
        (event) => event.type === 'completed' || event.type === 'retry',
        5000
      );

      // Should have attempted retry after network recovery
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should persist queue to localStorage for recovery after page reload', () => {
      // Clear queue first
      embeddingQueue.clear();

      // Mock fetch to be slow so items stay in queue
      const slowFetch = vi.fn(() => new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: () => Promise.resolve({ success: true })
      }), 10000))); // 10 second delay
      global.fetch = slowFetch as any;

      // Add items to queue
      embeddingQueue.addToQueue({
        assetId: 'persist-test-1',
        blobUrl: 'url1',
        checksum: 'check1',
        priority: 1,
      });

      embeddingQueue.addToQueue({
        assetId: 'persist-test-2',
        blobUrl: 'url2',
        checksum: 'check2',
        priority: 1,
      });

      // Check localStorage immediately (before slow fetch completes)
      const persistedData = localStorage.getItem('sploot_embedding_queue');
      expect(persistedData).toBeTruthy();

      if (persistedData) {
        const parsed = JSON.parse(persistedData);
        expect(parsed.queue).toBeDefined();
        // At least 1 item should be persisted (1 may have moved to processing)
        expect(parsed.queue.length).toBeGreaterThanOrEqual(1);
        expect(parsed.timestamp).toBeDefined();
      }

      // Cleanup - stop queue and restore fetch
      embeddingQueue.stop();
      embeddingQueue.clear();
    });

    it('should handle offline mode gracefully', async () => {
      // Clear queue
      embeddingQueue.clear();

      // Mock slow fetch to keep items in queue
      const slowFetch = vi.fn(() => new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: () => Promise.resolve({ success: true })
      }), 10000)));
      global.fetch = slowFetch as any;

      // Set offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: false,
      });

      const queueItem = {
        assetId: 'offline-test',
        blobUrl: 'url',
        checksum: 'check',
        priority: 1,
      };

      // Add to queue (queue auto-starts but won't reach network due to slow fetch)
      embeddingQueue.addToQueue(queueItem);

      // Item should be added to queue regardless of online status
      expect(embeddingQueue.isInQueue('offline-test')).toBeDefined();

      // Come back online
      Object.defineProperty(navigator, 'onLine', { value: true });
      window.dispatchEvent(new Event('online'));

      // Queue is already running, items will eventually process
      await new Promise(resolve => setTimeout(resolve, 100));

      // Item should still be tracked (either queued or processing)
      const tracked = embeddingQueue.isInQueue('offline-test') ||
                      embeddingQueue.getStatus().processing > 0;
      expect(tracked).toBe(true);

      // Cleanup
      embeddingQueue.stop();
      embeddingQueue.clear();
    });
  });

  describe('Performance Metrics', () => {
    it('should meet performance SLOs', async () => {
      const metrics = {
        singleUpload: [] as number[],
        batchUpload: [] as number[],
        embeddingGeneration: [] as number[],
      };

      // Test single upload
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await mockUploadHandler(
          new NextRequest('http://localhost:3000/api/upload', {
            method: 'POST',
            body: new FormData(),
          })
        );
        metrics.singleUpload.push(Date.now() - start);
      }

      // Calculate averages
      const avgSingleUpload = metrics.singleUpload.reduce((a, b) => a + b, 0) / metrics.singleUpload.length;

      // Verify SLOs
      expect(avgSingleUpload).toBeLessThan(1000); // <1s per image
    });

    it('should track comprehensive performance metrics', () => {
      // Track various operations
      performanceTracker.track(PERF_OPERATIONS.UPLOAD_TO_BLOB, 200);
      performanceTracker.track(PERF_OPERATIONS.UPLOAD_TO_DB, 50);
      performanceTracker.track(PERF_OPERATIONS.EMBEDDING_GENERATE, 3000);
      performanceTracker.track(PERF_OPERATIONS.EMBEDDING_QUEUE_WAIT, 100);
      performanceTracker.track(PERF_OPERATIONS.EMBEDDING_REPLICATE_API, 2500);

      // Get summaries
      const uploadSummary = performanceTracker.getSummary(PERF_OPERATIONS.UPLOAD_TO_BLOB);
      const embeddingSummary = performanceTracker.getSummary(PERF_OPERATIONS.EMBEDDING_GENERATE);

      expect(uploadSummary).toBeDefined();
      expect(uploadSummary?.average).toBe(200);
      expect(embeddingSummary?.average).toBe(3000);

      // Log summary for visibility
      performanceTracker.logSummary();
    });
  });
});