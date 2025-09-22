/**
 * Embedding Queue Manager
 * Manages background embedding generation with retry logic and persistence
 */

export interface EmbeddingQueueItem {
  assetId: string;
  blobUrl: string;
  checksum: string;
  priority: number; // 0 = high, 1 = normal
  retryCount: number;
  addedAt: number;
  lastAttempt?: number;
  error?: string;
}

export type QueueEventType = 'added' | 'processing' | 'completed' | 'failed' | 'retry';

export interface QueueEvent {
  type: QueueEventType;
  item: EmbeddingQueueItem;
  timestamp: number;
}

type QueueListener = (event: QueueEvent) => void;

/**
 * EmbeddingQueueManager handles background embedding generation
 * with retry logic, persistence, and concurrency control
 */
export class EmbeddingQueueManager {
  private queue: EmbeddingQueueItem[] = [];
  private processing = new Map<string, Promise<void>>();
  private listeners = new Set<QueueListener>();
  private isRunning = false;
  private persistKey = 'sploot_embedding_queue';

  // Configuration
  private readonly MAX_CONCURRENT = 2; // Replicate API rate limits
  private readonly MAX_RETRIES = 3;
  private readonly BASE_RETRY_DELAY = 1000; // Start with 1s, then 2s, 4s, 8s

  constructor() {
    this.loadFromStorage();
    // Start processing if there are items in queue
    if (this.queue.length > 0) {
      this.start();
    }
  }

  /**
   * Add an item to the embedding queue
   */
  addToQueue(item: Omit<EmbeddingQueueItem, 'retryCount' | 'addedAt'>): void {
    const queueItem: EmbeddingQueueItem = {
      ...item,
      retryCount: 0,
      addedAt: Date.now(),
    };

    // Check if already in queue or processing
    if (this.isInQueue(item.assetId) || this.processing.has(item.assetId)) {
      console.log(`[EmbeddingQueue] Asset ${item.assetId} already queued or processing`);
      return;
    }

    // Add to queue based on priority
    if (item.priority === 0) {
      this.queue.unshift(queueItem); // High priority goes to front
    } else {
      this.queue.push(queueItem); // Normal priority goes to back
    }

    this.persistToStorage();
    this.notifyListeners({ type: 'added', item: queueItem, timestamp: Date.now() });

    // Start processing if not already running
    if (!this.isRunning) {
      this.start();
    }
  }

  /**
   * Remove an item from the queue
   */
  removeFromQueue(assetId: string): boolean {
    const index = this.queue.findIndex(item => item.assetId === assetId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.persistToStorage();
      return true;
    }
    return false;
  }

  /**
   * Get current queue status
   */
  getStatus(): {
    queued: number;
    processing: number;
    items: EmbeddingQueueItem[];
  } {
    return {
      queued: this.queue.length,
      processing: this.processing.size,
      items: [...this.queue],
    };
  }

  /**
   * Check if an asset is in the queue
   */
  isInQueue(assetId: string): boolean {
    return this.queue.some(item => item.assetId === assetId);
  }

  /**
   * Check if an asset is currently being processed
   */
  isProcessing(assetId: string): boolean {
    return this.processing.has(assetId);
  }

  /**
   * Start processing the queue
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.processQueue();
  }

  /**
   * Stop processing the queue
   */
  stop(): void {
    this.isRunning = false;
  }

  /**
   * Process items in the queue with concurrency control
   */
  private async processQueue(): Promise<void> {
    while (this.isRunning && (this.queue.length > 0 || this.processing.size > 0)) {
      // Start new processing up to concurrency limit
      while (
        this.queue.length > 0 &&
        this.processing.size < this.MAX_CONCURRENT &&
        this.isRunning
      ) {
        const item = this.queue.shift();
        if (!item) break;

        const processingPromise = this.processItem(item)
          .finally(() => {
            this.processing.delete(item.assetId);
          });

        this.processing.set(item.assetId, processingPromise);
      }

      // Wait for at least one to complete before continuing
      if (this.processing.size > 0) {
        await Promise.race(this.processing.values());
      }
    }

    // Queue is empty and nothing is processing
    this.isRunning = false;
  }

