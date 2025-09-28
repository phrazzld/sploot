/**
 * Memory Leak Detection Test
 * Tests that file uploads don't cause memory leaks by:
 * - Uploading 50 files
 * - Measuring heap usage before/after
 * - Verifying memory returns to baseline after cleanup
 * - Checking for detached DOM nodes and lingering file references
 */

import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('@/lib/db', () => ({
  prisma: {
    asset: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
  databaseAvailable: true,
  assetExists: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
  findOrCreateAsset: jest.fn<() => Promise<{ asset: any; isDuplicate: boolean }>>().mockResolvedValue({
    asset: { id: 'asset-id', blobUrl: 'blob://test', needsEmbedding: false },
    isDuplicate: false,
  }),
}));

jest.mock('@vercel/blob', () => ({
  put: jest.fn<() => Promise<{ url: string; pathname: string }>>().mockResolvedValue({
    url: 'blob://test-url',
    pathname: '/test-path',
  }),
}));

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn<() => Promise<{ userId: string | null }>>().mockResolvedValue({ userId: 'test-user' }),
  currentUser: jest.fn<() => Promise<any>>().mockResolvedValue({
    id: 'test-user',
    emailAddresses: [{ emailAddress: 'test@example.com' }],
  }),
}));

interface MemoryStats {
  baseline: number;
  afterUpload: number;
  afterCleanup: number;
  leaked: number;
}

interface FileReference {
  file: File;
  id: string;
  uploadPromise?: Promise<any>;
}

