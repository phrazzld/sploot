/**
 * Performance tracking utility for monitoring operation durations and calculating metrics
 */

export class PerformanceTracker {
  private metrics: Map<string, number[]> = new Map();
  private maxSamplesPerMetric = 100;
  private startTimes: Map<string, number> = new Map();

  /**
   * Track the duration of an operation.
   * @param operation - The name of the operation being tracked
   * @param duration - The duration in milliseconds
   */
  track(operation: string, duration: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }

    const samples = this.metrics.get(operation)!;
    samples.push(duration);

    // Keep only the last N samples
    if (samples.length > this.maxSamplesPerMetric) {
      samples.shift();
    }

    // Log if in debug mode
    if (typeof window !== 'undefined' && localStorage.getItem('debug_performance') === 'true') {
      console.log(`[perf] ${operation}: ${duration}ms (avg: ${this.getAverage(operation).toFixed(1)}ms, p95: ${this.getP95(operation).toFixed(1)}ms)`);
    }
  }

  /**
   * Start timing an operation. Call end() to complete and track.
   * @param operation - The name of the operation to start timing
   */
  start(operation: string): void {
    this.startTimes.set(operation, Date.now());
  }

  /**
   * End timing an operation and automatically track it.
   * @param operation - The name of the operation to end timing
   * @returns The duration in milliseconds, or undefined if start was not called
   */
  end(operation: string): number | undefined {
    const startTime = this.startTimes.get(operation);
    if (startTime === undefined) {
      console.warn(`[perf] end() called for '${operation}' without matching start()`);
      return undefined;
    }

    const duration = Date.now() - startTime;
    this.track(operation, duration);
    this.startTimes.delete(operation);
    return duration;
  }

  /**
   * Get the average duration for an operation.
   * @param operation - The name of the operation
   * @returns The average duration in milliseconds, or 0 if no samples
   */
  getAverage(operation: string): number {
    const samples = this.metrics.get(operation);
    if (!samples || samples.length === 0) {
      return 0;
    }

    const sum = samples.reduce((acc, val) => acc + val, 0);
    return sum / samples.length;
  }

  /**
   * Get the 95th percentile duration for an operation.
   * @param operation - The name of the operation
   * @returns The P95 duration in milliseconds, or 0 if no samples
   */
  getP95(operation: string): number {
    const samples = this.metrics.get(operation);
    if (!samples || samples.length === 0) {
      return 0;
    }

    // Sort samples to calculate percentile
    const sorted = [...samples].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get the 50th percentile (median) duration for an operation.
   * @param operation - The name of the operation
   * @returns The median duration in milliseconds, or 0 if no samples
   */
  getMedian(operation: string): number {
    const samples = this.metrics.get(operation);
    if (!samples || samples.length === 0) {
      return 0;
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    return sorted[middle];
  }

  /**
   * Get the minimum duration for an operation.
   * @param operation - The name of the operation
   * @returns The minimum duration in milliseconds, or 0 if no samples
   */
  getMin(operation: string): number {
    const samples = this.metrics.get(operation);
    if (!samples || samples.length === 0) {
      return 0;
    }
    return Math.min(...samples);
  }

  /**
   * Get the maximum duration for an operation.
   * @param operation - The name of the operation
   * @returns The maximum duration in milliseconds, or 0 if no samples
   */
  getMax(operation: string): number {
    const samples = this.metrics.get(operation);
    if (!samples || samples.length === 0) {
      return 0;
    }
    return Math.max(...samples);
  }

  /**
   * Get the number of samples for an operation.
   * @param operation - The name of the operation
   * @returns The number of samples
   */
  getSampleCount(operation: string): number {
    const samples = this.metrics.get(operation);
    return samples ? samples.length : 0;
  }

  /**
   * Get all tracked operations.
   * @returns An array of operation names
   */
  getOperations(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Get a summary of all metrics for an operation.
   * @param operation - The name of the operation
   * @returns An object with all metrics, or null if no samples
   */
  getSummary(operation: string): {
    operation: string;
    samples: number;
    average: number;
    median: number;
    min: number;
    max: number;
    p95: number;
  } | null {
    const samples = this.getSampleCount(operation);
    if (samples === 0) {
      return null;
    }

    return {
      operation,
      samples,
      average: this.getAverage(operation),
      median: this.getMedian(operation),
      min: this.getMin(operation),
      max: this.getMax(operation),
      p95: this.getP95(operation),
    };
  }

  /**
   * Get a summary of all tracked operations.
   * @returns An array of summaries for all operations
   */
  getAllSummaries(): Array<NonNullable<ReturnType<typeof this.getSummary>>> {
    return this.getOperations()
      .map(op => this.getSummary(op))
      .filter((summary): summary is NonNullable<typeof summary> => summary !== null);
  }

  /**
   * Reset all metrics or metrics for a specific operation.
   * @param operation - Optional operation name to reset. If not provided, resets all.
   */
  reset(operation?: string): void {
    if (operation) {
      this.metrics.delete(operation);
      this.startTimes.delete(operation);
    } else {
      this.metrics.clear();
      this.startTimes.clear();
    }
  }

  /**
   * Export metrics data for analysis or persistence.
   * @returns An object with all metrics data
   */
  export(): Record<string, number[]> {
    const data: Record<string, number[]> = {};
    this.metrics.forEach((samples, operation) => {
      data[operation] = [...samples];
    });
    return data;
  }

  /**
   * Import metrics data from a previous export.
   * @param data - The metrics data to import
   */
  import(data: Record<string, number[]>): void {
    this.reset();
    Object.entries(data).forEach(([operation, samples]) => {
      this.metrics.set(operation, [...samples]);
    });
  }

  /**
   * Log a formatted summary to the console.
   */
  logSummary(): void {
    const summaries = this.getAllSummaries();
    if (summaries.length === 0) {
      console.log('[perf] No performance metrics tracked yet');
      return;
    }

    console.log('[perf] Performance Summary:');
    console.table(
      summaries.map(s => ({
        Operation: s.operation,
        Samples: s.samples,
        'Avg (ms)': s.average.toFixed(1),
        'Median (ms)': s.median.toFixed(1),
        'Min (ms)': s.min.toFixed(1),
        'Max (ms)': s.max.toFixed(1),
        'P95 (ms)': s.p95.toFixed(1),
      }))
    );
  }
}

// Singleton instance for global usage
let globalTracker: PerformanceTracker | null = null;

/**
 * Get the global performance tracker instance.
 * Creates one if it doesn't exist.
 */
export function getGlobalPerformanceTracker(): PerformanceTracker {
  if (!globalTracker) {
    globalTracker = new PerformanceTracker();
  }
  return globalTracker;
}

// Export commonly used operation names as constants
export const PERF_OPERATIONS = {
  // Upload operations
  UPLOAD_SINGLE: 'upload:single',
  UPLOAD_BATCH: 'upload:batch',
  UPLOAD_TO_BLOB: 'upload:blob_storage',
  UPLOAD_TO_DB: 'upload:database_write',
  UPLOAD_TOTAL: 'upload:total',

  // Embedding operations
  EMBEDDING_GENERATE: 'embedding:generate',
  EMBEDDING_QUEUE_WAIT: 'embedding:queue_wait',
  EMBEDDING_REPLICATE_API: 'embedding:replicate_api',
  EMBEDDING_DB_WRITE: 'embedding:db_write',
  EMBEDDING_TOTAL: 'embedding:total',

  // Search operations
  SEARCH_TEXT_EMBEDDING: 'search:text_embedding',
  SEARCH_VECTOR_QUERY: 'search:vector_query',
  SEARCH_TOTAL: 'search:total',

  // Client operations
  CLIENT_FILE_SELECT: 'client:file_select',
  CLIENT_UPLOAD_START: 'client:upload_start',
  CLIENT_TO_SEARCHABLE: 'client:to_searchable',
  CLIENT_PAGE_LOAD: 'client:page_load',
  CLIENT_IMAGE_GRID_RENDER: 'client:image_grid_render',

  // Database operations
  DB_QUERY: 'db:query',
  DB_WRITE: 'db:write',
  DB_TRANSACTION: 'db:transaction',
} as const;

// Export type for operation names
export type PerfOperation = typeof PERF_OPERATIONS[keyof typeof PERF_OPERATIONS];

/**
 * Utility function to measure async operations.
 * @param operation - The operation name to track
 * @param fn - The async function to measure
 * @returns The result of the async function
 */
export async function measureAsync<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const tracker = getGlobalPerformanceTracker();
  tracker.start(operation);
  try {
    const result = await fn();
    tracker.end(operation);
    return result;
  } catch (error) {
    tracker.end(operation);
    throw error;
  }
}

/**
 * Utility function to measure sync operations.
 * @param operation - The operation name to track
 * @param fn - The function to measure
 * @returns The result of the function
 */
export function measureSync<T>(
  operation: string,
  fn: () => T
): T {
  const tracker = getGlobalPerformanceTracker();
  tracker.start(operation);
  try {
    const result = fn();
    tracker.end(operation);
    return result;
  } catch (error) {
    tracker.end(operation);
    throw error;
  }
}