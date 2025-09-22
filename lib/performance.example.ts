/**
 * Example usage of the PerformanceTracker utility
 * This file demonstrates how to integrate performance tracking into the application
 */

import {
  PerformanceTracker,
  getGlobalPerformanceTracker,
  PERF_OPERATIONS,
  measureAsync,
  measureSync,
} from './performance';

// Example 1: Basic tracking with start/end pattern
export async function exampleUploadWithTracking(file: File) {
  const tracker = getGlobalPerformanceTracker();

  // Start tracking overall upload time
  tracker.start(PERF_OPERATIONS.UPLOAD_SINGLE);

  try {
    // Track blob storage time
    tracker.start(PERF_OPERATIONS.UPLOAD_TO_BLOB);
    const blobUrl = await uploadToBlob(file);
    tracker.end(PERF_OPERATIONS.UPLOAD_TO_BLOB);

    // Track database write time
    tracker.start(PERF_OPERATIONS.UPLOAD_TO_DB);
    const asset = await saveToDatabase(blobUrl, file);
    tracker.end(PERF_OPERATIONS.UPLOAD_TO_DB);

    // End overall tracking
    const totalTime = tracker.end(PERF_OPERATIONS.UPLOAD_SINGLE);
    console.log(`Upload completed in ${totalTime}ms`);

    return asset;
  } catch (error) {
    tracker.end(PERF_OPERATIONS.UPLOAD_SINGLE);
    throw error;
  }
}

// Example 2: Using the measureAsync utility
export async function exampleSearchWithTracking(query: string) {
  return measureAsync(PERF_OPERATIONS.SEARCH_TOTAL, async () => {
    // Generate text embedding
    const embedding = await measureAsync(
      PERF_OPERATIONS.SEARCH_TEXT_EMBEDDING,
      () => generateTextEmbedding(query)
    );

    // Perform vector search
    const results = await measureAsync(
      PERF_OPERATIONS.SEARCH_VECTOR_QUERY,
      () => searchByVector(embedding)
    );

    return results;
  });
}

// Example 3: Manual tracking with direct duration
export function trackManualMetric(operation: string, duration: number) {
  const tracker = getGlobalPerformanceTracker();
  tracker.track(operation, duration);
}

// Example 4: Integration with existing upload endpoint
export async function enhancedUploadEndpoint(request: Request) {
  const tracker = getGlobalPerformanceTracker();
  const startTime = Date.now();

  try {
    // Process upload...
    const result = await processUpload(request);

    // Track the operation
    tracker.track(PERF_OPERATIONS.UPLOAD_TOTAL, Date.now() - startTime);

    // Log summary periodically
    if (tracker.getSampleCount(PERF_OPERATIONS.UPLOAD_TOTAL) % 10 === 0) {
      tracker.logSummary();
    }

    return result;
  } catch (error) {
    tracker.track(PERF_OPERATIONS.UPLOAD_TOTAL, Date.now() - startTime);
    throw error;
  }
}

// Example 5: Client-side performance tracking for file selection
export function trackFileSelection(files: File[]) {
  const tracker = getGlobalPerformanceTracker();

  // Track time from file select to upload start
  tracker.start(PERF_OPERATIONS.CLIENT_FILE_SELECT);

  // Process files...
  processFiles(files);

  // When upload starts
  tracker.end(PERF_OPERATIONS.CLIENT_FILE_SELECT);
  tracker.start(PERF_OPERATIONS.CLIENT_UPLOAD_START);
}

// Example 6: Embedding queue performance tracking
export class EmbeddingQueueWithTracking {
  private tracker = getGlobalPerformanceTracker();

  async processEmbedding(assetId: string) {
    // Track queue wait time
    this.tracker.start(`${PERF_OPERATIONS.EMBEDDING_QUEUE_WAIT}:${assetId}`);
    await this.waitForTurn();
    this.tracker.end(`${PERF_OPERATIONS.EMBEDDING_QUEUE_WAIT}:${assetId}`);

    // Track total embedding generation
    return measureAsync(PERF_OPERATIONS.EMBEDDING_GENERATE, async () => {
      // Track Replicate API call
      const embedding = await measureAsync(
        PERF_OPERATIONS.EMBEDDING_REPLICATE_API,
        () => callReplicateAPI(assetId)
      );

      // Track database write
      await measureAsync(
        PERF_OPERATIONS.EMBEDDING_DB_WRITE,
        () => saveEmbedding(assetId, embedding)
      );

      return embedding;
    });
  }

  private async waitForTurn() {
    // Queue logic...
  }
}

// Example 7: Getting performance insights
export function getPerformanceInsights() {
  const tracker = getGlobalPerformanceTracker();

  // Check if we're meeting SLOs
  const uploadAvg = tracker.getAverage(PERF_OPERATIONS.UPLOAD_SINGLE);
  const uploadP95 = tracker.getP95(PERF_OPERATIONS.UPLOAD_SINGLE);
  const embeddingAvg = tracker.getAverage(PERF_OPERATIONS.EMBEDDING_TOTAL);

  const insights = {
    uploadPerformance: {
      average: uploadAvg,
      p95: uploadP95,
      meetingSLO: uploadAvg < 1000, // <1s average
      samples: tracker.getSampleCount(PERF_OPERATIONS.UPLOAD_SINGLE),
    },
    embeddingPerformance: {
      average: embeddingAvg,
      meetingSLO: embeddingAvg < 5000, // <5s average
      samples: tracker.getSampleCount(PERF_OPERATIONS.EMBEDDING_TOTAL),
    },
  };

  // Log detailed summary if in debug mode
  if (localStorage.getItem('debug_performance') === 'true') {
    console.log('[perf] Performance Insights:', insights);
    tracker.logSummary();
  }

  return insights;
}

// Example 8: Export and import metrics for analysis
export function exportMetrics() {
  const tracker = getGlobalPerformanceTracker();
  const data = tracker.export();

  // Save to localStorage or send to analytics
  localStorage.setItem('performance_metrics', JSON.stringify(data));

  return data;
}

export function importMetrics() {
  const tracker = getGlobalPerformanceTracker();
  const stored = localStorage.getItem('performance_metrics');

  if (stored) {
    const data = JSON.parse(stored);
    tracker.import(data);
  }
}

// Placeholder functions (would be actual implementations in real code)
async function uploadToBlob(file: File): Promise<string> {
  return 'blob-url';
}

async function saveToDatabase(url: string, file: File): Promise<any> {
  return { id: '123', url };
}

async function generateTextEmbedding(query: string): Promise<number[]> {
  return [0.1, 0.2, 0.3];
}

async function searchByVector(embedding: number[]): Promise<any[]> {
  return [];
}

async function processUpload(request: Request): Promise<any> {
  return { success: true };
}

function processFiles(files: File[]): void {
  // Process files
}

async function callReplicateAPI(assetId: string): Promise<number[]> {
  return [0.1, 0.2, 0.3];
}

async function saveEmbedding(assetId: string, embedding: number[]): Promise<void> {
  // Save to database
}