  /**
   * Process a single item with retry logic
   */
  private async processItem(item: EmbeddingQueueItem): Promise<void> {
    item.lastAttempt = Date.now();
    this.notifyListeners({ type: 'processing', item, timestamp: Date.now() });

    try {
      // Call the generate-embedding endpoint
      const response = await fetch(`/api/assets/${item.assetId}/generate-embedding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // Success! Notify listeners
      this.notifyListeners({ type: 'completed', item, timestamp: Date.now() });
      console.log(`[EmbeddingQueue] Successfully generated embedding for ${item.assetId}`);

    } catch (error) {
      console.error(`[EmbeddingQueue] Failed to generate embedding for ${item.assetId}:`, error);

      item.error = error instanceof Error ? error.message : String(error);
      item.retryCount++;

      // Check if we should retry
      if (item.retryCount < this.MAX_RETRIES) {
        // Calculate exponential backoff delay
        const delay = this.BASE_RETRY_DELAY * Math.pow(2, item.retryCount - 1);

        console.log(`[EmbeddingQueue] Will retry ${item.assetId} in ${delay}ms (attempt ${item.retryCount}/${this.MAX_RETRIES})`);

        // Re-add to queue after delay
        setTimeout(() => {
          if (!this.isInQueue(item.assetId) && !this.processing.has(item.assetId)) {
            this.queue.push(item);
            this.persistToStorage();
            this.notifyListeners({ type: 'retry', item, timestamp: Date.now() });

            if (!this.isRunning) {
              this.start();
            }
          }
        }, delay);
      } else {
        // Max retries reached, notify failure
        this.notifyListeners({ type: 'failed', item, timestamp: Date.now() });
        console.error(`[EmbeddingQueue] Max retries reached for ${item.assetId}`);
      }
    }

    // Persist current state
    this.persistToStorage();
  }

  /**
   * Subscribe to queue events
   */
  subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of an event
   */
  private notifyListeners(event: QueueEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[EmbeddingQueue] Listener error:', error);
      }
    });
  }

  /**
   * Persist queue to localStorage
   */
  private persistToStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const data = JSON.stringify({
          queue: this.queue,
          timestamp: Date.now(),
        });
        localStorage.setItem(this.persistKey, data);
      }
    } catch (error) {
      console.error('[EmbeddingQueue] Failed to persist queue:', error);
    }
  }

  /**
   * Load queue from localStorage
   */
  private loadFromStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const data = localStorage.getItem(this.persistKey);
        if (data) {
          const parsed = JSON.parse(data);
          // Only restore queue if it's less than 1 hour old
          if (parsed.timestamp && Date.now() - parsed.timestamp < 3600000) {
            this.queue = parsed.queue || [];
            console.log(`[EmbeddingQueue] Restored ${this.queue.length} items from storage`);
          } else {
            // Clear old data
            localStorage.removeItem(this.persistKey);
          }
        }
      }
    } catch (error) {
      console.error('[EmbeddingQueue] Failed to load queue from storage:', error);
      // Clear corrupted data
      try {
        localStorage.removeItem(this.persistKey);
      } catch {}
    }
  }

  /**
   * Clear the entire queue
   */
  clear(): void {
    this.queue = [];
    this.persistToStorage();
  }

  /**
   * Get failed items for manual retry
   */
  getFailedItems(): EmbeddingQueueItem[] {
    return this.queue.filter(item => item.retryCount >= this.MAX_RETRIES);
  }

  /**
   * Retry all failed items
   */
  retryFailed(): void {
    const failed = this.getFailedItems();
    failed.forEach(item => {
      item.retryCount = 0;
      item.error = undefined;
    });
    this.persistToStorage();
    if (!this.isRunning && failed.length > 0) {
      this.start();
    }
  }
}

// Singleton instance
let queueManagerInstance: EmbeddingQueueManager | null = null;

/**
 * Get the singleton queue manager instance
 */
export function getEmbeddingQueueManager(): EmbeddingQueueManager {
  if (!queueManagerInstance) {
    queueManagerInstance = new EmbeddingQueueManager();
  }
  return queueManagerInstance;
}

/**
 * Helper to add an asset to the embedding queue
 */
export function queueEmbeddingGeneration(
  assetId: string,
  blobUrl: string,
  checksum: string,
  priority: number = 1
): void {
  const manager = getEmbeddingQueueManager();
  manager.addToQueue({ assetId, blobUrl, checksum, priority });
}