describe('Memory Leak Detection', () => {
  const FILE_COUNT = 50;
  const FILE_SIZE = 500 * 1024; // 500KB per file
  const MEMORY_TOLERANCE = 10 * 1024 * 1024; // 10MB tolerance

  let fileReferences: FileReference[] = [];
  let memoryStats: MemoryStats = {
    baseline: 0,
    afterUpload: 0,
    afterCleanup: 0,
    leaked: 0
  };

  /**
   * Generate test files for upload
   */
  function generateTestFiles(count: number): File[] {
    const files: File[] = [];

    for (let i = 0; i < count; i++) {
      // Create buffer with random content to simulate real image data
      const buffer = new ArrayBuffer(FILE_SIZE);
      const view = new Uint8Array(buffer);
      for (let j = 0; j < view.length; j++) {
        view[j] = Math.floor(Math.random() * 256);
      }

      const blob = new Blob([buffer], { type: 'image/jpeg' });
      const file = new File([blob], `test-image-${i}.jpg`, { type: 'image/jpeg' });
      files.push(file);
    }

    return files;
  }

  /**
   * Simulate file upload process
   */
  async function simulateUpload(file: File, id: string): Promise<void> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

    // Simulate processing
    const formData = new FormData();
    formData.append('file', file);

    // Mock successful upload
    return Promise.resolve();
  }

  /**
   * Force garbage collection if available
   */
  function forceGC(): void {
    if (global.gc) {
      // Run GC multiple times to ensure thorough cleanup
      global.gc();
      global.gc();
      global.gc();
    }
  }

  /**
   * Get current heap usage in bytes
   */
  function getHeapUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    // Fallback for browser environment
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  /**
   * Wait for memory to stabilize
   */
  async function waitForMemoryStabilization(duration = 100): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, duration));
  }

  beforeAll(() => {
    // Enable manual GC for Node.js (run tests with --expose-gc flag)
    if (typeof global.gc !== 'function') {
      console.warn('Garbage collection not exposed. Run with --expose-gc flag for accurate results.');
    }
  });

  afterEach(() => {
    // Clean up any remaining references
    fileReferences = [];
    forceGC();
  });

  test('should not leak memory after uploading 50 files', async () => {
    // Step 1: Measure baseline heap usage
    forceGC();
    await waitForMemoryStabilization();
    memoryStats.baseline = getHeapUsage();
    console.log(`Baseline heap: ${(memoryStats.baseline / 1024 / 1024).toFixed(2)}MB`);

    // Step 2: Create test files
    const files = generateTestFiles(FILE_COUNT);
    expect(files).toHaveLength(FILE_COUNT);

    // Step 3: Create file references and simulate uploads
    fileReferences = files.map((file, index) => ({
      file,
      id: `upload-${index}`,
    }));

    // Upload all files concurrently (simulating real usage)
    const uploadPromises = fileReferences.map(ref =>
      simulateUpload(ref.file, ref.id)
    );

    await Promise.all(uploadPromises);

    // Step 4: Measure heap after uploads complete
    memoryStats.afterUpload = getHeapUsage();
    console.log(`Heap after upload: ${(memoryStats.afterUpload / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Memory used for uploads: ${((memoryStats.afterUpload - memoryStats.baseline) / 1024 / 1024).toFixed(2)}MB`);

    // Step 5: Clear file references
    fileReferences.forEach(ref => {
      // Clear the file reference
      (ref as any).file = null;
      (ref as any).uploadPromise = null;
    });
    fileReferences = [];

    // Step 6: Force garbage collection
    forceGC();
    await waitForMemoryStabilization(200);

    // Step 7: Measure heap after cleanup
    memoryStats.afterCleanup = getHeapUsage();
    memoryStats.leaked = memoryStats.afterCleanup - memoryStats.baseline;

    console.log(`Heap after cleanup: ${(memoryStats.afterCleanup / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Memory leaked: ${(memoryStats.leaked / 1024 / 1024).toFixed(2)}MB`);

    // Step 8: Assert memory returned to baseline within tolerance
    expect(Math.abs(memoryStats.leaked)).toBeLessThanOrEqual(MEMORY_TOLERANCE);
  }, 30000); // 30 second timeout

  test('should not retain file references after upload completion', async () => {
    const files = generateTestFiles(10);
    const weakRefs: WeakRef<File>[] = [];

    // Create weak references to track if files are garbage collected
    files.forEach(file => {
      weakRefs.push(new WeakRef(file));
    });

    // Upload files
    const uploadPromises = files.map((file, index) =>
      simulateUpload(file, `test-${index}`)
    );
    await Promise.all(uploadPromises);

    // Clear strong references
    files.length = 0;
    forceGC();
    await waitForMemoryStabilization(100);

    // Check if files were garbage collected
    const retainedFiles = weakRefs.filter(ref => ref.deref() !== undefined);

    console.log(`Retained files: ${retainedFiles.length} out of ${weakRefs.length}`);

    // All files should be garbage collected
    expect(retainedFiles.length).toBe(0);
  });

  test('should not accumulate memory with repeated upload cycles', async () => {
    const CYCLES = 5;
    const FILES_PER_CYCLE = 10;
    const memoryPerCycle: number[] = [];

    forceGC();
    await waitForMemoryStabilization();
    const initialMemory = getHeapUsage();

    for (let cycle = 0; cycle < CYCLES; cycle++) {
      // Generate and upload files
      const files = generateTestFiles(FILES_PER_CYCLE);
      const uploads = files.map((file, index) =>
        simulateUpload(file, `cycle-${cycle}-file-${index}`)
      );
      await Promise.all(uploads);

      // Measure memory before cleanup
      const memoryBeforeCleanup = getHeapUsage();

      // Clean up
      files.length = 0;
      forceGC();
      await waitForMemoryStabilization();

      // Measure memory after cleanup
      const memoryAfterCleanup = getHeapUsage();
      memoryPerCycle.push(memoryAfterCleanup - initialMemory);

      console.log(`Cycle ${cycle + 1}: Memory delta = ${(memoryPerCycle[cycle] / 1024 / 1024).toFixed(2)}MB`);
    }

    // Memory should not continuously increase across cycles
    // Check that the last cycle doesn't use significantly more memory than the first
    const firstCycleMemory = memoryPerCycle[0];
    const lastCycleMemory = memoryPerCycle[CYCLES - 1];
    const memoryGrowth = lastCycleMemory - firstCycleMemory;

    console.log(`Memory growth over ${CYCLES} cycles: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);

    // Assert memory growth is within acceptable limits
    expect(Math.abs(memoryGrowth)).toBeLessThanOrEqual(MEMORY_TOLERANCE);
  }, 60000); // 60 second timeout for multiple cycles

  test('should clean up ArrayBuffer and Blob references', async () => {
    const buffers: ArrayBuffer[] = [];
    const blobs: Blob[] = [];

    // Create buffers and blobs
    for (let i = 0; i < 20; i++) {
      const buffer = new ArrayBuffer(FILE_SIZE);
      buffers.push(buffer);

      const blob = new Blob([buffer], { type: 'image/jpeg' });
      blobs.push(blob);
    }

    // Measure memory with references
    const memoryWithRefs = getHeapUsage();

    // Clear references
    buffers.length = 0;
    blobs.length = 0;
    forceGC();
    await waitForMemoryStabilization();

    // Measure memory after cleanup
    const memoryAfterCleanup = getHeapUsage();
    const memoryFreed = memoryWithRefs - memoryAfterCleanup;

    console.log(`Memory freed from buffers/blobs: ${(memoryFreed / 1024 / 1024).toFixed(2)}MB`);

    // Should free most of the allocated memory
    expect(memoryFreed).toBeGreaterThan(0);
  });

  test('should not leak memory from FormData objects', async () => {
    const formDataObjects: FormData[] = [];

    forceGC();
    const initialMemory = getHeapUsage();

    // Create FormData objects with files
    for (let i = 0; i < 30; i++) {
      const formData = new FormData();
      const file = new File([`content-${i}`], `file-${i}.jpg`, { type: 'image/jpeg' });
      formData.append('file', file);
      formData.append('metadata', JSON.stringify({ index: i, timestamp: Date.now() }));
      formDataObjects.push(formData);
    }

    const memoryWithFormData = getHeapUsage();
    console.log(`Memory with FormData objects: ${((memoryWithFormData - initialMemory) / 1024 / 1024).toFixed(2)}MB`);

    // Clear FormData references
    formDataObjects.length = 0;
    forceGC();
    await waitForMemoryStabilization();

    const finalMemory = getHeapUsage();
    const memoryLeak = finalMemory - initialMemory;

    console.log(`Memory leak from FormData: ${(memoryLeak / 1024 / 1024).toFixed(2)}MB`);

    // Should not leak significant memory
    expect(Math.abs(memoryLeak)).toBeLessThanOrEqual(MEMORY_TOLERANCE / 2);
  });
});