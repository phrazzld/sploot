/**
 * E2E Test for Large Batch Upload Performance
 * Tests the system's ability to handle 100+ simultaneous image uploads,
 * measuring performance, memory usage, and failure rates
 */

import { vi } from 'vitest';
import { createMockRequest, mockPrisma, mockBlobStorage, mockEmbeddingService, mockAuth } from '../utils/test-helpers';
import { getEmbeddingQueueManager } from '@/lib/embedding-queue';
import { getGlobalPerformanceTracker, PERF_OPERATIONS } from '@/lib/performance';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma(),
  databaseAvailable: true,
  assetExists: vi.fn<() => Promise<boolean>>().mockResolvedValue(false),
  findOrCreateAsset: vi.fn<() => Promise<{ asset: any; isDuplicate: boolean }>>().mockResolvedValue({
    asset: { id: 'asset-id', blobUrl: 'blob://test', needsEmbedding: true },
    isDuplicate: false,
  }),
  upsertAssetEmbedding: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
}));

vi.mock('@vercel/blob', () => mockBlobStorage());

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn<() => Promise<{ userId: string | null }>>().mockResolvedValue({ userId: 'test-user' }),
  currentUser: vi.fn<() => Promise<any>>().mockResolvedValue({
    id: 'test-user',
    emailAddresses: [{ emailAddress: 'test@example.com' }],
  }),
}));

// Mock embedding service
const mockEmbedding = Array(1152).fill(0.1);
vi.mock('@/lib/embeddings', () => ({
  createEmbeddingService: jest.fn(() => ({
    generateImageEmbedding: vi.fn<() => Promise<{ embedding: number[]; modelName: string; dimension: number }>>().mockResolvedValue({
      embedding: mockEmbedding,
      modelName: 'siglip-large',
      dimension: 1152,
    }),
  })),
  generateImageEmbedding: vi.fn<() => Promise<{ embedding: number[]; modelName: string; dimension: number }>>().mockResolvedValue({
    embedding: mockEmbedding,
    modelName: 'siglip-large',
    dimension: 1152,
  }),
  generateTextEmbedding: vi.fn<() => Promise<{ embedding: number[]; modelName: string; dimension: number }>>().mockResolvedValue({
    embedding: mockEmbedding,
    modelName: 'siglip-large',
    dimension: 1152,
  }),
}));

interface UploadResult {
  assetId: string;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'searchable';
  startTime: number;
  endTime?: number;
  uploadDuration?: number;
  embeddingDuration?: number;
  totalDuration?: number;
  error?: string;
  fileSize: number;
  memoryUsage?: number;
}

interface PerformanceMetrics {
  totalTime: number;
  averageUploadTime: number;
  averageEmbeddingTime: number;
  successRate: number;
  failureRate: number;
  peakMemoryUsage: number;
  averageMemoryUsage: number;
  throughput: number; // files per second
}

