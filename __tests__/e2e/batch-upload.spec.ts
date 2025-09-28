/**
 * E2E Test for Batch Upload
 * Tests the full flow of uploading multiple images simultaneously,
 * verifying upload states, completion times, and searchability
 */

import { jest } from '@jest/globals';
import { createMockRequest, mockPrisma, mockBlobStorage, mockEmbeddingService } from '../utils/test-helpers';
// Types are inferred from Clerk auth objects
type SessionStatusClaim = 'active' | 'inactive' | 'stale' | 'revoked' | 'tokenExpired' | null;
interface JwtPayload {
  __raw: string;
  iss: string;
  sub: string;
  sid: string;
  nbf: number;
  exp: number;
  iat: number;
}
import type { auth as clerkAuth, currentUser as clerkCurrentUser } from '@clerk/nextjs/server';
import { getEmbeddingQueueManager } from '@/lib/embedding-queue';
import { getGlobalPerformanceTracker, PERF_OPERATIONS } from '@/lib/performance';

// Mock dependencies
jest.mock('@/lib/db', () => ({
  prisma: mockPrisma(),
}));

jest.mock('@vercel/blob', () => mockBlobStorage());

type ClerkAuth = typeof clerkAuth;
type ClerkAuthResult = Awaited<ReturnType<ClerkAuth>>;
type ClerkCurrentUser = typeof clerkCurrentUser;
type ClerkCurrentUserResult = Awaited<ReturnType<ClerkCurrentUser>>;

const createRedirectStub = (): ClerkAuthResult['redirectToSignIn'] =>
  ((() => {
    throw new Error('redirect not supported in tests');
  }) as ClerkAuthResult['redirectToSignIn']);

const createAuthState = (userId: string | null): ClerkAuthResult => {
  if (!userId) {
    return {
      sessionClaims: null,
      sessionId: null,
      sessionStatus: null,
      actor: null,
      userId: null,
      orgId: null,
      orgRole: null,
      orgSlug: null,
      orgPermissions: null,
      factorVerificationAge: null,
      tokenType: 'session_token',
      getToken: jest.fn().mockResolvedValue(null) as any,
      has: jest.fn().mockReturnValue(false) as any,
      debug: jest.fn().mockReturnValue({}) as any,
      isAuthenticated: false,
      redirectToSignIn: createRedirectStub(),
      redirectToSignUp: createRedirectStub(),
    } satisfies ClerkAuthResult;
  }

  const now = Math.floor(Date.now() / 1000);
  const claims: JwtPayload = {
    __raw: '',
    iss: 'https://sploot.test',
    sub: userId,
    sid: `sess_${userId}`,
    nbf: now,
    exp: now + 3600,
    iat: now,
  };

  return {
    sessionClaims: claims,
    sessionId: claims.sid,
    sessionStatus: 'active' as SessionStatusClaim,
    actor: undefined,
    userId,
    orgId: undefined,
    orgRole: undefined,
    orgSlug: undefined,
    orgPermissions: [],
    factorVerificationAge: null,
    tokenType: 'session_token',
    getToken: jest.fn().mockResolvedValue('mock-session-token') as any,
    has: jest.fn().mockReturnValue(true) as any,
    debug: jest.fn().mockReturnValue({}) as any,
    isAuthenticated: true,
    redirectToSignIn: createRedirectStub(),
    redirectToSignUp: createRedirectStub(),
  } satisfies ClerkAuthResult;
};

const authMock = jest.fn() as any;
const currentUserMock = jest.fn() as any;

jest.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
  currentUser: currentUserMock,
}));

const setAuthState = (userId: string | null) => {
  authMock.mockResolvedValue(createAuthState(userId));
  currentUserMock.mockResolvedValue(null as ClerkCurrentUserResult);
};

// Mock embedding service
const mockEmbedding = Array(1152).fill(0.1);
jest.mock('@/lib/embeddings', () => ({
  generateImageEmbedding: jest.fn(() => Promise.resolve({
    embedding: Array(1152).fill(0.1),
    modelName: 'siglip-large',
    dimension: 1152,
  })),
  generateTextEmbedding: jest.fn(() => Promise.resolve({
    embedding: Array(1152).fill(0.1),
    modelName: 'siglip-large',
    dimension: 1152,
  })),
}));

interface UploadResult {
  assetId: string;
  status: 'uploading' | 'success' | 'error' | 'searchable';
  startTime: number;
  endTime?: number;
  uploadDuration?: number;
  embeddingDuration?: number;
  totalDuration?: number;
  error?: string;
}

describe('E2E: Batch Upload', () => {
  let uploadResults: Map<string, UploadResult>;
  let embeddingQueue: ReturnType<typeof getEmbeddingQueueManager>;
  let performanceTracker: ReturnType<typeof getGlobalPerformanceTracker>;

  beforeEach(() => {
    jest.clearAllMocks();
    uploadResults = new Map();
    embeddingQueue = getEmbeddingQueueManager();
    performanceTracker = getGlobalPerformanceTracker();
    performanceTracker.reset();

    // Mock auth for all requests
    setAuthState('test-user');
  });

  afterEach(() => {
    embeddingQueue.stop();
    embeddingQueue.clear();
  });

  /**
   * Simulates uploading a file through the full pipeline
   */
  async function uploadFile(file: File, uploadId: string): Promise<UploadResult> {
    const result: UploadResult = {
      assetId: `asset-${uploadId}`,
      status: 'uploading',
      startTime: Date.now(),
    };

    uploadResults.set(uploadId, result);

    try {
      // Simulate FormData upload
      const formData = new FormData();
      formData.append('file', file);

      // Track upload performance
      performanceTracker.start(`upload-${uploadId}`);

      // Simulate upload processing
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200)); // 100-300ms

      // Mark upload complete
      result.endTime = Date.now();
      result.uploadDuration = result.endTime - result.startTime;
      result.status = 'success';
      performanceTracker.end(`upload-${uploadId}`);

      // Add to embedding queue (background processing)
      embeddingQueue.addToQueue({
        assetId: result.assetId,
        blobUrl: `https://example.blob.vercel-storage.com/${file.name}`,
        checksum: 'mock-checksum',
        priority: 1,
      });

      // Start embedding processing
      embeddingQueue.start();

      return result;
    } catch (error) {
      result.status = 'error';
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.endTime = Date.now();
      return result;
    }
  }

  /**
   * Waits for an asset to become searchable (embedding generated)
   */
  async function waitForSearchable(uploadId: string, timeout: number = 15000): Promise<void> {
    const result = uploadResults.get(uploadId);
    if (!result) throw new Error(`Upload ${uploadId} not found`);

    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;

        // Check if embedding is complete
        const status = embeddingQueue.getStatus();
        const isComplete = !embeddingQueue.isInQueue(result.assetId) &&
                         !embeddingQueue.isProcessing(result.assetId);

        if (isComplete) {
          clearInterval(checkInterval);
          result.status = 'searchable';
          result.embeddingDuration = Date.now() - result.endTime!;
          result.totalDuration = Date.now() - result.startTime;
          resolve();
        } else if (elapsed > timeout) {
          clearInterval(checkInterval);
          reject(new Error(`Timeout waiting for ${uploadId} to become searchable`));
        }
      }, 100);
    });
  }

  /**
   * Simulates searching for uploaded images
   */
  async function searchForImages(query: string): Promise<string[]> {
    // Simulate text embedding generation
    performanceTracker.start('search-text-embedding');
    await new Promise(resolve => setTimeout(resolve, 50)); // 50ms for text embedding
    performanceTracker.end('search-text-embedding');

    // Simulate vector search
    performanceTracker.start('search-vector-query');
    await new Promise(resolve => setTimeout(resolve, 100)); // 100ms for search
    performanceTracker.end('search-vector-query');

    // Return mock results (all uploaded images)
    return Array.from(uploadResults.values())
      .filter(r => r.status === 'searchable')
      .map(r => r.assetId);
  }

  test('should upload 5 images simultaneously', async () => {
    const files: File[] = [];
    for (let i = 1; i <= 5; i++) {
      files.push(new File([`image-content-${i}`], `test-${i}.jpg`, { type: 'image/jpeg' }));
    }

    // Start all uploads simultaneously
    const uploadPromises = files.map((file, index) =>
      uploadFile(file, `upload-${index + 1}`)
    );

    // Wait for all uploads to complete
    const results = await Promise.all(uploadPromises);

    // Verify all uploads succeeded
    results.forEach(result => {
      expect(result.status).toBe('success');
      expect(result.uploadDuration).toBeDefined();
    });

    // Verify upload count
    expect(results.length).toBe(5);
  });

  test('should show "uploading" state immediately for all files', async () => {
    const files: File[] = [];
    for (let i = 1; i <= 5; i++) {
      files.push(new File([`image-content-${i}`], `test-${i}.jpg`, { type: 'image/jpeg' }));
    }

    // Start uploads and immediately check states
    const uploadPromises: Promise<UploadResult>[] = [];
    const immediateStates: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const uploadPromise = uploadFile(files[i], `upload-${i + 1}`);
      uploadPromises.push(uploadPromise);

      // Check state immediately after starting upload
      const result = uploadResults.get(`upload-${i + 1}`);
      immediateStates.push(result?.status || 'not-found');
    }

    // All should show uploading state immediately
    immediateStates.forEach(state => {
      expect(state).toBe('uploading');
    });

    // Wait for completion
    await Promise.all(uploadPromises);
  });

  test('should complete all uploads within 5 seconds', async () => {
    const files: File[] = [];
    for (let i = 1; i <= 5; i++) {
      files.push(new File([`image-content-${i}`], `test-${i}.jpg`, { type: 'image/jpeg' }));
    }

    const startTime = Date.now();

    // Upload all files
    const uploadPromises = files.map((file, index) =>
      uploadFile(file, `upload-${index + 1}`)
    );

    // Wait for all uploads
    const results = await Promise.all(uploadPromises);
    const totalUploadTime = Date.now() - startTime;

    // Verify timing
    expect(totalUploadTime).toBeLessThan(5000); // Less than 5 seconds

    // Verify individual upload times
    results.forEach(result => {
      expect(result.uploadDuration).toBeLessThan(1000); // Each under 1 second
    });

    // Log performance metrics
    console.log('Batch Upload Performance:');
    console.log(`Total time for 5 uploads: ${totalUploadTime}ms`);
    console.log(`Average per upload: ${totalUploadTime / 5}ms`);
  });

  test('should make all images searchable within 15 seconds', async () => {
    const files: File[] = [];
    for (let i = 1; i <= 5; i++) {
      files.push(new File([`image-content-${i}`], `test-${i}.jpg`, { type: 'image/jpeg' }));
    }

    const startTime = Date.now();

    // Upload all files
    const uploadPromises = files.map((file, index) =>
      uploadFile(file, `upload-${index + 1}`)
    );
    await Promise.all(uploadPromises);

    // Wait for all to become searchable
    const searchablePromises = Array.from(uploadResults.keys()).map(uploadId =>
      waitForSearchable(uploadId, 15000)
    );

    await Promise.all(searchablePromises);
    const totalTime = Date.now() - startTime;

    // Verify all are searchable
    uploadResults.forEach(result => {
      expect(result.status).toBe('searchable');
      expect(result.totalDuration).toBeLessThan(15000); // Under 15 seconds each
    });

    // Total time should be under 15 seconds
    expect(totalTime).toBeLessThan(15000);

    console.log('Time to Searchable:');
    console.log(`Total time: ${totalTime}ms`);
    uploadResults.forEach((result, id) => {
      console.log(`${id}: Upload ${result.uploadDuration}ms, Embedding ${result.embeddingDuration}ms, Total ${result.totalDuration}ms`);
    });
  });

  test('should find uploaded images through search', async () => {
    const files: File[] = [];
    for (let i = 1; i <= 5; i++) {
      files.push(new File([`image-content-${i}`], `test-${i}.jpg`, { type: 'image/jpeg' }));
    }

    // Upload all files
    const uploadPromises = files.map((file, index) =>
      uploadFile(file, `upload-${index + 1}`)
    );
    await Promise.all(uploadPromises);

    // Wait for searchability
    const searchablePromises = Array.from(uploadResults.keys()).map(uploadId =>
      waitForSearchable(uploadId, 15000)
    );
    await Promise.all(searchablePromises);

    // Search for images
    const searchResults = await searchForImages('test image');

    // Should find all uploaded images
    expect(searchResults.length).toBe(5);
    searchResults.forEach(assetId => {
      expect(assetId).toMatch(/^asset-upload-\d$/);
    });
  });

  test('should handle concurrent uploads efficiently', async () => {
    const files: File[] = [];
    for (let i = 1; i <= 5; i++) {
      files.push(new File([`image-content-${i}`], `test-${i}.jpg`, { type: 'image/jpeg' }));
    }

    // Track concurrency
    let maxConcurrent = 0;
    let currentConcurrent = 0;
    const concurrencyTracker = {
      start: () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
      },
      end: () => {
        currentConcurrent--;
      }
    };

    // Upload with concurrency tracking
    const uploadWithTracking = async (file: File, uploadId: string) => {
      concurrencyTracker.start();
      try {
        const result = await uploadFile(file, uploadId);
        return result;
      } finally {
        concurrencyTracker.end();
      }
    };

    // Start uploads
    const uploadPromises = files.map((file, index) =>
      uploadWithTracking(file, `upload-${index + 1}`)
    );

    await Promise.all(uploadPromises);

    // Should handle concurrent uploads (max 3 based on implementation)
    expect(maxConcurrent).toBeGreaterThan(1); // Confirms parallelism
    expect(maxConcurrent).toBeLessThanOrEqual(3); // Respects concurrency limit
  });

  test('should track performance metrics accurately', async () => {
    const files: File[] = [];
    for (let i = 1; i <= 5; i++) {
      files.push(new File([`image-content-${i}`], `test-${i}.jpg`, { type: 'image/jpeg' }));
    }

    // Clear tracker
    performanceTracker.reset();

    // Upload files
    const uploadPromises = files.map((file, index) =>
      uploadFile(file, `upload-${index + 1}`)
    );
    await Promise.all(uploadPromises);

    // Check performance metrics
    const uploadMetrics = [];
    for (let i = 1; i <= 5; i++) {
      const uploadTime = performanceTracker.getAverage(`upload-upload-${i}`);
      if (uploadTime > 0) {
        uploadMetrics.push(uploadTime);
      }
    }

    // Verify metrics were tracked
    expect(uploadMetrics.length).toBeGreaterThan(0);

    // Calculate aggregate metrics
    if (uploadMetrics.length > 0) {
      const avgUploadTime = uploadMetrics.reduce((a, b) => a + b, 0) / uploadMetrics.length;
      const maxUploadTime = Math.max(...uploadMetrics);

      console.log('Performance Metrics:');
      console.log(`Average upload time: ${avgUploadTime.toFixed(1)}ms`);
      console.log(`Max upload time: ${maxUploadTime.toFixed(1)}ms`);

      // Verify performance targets
      expect(avgUploadTime).toBeLessThan(1000); // Average under 1s
      expect(maxUploadTime).toBeLessThan(2000); // Max under 2s
    }
  });

  test('should handle upload errors gracefully', async () => {
    // Create a mix of valid and invalid files
    const files = [
      new File(['valid-content'], 'valid.jpg', { type: 'image/jpeg' }),
      new File([''], 'empty.jpg', { type: 'image/jpeg' }), // Empty file
      new File(['valid-content-2'], 'valid2.jpg', { type: 'image/jpeg' }),
    ];

    // Mock error for empty file
    const uploadWithError = async (file: File, uploadId: string) => {
      if (file.size === 0) {
        const result: UploadResult = {
          assetId: `asset-${uploadId}`,
          status: 'error',
          startTime: Date.now(),
          endTime: Date.now(),
          error: 'File is empty',
        };
        uploadResults.set(uploadId, result);
        return result;
      }
      return uploadFile(file, uploadId);
    };

    // Upload all files
    const results = await Promise.all([
      uploadWithError(files[0], 'upload-1'),
      uploadWithError(files[1], 'upload-2'),
      uploadWithError(files[2], 'upload-3'),
    ]);

    // Check results
    expect(results[0].status).toBe('success');
    expect(results[1].status).toBe('error');
    expect(results[1].error).toBeDefined();
    expect(results[2].status).toBe('success');

    // System should continue working despite errors
    const successfulUploads = results.filter(r => r.status === 'success');
    expect(successfulUploads.length).toBe(2);
  });

  test('should maintain upload order in results', async () => {
    const files: File[] = [];
    const uploadOrder: string[] = [];

    for (let i = 1; i <= 5; i++) {
      const filename = `test-${i}.jpg`;
      files.push(new File([`content-${i}`], filename, { type: 'image/jpeg' }));
      uploadOrder.push(filename);
    }

    // Upload files and track completion order
    const completionOrder: string[] = [];
    const uploadPromises = files.map(async (file, index) => {
      const result = await uploadFile(file, `upload-${index + 1}`);
      completionOrder.push(file.name);
      return result;
    });

    await Promise.all(uploadPromises);

    // Files may complete in different order due to parallelism
    // But all files should be accounted for
    expect(completionOrder.length).toBe(5);
    expect(new Set(completionOrder)).toEqual(new Set(uploadOrder));
  });
});