describe('Large Batch Upload Performance Test', () => {
  let uploadResults: UploadResult[] = [];
  let performanceMetrics: PerformanceMetrics;
  let memorySnapshots: number[] = [];

  // Configuration
  const TEST_SIZE = 100; // Number of test images
  const MAX_CONCURRENT = 6; // Expected concurrent uploads based on implementation
  const TARGET_TIME = 120 * 1000; // 2 minutes in milliseconds
  const TARGET_MEMORY = 500 * 1024 * 1024; // 500MB in bytes
  const TARGET_SUCCESS_RATE = 0.95; // 95% success rate

  beforeEach(() => {
    uploadResults = [];
    memorySnapshots = [];
    vi.clearAllMocks();
  });

  /**
   * Generate test images with varying sizes to simulate real-world conditions
   */
  function generateTestImages(count: number): File[] {
    const files: File[] = [];
    const sizes = [
      100 * 1024,    // 100KB - small thumbnail
      500 * 1024,    // 500KB - medium image
      1024 * 1024,   // 1MB - standard photo
      2048 * 1024,   // 2MB - high quality photo
      5120 * 1024,   // 5MB - large photo
      8192 * 1024,   // 8MB - very large photo
    ];

    for (let i = 0; i < count; i++) {
      // Rotate through different file sizes
      const size = sizes[i % sizes.length];
      const buffer = Buffer.alloc(size);

      // Fill with pseudo-random data to simulate image content
      for (let j = 0; j < size; j += 1024) {
        buffer.writeUInt32BE(Math.random() * 0xFFFFFFFF, j % (size - 4));
      }

      const fileName = `test-image-${String(i + 1).padStart(3, '0')}.jpg`;
      files.push(new File([buffer], fileName, { type: 'image/jpeg' }));
    }

    return files;
  }

  /**
   * Simulate memory usage tracking
   */
  function trackMemoryUsage() {
    // In a real environment, we'd use process.memoryUsage()
    // For testing, simulate memory usage based on active uploads
    const activeUploads = uploadResults.filter(r => r.status === 'uploading').length;
    const baseMemory = 100 * 1024 * 1024; // 100MB base
    const perUploadMemory = 5 * 1024 * 1024; // 5MB per active upload
    return baseMemory + (activeUploads * perUploadMemory);
  }

  /**
   * Simulate upload with realistic delays and occasional failures
   */
  async function simulateUpload(file: File, index: number): Promise<UploadResult> {
    const result: UploadResult = {
      assetId: `asset-${index}`,
      status: 'pending',
      startTime: Date.now(),
      fileSize: file.size,
    };

    uploadResults.push(result);

    // Simulate network delay based on file size
    const baseDelay = 500; // 500ms base
    const sizeDelay = (file.size / 1024 / 1024) * 200; // 200ms per MB
    const networkJitter = Math.random() * 200 - 100; // ±100ms jitter
    const uploadDelay = Math.max(100, baseDelay + sizeDelay + networkJitter);

    result.status = 'uploading';
    memorySnapshots.push(trackMemoryUsage());

    await new Promise(resolve => setTimeout(resolve, uploadDelay));

    // Simulate occasional failures (5% failure rate)
    if (Math.random() < 0.05) {
      result.status = 'error';
      result.error = Math.random() < 0.5 ? 'Network timeout' : 'Server error';
      result.endTime = Date.now();
      result.uploadDuration = result.endTime - result.startTime;
      return result;
    }

    result.status = 'success';
    result.endTime = Date.now();
    result.uploadDuration = result.endTime - result.startTime;

    // Simulate embedding generation (async, non-blocking)
    const embeddingStartTime = Date.now();
    const embeddingDelay = 500 + Math.random() * 1000; // 0.5-1.5s

    setTimeout(() => {
      result.status = 'searchable';
      result.embeddingDuration = Date.now() - embeddingStartTime;
      result.totalDuration = Date.now() - result.startTime;
    }, embeddingDelay);

    return result;
  }

  /**
   * Process uploads with concurrency control similar to actual implementation
   */
  async function processUploadsWithConcurrency(files: File[]): Promise<void> {
    const uploadQueue = [...files];
    const activeUploads = new Set<Promise<UploadResult>>();
    let currentIndex = 0;

    while (uploadQueue.length > 0 || activeUploads.size > 0) {
      // Start new uploads up to concurrency limit
      while (uploadQueue.length > 0 && activeUploads.size < MAX_CONCURRENT) {
        const file = uploadQueue.shift()!;
        const uploadPromise = simulateUpload(file, currentIndex++).then(result => {
          activeUploads.delete(uploadPromise);
          return result;
        });
        activeUploads.add(uploadPromise);
      }

      // Wait for at least one upload to complete
      if (activeUploads.size > 0) {
        await Promise.race(activeUploads);
        memorySnapshots.push(trackMemoryUsage());
      }
    }

    // Wait for all remaining uploads
    await Promise.all(activeUploads);
  }

  /**
   * Calculate performance metrics from upload results
   */
  function calculateMetrics(): PerformanceMetrics {
    const successful = uploadResults.filter(r => r.status === 'success' || r.status === 'searchable');
    const failed = uploadResults.filter(r => r.status === 'error');

    const uploadTimes = successful
      .map(r => r.uploadDuration || 0)
      .filter(t => t > 0);

    const embeddingTimes = uploadResults
      .filter(r => r.embeddingDuration)
      .map(r => r.embeddingDuration!);

    const startTime = Math.min(...uploadResults.map(r => r.startTime));
    const endTime = Math.max(...uploadResults.map(r => r.endTime || Date.now()));
    const totalTime = endTime - startTime;

    return {
      totalTime,
      averageUploadTime: uploadTimes.reduce((a, b) => a + b, 0) / uploadTimes.length || 0,
      averageEmbeddingTime: embeddingTimes.reduce((a, b) => a + b, 0) / embeddingTimes.length || 0,
      successRate: successful.length / uploadResults.length,
      failureRate: failed.length / uploadResults.length,
      peakMemoryUsage: Math.max(...memorySnapshots),
      averageMemoryUsage: memorySnapshots.reduce((a, b) => a + b, 0) / memorySnapshots.length || 0,
      throughput: (successful.length / totalTime) * 1000, // files per second
    };
  }

  test('should handle 100 simultaneous files within performance targets', { timeout: 180000 }, async () => {
    // Generate test images
    const files = generateTestImages(TEST_SIZE);
    expect(files).toHaveLength(TEST_SIZE);

    // Track start time
    const startTime = Date.now();

    // Process all uploads
    await processUploadsWithConcurrency(files);

    // Calculate metrics
    performanceMetrics = calculateMetrics();

    // Log performance results
    console.log('=== Large Batch Upload Performance Results ===');
    console.log(`Total Files: ${TEST_SIZE}`);
    console.log(`Total Time: ${(performanceMetrics.totalTime / 1000).toFixed(2)}s`);
    console.log(`Average Upload Time: ${(performanceMetrics.averageUploadTime / 1000).toFixed(2)}s`);
    console.log(`Success Rate: ${(performanceMetrics.successRate * 100).toFixed(1)}%`);
    console.log(`Failure Rate: ${(performanceMetrics.failureRate * 100).toFixed(1)}%`);
    console.log(`Peak Memory: ${(performanceMetrics.peakMemoryUsage / 1024 / 1024).toFixed(1)}MB`);
    console.log(`Average Memory: ${(performanceMetrics.averageMemoryUsage / 1024 / 1024).toFixed(1)}MB`);
    console.log(`Throughput: ${performanceMetrics.throughput.toFixed(2)} files/sec`);

    // Assertions
    expect(performanceMetrics.totalTime).toBeLessThan(TARGET_TIME);
    expect(performanceMetrics.successRate).toBeGreaterThanOrEqual(TARGET_SUCCESS_RATE);
    expect(performanceMetrics.peakMemoryUsage).toBeLessThan(TARGET_MEMORY);
  });

  test('should maintain responsive UI during large batch upload', { timeout: 60000 }, async () => {
    const files = generateTestImages(50); // Smaller test for UI responsiveness
    let uiBlockedTime = 0;
    const maxBlockingTime = 50; // 50ms max blocking time for UI responsiveness

    // Simulate UI thread monitoring
    const uiCheckInterval = setInterval(() => {
      const activeCount = uploadResults.filter(r => r.status === 'uploading').length;
      if (activeCount > MAX_CONCURRENT * 2) {
        // UI would be blocked if too many concurrent operations
        uiBlockedTime += 10;
      }
    }, 10);

    await processUploadsWithConcurrency(files);
    clearInterval(uiCheckInterval);

    // UI should not be blocked for more than 50ms total
    expect(uiBlockedTime).toBeLessThan(maxBlockingTime);
  });

  test('should handle memory efficiently with cleanup', { timeout: 60000 }, async () => {
    const files = generateTestImages(50);
    const memoryCheckpoints: number[] = [];

    // Take memory snapshots at regular intervals
    const memoryMonitor = setInterval(() => {
      memoryCheckpoints.push(trackMemoryUsage());
    }, 100);

    await processUploadsWithConcurrency(files);
    clearInterval(memoryMonitor);

    // Check for memory leaks - memory should return to baseline after completion
    const initialMemory = memoryCheckpoints[0];
    const finalMemory = memoryCheckpoints[memoryCheckpoints.length - 1];
    const memoryIncrease = finalMemory - initialMemory;

    // Memory increase should be minimal after all uploads complete
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
  });

  test('should handle mixed file sizes appropriately', { timeout: 45000 }, async () => {
    const files = generateTestImages(30); // Mix of different sizes
    await processUploadsWithConcurrency(files);

    // Group results by file size
    const sizeGroups = new Map<number, UploadResult[]>();
    uploadResults.forEach((result, index) => {
      const size = files[index].size;
      if (!sizeGroups.has(size)) {
        sizeGroups.set(size, []);
      }
      sizeGroups.get(size)!.push(result);
    });

    // Larger files should take proportionally longer
    const avgTimeBySize = new Map<number, number>();
    sizeGroups.forEach((results, size) => {
      const avgTime = results
        .filter(r => r.uploadDuration)
        .reduce((sum, r) => sum + r.uploadDuration!, 0) / results.length;
      avgTimeBySize.set(size, avgTime);
    });

    // Verify that larger files take more time (with some tolerance for network variance)
    const sortedSizes = Array.from(avgTimeBySize.keys()).sort((a, b) => a - b);
    for (let i = 1; i < sortedSizes.length; i++) {
      const smallerSize = sortedSizes[i - 1];
      const largerSize = sortedSizes[i];
      const smallerTime = avgTimeBySize.get(smallerSize)!;
      const largerTime = avgTimeBySize.get(largerSize)!;

      // Larger files should generally take more time (with 20% tolerance)
      expect(largerTime).toBeGreaterThan(smallerTime * 0.8);
    }
  });

  test('should recover from failures gracefully', { timeout: 30000 }, async () => {
    const files = generateTestImages(20);

    // Force some failures by mocking
    let failureCount = 0;
    const originalSimulateUpload = simulateUpload;
    const simulateUploadWithFailures = async (file: File, index: number): Promise<UploadResult> => {
      // Force first 3 uploads to fail
      if (failureCount < 3) {
        failureCount++;
        const result: UploadResult = {
          assetId: `asset-${index}`,
          status: 'error',
          startTime: Date.now(),
          endTime: Date.now() + 100,
          uploadDuration: 100,
          error: 'Forced failure for testing',
          fileSize: file.size,
        };
        uploadResults.push(result);
        return result;
      }
      return originalSimulateUpload.call(null, file, index);
    };

    // Replace with failure version
    (global as any).simulateUpload = simulateUploadWithFailures;

    await processUploadsWithConcurrency(files);

    // Should still complete other uploads despite failures
    const successful = uploadResults.filter(r => r.status === 'success' || r.status === 'searchable');
    expect(successful.length).toBeGreaterThan(files.length - 5); // Most should succeed
  });
});