# Sploot TODO V2 - Ultra-Robust Bulk Upload Architecture

> "Premature optimization is the root of all evil, but mature optimization is the root of all performance." - John Carmack (paraphrased)

## 🔴 CRITICAL: Fix ERR_INSUFFICIENT_RESOURCES (Browser Connection Exhaustion)

### Root Cause: Uncoordinated Polling Storm
**Impact**: 54 files = 36 requests/second = browser crash
**Target**: 10,000 files = 1-2 requests/second total

- [x] **Replace 54 individual `useEmbeddingStatus` hooks with single centralized manager** (`hooks/use-embedding-status-manager.ts`)
  ```typescript
  // CURRENT: Each file creates its own hook = O(n) connections
  // NEW: Single manager, event-driven updates = O(1) connections
  class EmbeddingStatusManager {
    private static instance: EmbeddingStatusManager;
    private subscribers = new Map<string, Set<(status) => void>>();
    private statuses = new Map<string, EmbeddingStatus>();
    private batchTimer: NodeJS.Timeout;
    private pendingBatch = new Set<string>();
  }
  ```
  - Singleton pattern to ensure exactly ONE instance
  - Batch all status checks into 50-item chunks every 2 seconds
  - Use existing `/api/assets/batch/embedding-status` endpoint (already implemented but unused!)
  - Test: Monitor Network tab, should see max 1 request every 2s regardless of file count
  - Success metric: 100 files = 2 requests total (not 200)

- [x] **Create React Context for embedding status distribution** (`contexts/embedding-status-context.tsx`)
  ```typescript
  const EmbeddingStatusContext = createContext<{
    subscribe: (assetId: string, callback: StatusCallback) => () => void;
    getStatus: (assetId: string) => EmbeddingStatus | undefined;
    triggerRetry: (assetId: string) => void;
  }>();
  ```
  - Components subscribe/unsubscribe on mount/unmount
  - Manager pushes updates via callbacks (no polling in components)
  - Automatic cleanup on unmount prevents memory leaks
  - Test: React DevTools should show single context provider, not 54 individual hooks

- [x] **Refactor `EmbeddingStatusIndicator` to use context subscription** (`components/upload/upload-zone.tsx:37-120`)
  ```typescript
  // REMOVE: const embeddingStatus = useEmbeddingStatus({ assetId, enabled, ... });
  // ADD: const { subscribe, getStatus } = useContext(EmbeddingStatusContext);
  useEffect(() => {
    if (!file.assetId) return;
    const unsubscribe = subscribe(file.assetId, (status) => {
      onStatusChange(status.state, status.error);
    });
    return unsubscribe; // Cleanup on unmount
  }, [file.assetId]);
  ```
  - Zero polling logic in component
  - Pure presentation layer
  - Test: Component should never make direct API calls

- [x] **Implement connection pooling with hard limit** (`lib/connection-pool.ts`)
  ```typescript
  class ConnectionPool {
    private readonly MAX_CONCURRENT = 4; // Chrome limit is 6, leave 2 for user actions
    private inFlight = new Map<string, Promise<Response>>();
    private queue: Array<() => Promise<Response>> = [];

    async execute(fn: () => Promise<Response>): Promise<Response> {
      while (this.inFlight.size >= this.MAX_CONCURRENT) {
        await Promise.race(Array.from(this.inFlight.values()));
      }
      // Execute with tracking
    }
  }
  ```
  - Global singleton enforces connection limit across entire app
  - Queue excess requests instead of firing immediately
  - Test: Open Network tab, filter by domain, never see >4 concurrent
  - Metric: Zero ERR_INSUFFICIENT_RESOURCES with 1000 files

- [x] **Add circuit breaker for connection errors** (`lib/circuit-breaker.ts`)
  ```typescript
  class CircuitBreaker {
    private failures = 0;
    private lastFailureTime = 0;
    private state: 'closed' | 'open' | 'half-open' = 'closed';
    private readonly threshold = 5;
    private readonly timeout = 30000; // 30s cooldown

    async execute<T>(fn: () => Promise<T>): Promise<T> {
      if (this.state === 'open' && Date.now() - this.lastFailureTime < this.timeout) {
        throw new Error('Circuit breaker is OPEN - too many failures');
      }
      // Execute with failure tracking
    }
  }
  ```
  - Detect ERR_INSUFFICIENT_RESOURCES → open circuit immediately
  - Stop ALL requests for 30s to let browser recover
  - Half-open: try 1 request, if success → closed, if fail → open
  - Test: Trigger 5 failures rapidly, verify all requests pause for 30s
  - Log: `[CircuitBreaker] OPEN: Pausing requests for 30s due to resource exhaustion`

## 🚀 Phase 1: Stream-Based File Processing (Prevent Memory Exhaustion)

### Problem: 10,000 files × 5MB = 50GB in browser memory = crash
### Solution: Process files as streams, never hold more than 100MB in memory

- [x] **Implement `FileStreamProcessor` for chunked reading** (`lib/file-stream-processor.ts`)
  ```typescript
  class FileStreamProcessor {
    private readonly CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
    private readonly MAX_MEMORY = 100 * 1024 * 1024; // 100MB max
    private currentMemoryUsage = 0;

    async *processFiles(fileList: FileList): AsyncGenerator<ProcessedFile> {
      for (let i = 0; i < fileList.length; i++) {
        // Wait if memory limit exceeded
        while (this.currentMemoryUsage > this.MAX_MEMORY) {
          await new Promise(r => setTimeout(r, 100));
        }

        const file = fileList[i];
        const stream = file.stream();
        const reader = stream.getReader();

        try {
          // Process without loading entire file
          const chunks: Uint8Array[] = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            this.currentMemoryUsage += value.byteLength;
          }

          yield { file: file.name, chunks, checksum: await this.computeChecksum(chunks) };
        } finally {
          reader.releaseLock();
          this.currentMemoryUsage -= file.size;
          // Explicitly null the reference
          fileList[i] = null as any;
        }
      }
    }
  }
  ```
  - Uses native File.stream() API (available in all modern browsers)
  - Processes one file at a time to limit memory
  - Explicitly nulls references after processing
  - Test: Upload 1000 × 10MB files, monitor Chrome Task Manager, memory should stay <500MB
  - Metric: O(1) memory usage regardless of total file size

- [ ] **Replace array-based file handling with generator pattern** (`components/upload/upload-zone.tsx:524-627`)
  ```typescript
  // CURRENT: const filesArray = Array.from(fileList); // Holds all files in memory
  // NEW:
  const processor = new FileStreamProcessor();
  for await (const processed of processor.processFiles(fileList)) {
    // Process one at a time
    await uploadProcessedFile(processed);
    // File reference already released by processor
  }
  ```
  - Never convert FileList to array (that duplicates references)
  - Process files lazily as generator yields them
  - Test: Add console.log for memory usage, verify it stays constant

- [ ] **Implement streaming upload with TransformStream** (`lib/upload-stream.ts`)
  ```typescript
  class UploadStream {
    createUploadStream(file: File): ReadableStream {
      const CHUNK_SIZE = 256 * 1024; // 256KB chunks for optimal TCP performance

      return file.stream().pipeThrough(
        new TransformStream({
          async transform(chunk, controller) {
            // Add checksum computation
            const hash = await crypto.subtle.digest('SHA-256', chunk);
            controller.enqueue({
              data: chunk,
              checksum: btoa(String.fromCharCode(...new Uint8Array(hash))),
              offset: this.offset,
              total: file.size
            });
            this.offset += chunk.byteLength;
          }
        })
      );
    }
  }
  ```
  - Streams directly from File to network without intermediate buffers
  - Computes checksums on-the-fly
  - Test: Upload 1GB file, memory usage should increase by <10MB

## 🎯 Phase 2: Virtual DOM for Arbitrary Scale UI

### Problem: 10,000 DOM nodes = 2GB memory + 10s render time
### Solution: Virtual window with component pooling

- [ ] **Implement component pool for reuse** (`components/upload/virtual-file-list.tsx`)
  ```typescript
  class ComponentPool<T> {
    private pool: T[] = [];
    private inUse = new WeakSet<T>();
    private factory: () => T;

    constructor(factory: () => T, initialSize = 100) {
      this.factory = factory;
      // Pre-allocate components
      for (let i = 0; i < initialSize; i++) {
        this.pool.push(factory());
      }
    }

    acquire(): T {
      let component = this.pool.pop();
      if (!component) {
        component = this.factory();
      }
      this.inUse.add(component);
      return component;
    }

    release(component: T): void {
      if (this.inUse.has(component)) {
        this.inUse.delete(component);
        this.pool.push(component);
      }
    }
  }
  ```
  - Reuse components instead of creating/destroying
  - WeakSet prevents memory leaks
  - Test: Scroll through 10,000 items, verify only ~100 components created total

- [ ] **Replace file array with metadata Map** (`components/upload/upload-zone.tsx`)
  ```typescript
  // CURRENT: const [files, setFiles] = useState<UploadFile[]>([]); // Full objects in memory
  // NEW:
  const [fileMetadata] = useState(() => new Map<string, FileMetadata>());

  interface FileMetadata {
    id: string;
    name: string; // max 255 bytes
    size: number; // 8 bytes
    status: UploadStatus; // 1 byte enum
    progress: number; // 4 bytes
    // Total: ~300 bytes per file (vs 5MB for File object)
  }
  ```
  - Store only display metadata, not File objects
  - 10,000 files × 300 bytes = 3MB (vs 50GB)
  - Test: Check Chrome DevTools Memory profiler, no File objects retained

- [ ] **Integrate react-window with dynamic row heights** (`components/upload/file-list-virtual.tsx`)
  ```typescript
  import { VariableSizeList } from 'react-window';

  const FileListVirtual = ({ fileIds }: { fileIds: string[] }) => {
    const listRef = useRef<VariableSizeList>();
    const rowHeights = useRef<Map<number, number>>(new Map());

    const getItemSize = (index: number) => {
      return rowHeights.current.get(index) || 72; // Default height
    };

    const setItemSize = (index: number, size: number) => {
      rowHeights.current.set(index, size);
      listRef.current?.resetAfterIndex(index);
    };

    return (
      <VariableSizeList
        ref={listRef}
        height={600}
        itemCount={fileIds.length}
        itemSize={getItemSize}
        width="100%"
        overscanCount={5} // Render 5 extra items for smooth scrolling
      >
        {({ index, style }) => (
          <FileRow
            key={fileIds[index]}
            fileId={fileIds[index]}
            style={style}
            onResize={(height) => setItemSize(index, height)}
          />
        )}
      </VariableSizeList>
    );
  };
  ```
  - Only renders visible + 5 overscan items
  - Supports dynamic heights for error messages
  - Test: Scroll performance should be 60fps with 10,000 items

## 🔧 Phase 3: WebSocket for Real-time Updates

### Problem: Polling creates O(n) requests
### Solution: Single WebSocket with pub/sub

- [ ] **Create WebSocket manager with auto-reconnect** (`lib/websocket-manager.ts`)
  ```typescript
  class WebSocketManager {
    private ws: WebSocket | null = null;
    private subscriptions = new Map<string, Set<(data: any) => void>>();
    private messageQueue: any[] = [];
    private reconnectAttempts = 0;
    private readonly MAX_RECONNECT_ATTEMPTS = 5;
    private readonly RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000];

    connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.ws = new WebSocket(`${protocol}//${window.location.host}/api/ws/upload-status`);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.flushMessageQueue();
        this.resubscribeAll();
      };

      this.ws.onclose = () => {
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        // Fall back to polling
        this.enablePollingFallback();
      };

      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.distributeMessage(message);
      };
    }

    private scheduleReconnect() {
      if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
        console.error('[WebSocket] Max reconnection attempts reached');
        this.enablePollingFallback();
        return;
      }

      const delay = this.RECONNECT_DELAYS[this.reconnectAttempts];
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, delay);
    }
  }
  ```
  - Single connection for entire app
  - Exponential backoff on reconnect
  - Falls back to polling if WebSocket unavailable
  - Test: Kill server, restart, verify auto-reconnect within 16s
  - Metric: 1 connection for any number of files

- [ ] **Implement server-side WebSocket handler** (`app/api/ws/upload-status/route.ts`)
  ```typescript
  export async function GET(request: Request) {
    const { socket, response } = Deno.upgradeWebSocket(request); // Or use ws library

    socket.onmessage = async (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'subscribe':
          await subscribeToAssets(socket, message.assetIds);
          break;
        case 'unsubscribe':
          await unsubscribeFromAssets(socket, message.assetIds);
          break;
      }
    };

    // Set up Redis pub/sub or database triggers
    const subscription = redis.subscribe(`embedding-updates`, (message) => {
      const update = JSON.parse(message);
      // Send only to clients subscribed to this asset
      if (isSubscribed(socket, update.assetId)) {
        socket.send(JSON.stringify(update));
      }
    });

    socket.onclose = () => {
      subscription.unsubscribe();
      cleanupSubscriptions(socket);
    };

    return response;
  }
  ```
  - Uses Redis pub/sub for horizontal scaling
  - Tracks subscriptions per connection
  - Test: Open 10 tabs, verify updates propagate to all

- [ ] **Create PostgreSQL trigger for embedding completion** (`prisma/migrations/add_embedding_notify.sql`)
  ```sql
  -- Create notification function
  CREATE OR REPLACE FUNCTION notify_embedding_complete()
  RETURNS TRIGGER AS $$
  BEGIN
    -- Only notify on actual completion (not intermediate states)
    IF NEW.embedding_vector IS NOT NULL AND OLD.embedding_vector IS NULL THEN
      PERFORM pg_notify(
        'embedding_complete',
        json_build_object(
          'assetId', NEW.asset_id,
          'status', 'ready',
          'modelName', NEW.model_name,
          'timestamp', NEW.created_at
        )::text
      );
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  -- Create trigger
  CREATE TRIGGER embedding_completion_trigger
  AFTER INSERT OR UPDATE ON asset_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION notify_embedding_complete();

  -- Index for fast lookups
  CREATE INDEX idx_asset_embeddings_asset_id
  ON asset_embeddings(asset_id)
  WHERE embedding_vector IS NOT NULL;
  ```
  - Database pushes updates instead of polling
  - Zero-latency notification
  - Test: Insert embedding, verify WebSocket message within 100ms

## ⚡ Phase 4: Distributed Queue Architecture

### Problem: Single queue bottleneck at scale
### Solution: Multi-tier priority queues with sharding

- [ ] **Implement priority queue with deadletter handling** (`lib/distributed-queue.ts`)
  ```typescript
  class DistributedQueue {
    private queues = {
      urgent: new PriorityQueue<QueueItem>(0),     // User retries
      normal: new PriorityQueue<QueueItem>(1),     // Regular uploads
      background: new PriorityQueue<QueueItem>(2), // Batch operations
      dead: new Map<string, DeadLetterItem>()      // Permanent failures
    };

    private readonly MAX_RETRIES = {
      urgent: 10,     // Try harder for user-initiated
      normal: 5,      // Standard retry count
      background: 3   // Don't waste resources on background
    };

    private readonly BACKOFF_MULTIPLIER = {
      rate_limit: 5,    // Slow down for rate limits
      network: 2,       // Standard exponential
      server: 3,        // Server issues need more time
      invalid: Infinity // Never retry invalid data
    };

    async processNext(): Promise<void> {
      // Process urgent queue first
      if (!this.queues.urgent.isEmpty()) {
        return this.process(this.queues.urgent.dequeue(), 'urgent');
      }

      // Then normal with 80% probability
      if (!this.queues.normal.isEmpty() && Math.random() < 0.8) {
        return this.process(this.queues.normal.dequeue(), 'normal');
      }

      // Background gets remaining capacity
      if (!this.queues.background.isEmpty()) {
        return this.process(this.queues.background.dequeue(), 'background');
      }
    }

    private async process(item: QueueItem, priority: string): Promise<void> {
      try {
        await this.execute(item);
        this.recordSuccess(item);
      } catch (error) {
        const errorType = this.classifyError(error);
        const maxRetries = this.MAX_RETRIES[priority];

        if (item.retryCount >= maxRetries || errorType === 'invalid') {
          // Move to dead letter queue
          this.queues.dead.set(item.id, {
            ...item,
            error: error.message,
            failedAt: Date.now(),
            priority
          });
        } else {
          // Calculate backoff and requeue
          const backoff = Math.min(
            1000 * Math.pow(2, item.retryCount) * this.BACKOFF_MULTIPLIER[errorType],
            60000 // Cap at 1 minute
          );

          setTimeout(() => {
            item.retryCount++;
            this.queues[priority].enqueue(item);
          }, backoff);
        }
      }
    }
  }
  ```
  - Prioritizes user-initiated actions
  - Different retry strategies per queue
  - Dead letter queue for analysis
  - Test: Simulate 1000 mixed priority items, verify urgent processed first
  - Metric: P99 latency <1s for urgent queue even under load

- [ ] **Add queue sharding for horizontal scale** (`lib/queue-sharding.ts`)
  ```typescript
  class ShardedQueueSystem {
    private shards: Map<number, DistributedQueue>;
    private readonly SHARD_COUNT = 16; // Power of 2 for fast modulo

    constructor() {
      this.shards = new Map();
      for (let i = 0; i < this.SHARD_COUNT; i++) {
        this.shards.set(i, new DistributedQueue());
      }
    }

    private getShard(itemId: string): DistributedQueue {
      // Use consistent hashing for stable shard assignment
      const hash = this.hashString(itemId);
      const shardId = hash & (this.SHARD_COUNT - 1); // Fast modulo for power of 2
      return this.shards.get(shardId)!;
    }

    private hashString(str: string): number {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return Math.abs(hash);
    }

    async enqueue(item: QueueItem): Promise<void> {
      const shard = this.getShard(item.id);
      await shard.enqueue(item);
    }

    // Process all shards concurrently
    async processAll(): Promise<void> {
      const promises = Array.from(this.shards.values()).map(shard =>
        shard.processNext()
      );
      await Promise.all(promises);
    }
  }
  ```
  - Distributes load across 16 queues
  - Consistent hashing prevents hot shards
  - Parallel processing of all shards
  - Test: Enqueue 10,000 items, verify even distribution (±10%)
  - Metric: 16x throughput vs single queue

- [ ] **Implement queue persistence with IndexedDB** (`lib/queue-persistence.ts`)
  ```typescript
  class QueuePersistence {
    private db: IDBDatabase;
    private readonly DB_NAME = 'sploot_queue';
    private readonly STORE_NAME = 'queue_items';
    private readonly VERSION = 2;

    async init(): Promise<void> {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.DB_NAME, this.VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          if (!db.objectStoreNames.contains(this.STORE_NAME)) {
            const store = db.createObjectStore(this.STORE_NAME, {
              keyPath: 'id',
              autoIncrement: false
            });

            // Indexes for efficient queries
            store.createIndex('priority', 'priority', { unique: false });
            store.createIndex('status', 'status', { unique: false });
            store.createIndex('addedAt', 'addedAt', { unique: false });
            store.createIndex('priority_status', ['priority', 'status'], { unique: false });
          }
        };

        request.onsuccess = () => {
          this.db = request.result;
          resolve();
        };
      });
    }

    async saveQueueState(items: QueueItem[]): Promise<void> {
      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);

      // Batch insert for performance
      const promises = items.map(item => store.put(item));
      await Promise.all(promises);
    }

    async loadQueueState(): Promise<QueueItem[]> {
      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('priority_status');

      // Load in priority order
      const items: QueueItem[] = [];
      const request = index.openCursor();

      return new Promise((resolve) => {
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            items.push(cursor.value);
            cursor.continue();
          } else {
            resolve(items);
          }
        };
      });
    }

    async removeItem(id: string): Promise<void> {
      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      await store.delete(id);
    }
  }
  ```
  - Survives page refresh/browser crash
  - Indexed for fast priority queries
  - Batch operations for performance
  - Test: Add 1000 items, refresh page, verify all restored
  - Metric: <100ms to save/restore 1000 items

## 🔍 Phase 5: Monitoring & Observability

### Problem: Can't diagnose issues at scale
### Solution: Comprehensive metrics and tracing

- [ ] **Add performance metrics collection** (`lib/metrics-collector.ts`)
  ```typescript
  class MetricsCollector {
    private metrics = {
      uploads: new Map<string, UploadMetrics>(),
      api: new Map<string, ApiMetrics>(),
      memory: new Map<number, MemoryMetrics>(),
      errors: new Map<string, ErrorMetrics>()
    };

    private readonly HISTOGRAM_BUCKETS = [
      10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000
    ];

    recordUploadStart(id: string): void {
      this.metrics.uploads.set(id, {
        startTime: performance.now(),
        bytesUploaded: 0,
        chunks: 0,
        retries: 0
      });
    }

    recordUploadProgress(id: string, bytes: number): void {
      const metric = this.metrics.uploads.get(id);
      if (metric) {
        metric.bytesUploaded += bytes;
        metric.chunks++;

        // Calculate throughput
        const elapsed = performance.now() - metric.startTime;
        metric.throughput = metric.bytesUploaded / (elapsed / 1000); // bytes/sec
      }
    }

    recordApiCall(endpoint: string, duration: number, status: number): void {
      if (!this.metrics.api.has(endpoint)) {
        this.metrics.api.set(endpoint, {
          count: 0,
          totalDuration: 0,
          errors: 0,
          histogram: new Map()
        });
      }

      const metric = this.metrics.api.get(endpoint)!;
      metric.count++;
      metric.totalDuration += duration;

      if (status >= 400) {
        metric.errors++;
      }

      // Update histogram
      const bucket = this.HISTOGRAM_BUCKETS.find(b => duration <= b) || Infinity;
      metric.histogram.set(bucket, (metric.histogram.get(bucket) || 0) + 1);
    }

    recordMemoryUsage(): void {
      if (performance.memory) {
        const now = Date.now();
        this.metrics.memory.set(now, {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        });

        // Keep only last 5 minutes
        const cutoff = now - 5 * 60 * 1000;
        for (const [timestamp] of this.metrics.memory) {
          if (timestamp < cutoff) {
            this.metrics.memory.delete(timestamp);
          }
        }
      }
    }

    getReport(): MetricsReport {
      const report: MetricsReport = {
        uploads: {
          total: this.metrics.uploads.size,
          completed: 0,
          failed: 0,
          avgThroughput: 0,
          totalBytes: 0
        },
        api: {},
        memory: {
          current: 0,
          peak: 0,
          average: 0
        },
        errors: {
          total: 0,
          byType: {}
        }
      };

      // Calculate upload metrics
      let totalThroughput = 0;
      for (const [id, metric] of this.metrics.uploads) {
        report.uploads.totalBytes += metric.bytesUploaded;
        if (metric.throughput) {
          totalThroughput += metric.throughput;
        }
      }
      report.uploads.avgThroughput = totalThroughput / this.metrics.uploads.size;

      // Calculate API metrics
      for (const [endpoint, metric] of this.metrics.api) {
        report.api[endpoint] = {
          requests: metric.count,
          avgDuration: metric.totalDuration / metric.count,
          errorRate: metric.errors / metric.count,
          p50: this.calculatePercentile(metric.histogram, 0.5),
          p95: this.calculatePercentile(metric.histogram, 0.95),
          p99: this.calculatePercentile(metric.histogram, 0.99)
        };
      }

      // Calculate memory metrics
      const memoryValues = Array.from(this.metrics.memory.values());
      if (memoryValues.length > 0) {
        report.memory.current = memoryValues[memoryValues.length - 1].usedJSHeapSize;
        report.memory.peak = Math.max(...memoryValues.map(m => m.usedJSHeapSize));
        report.memory.average = memoryValues.reduce((sum, m) => sum + m.usedJSHeapSize, 0) / memoryValues.length;
      }

      return report;
    }
  }
  ```
  - Tracks every aspect of upload performance
  - Histogram for latency percentiles
  - Memory usage over time
  - Test: Upload 100 files, check report shows accurate metrics
  - Use for debugging: "Why is upload slow?" → Check p95 latency

- [ ] **Create debug overlay for development** (`components/debug/metrics-overlay.tsx`)
  ```typescript
  const MetricsOverlay = () => {
    const [metrics, setMetrics] = useState<MetricsReport | null>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
      // Only in development
      if (process.env.NODE_ENV !== 'development') return;

      // Keyboard shortcut: Ctrl+Shift+M
      const handleKeyPress = (e: KeyboardEvent) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'M') {
          setVisible(v => !v);
        }
      };

      window.addEventListener('keydown', handleKeyPress);

      // Update metrics every second
      const interval = setInterval(() => {
        if (visible) {
          const collector = getGlobalMetricsCollector();
          setMetrics(collector.getReport());
        }
      }, 1000);

      return () => {
        window.removeEventListener('keydown', handleKeyPress);
        clearInterval(interval);
      };
    }, [visible]);

    if (!visible || !metrics) return null;

    return (
      <div className="fixed top-0 right-0 bg-black/90 text-green-400 p-4 font-mono text-xs max-w-md">
        <h3 className="text-white mb-2">📊 Performance Metrics</h3>

        <section className="mb-3">
          <h4>Uploads</h4>
          <div>Total: {metrics.uploads.total}</div>
          <div>Throughput: {formatBytes(metrics.uploads.avgThroughput)}/s</div>
          <div>Total: {formatBytes(metrics.uploads.totalBytes)}</div>
        </section>

        <section className="mb-3">
          <h4>API Calls</h4>
          {Object.entries(metrics.api).map(([endpoint, data]) => (
            <div key={endpoint} className="ml-2 mb-1">
              <div className="text-blue-400">{endpoint}</div>
              <div>Requests: {data.requests}</div>
              <div>Avg: {data.avgDuration.toFixed(0)}ms</div>
              <div>P95: {data.p95}ms | P99: {data.p99}ms</div>
              <div className={data.errorRate > 0.05 ? 'text-red-400' : ''}>
                Errors: {(data.errorRate * 100).toFixed(1)}%
              </div>
            </div>
          ))}
        </section>

        <section className="mb-3">
          <h4>Memory</h4>
          <div>Current: {formatBytes(metrics.memory.current)}</div>
          <div>Peak: {formatBytes(metrics.memory.peak)}</div>
          <div>Average: {formatBytes(metrics.memory.average)}</div>
        </section>

        <section>
          <h4>Errors</h4>
          <div>Total: {metrics.errors.total}</div>
          {Object.entries(metrics.errors.byType).map(([type, count]) => (
            <div key={type} className="ml-2">
              {type}: {count}
            </div>
          ))}
        </section>
      </div>
    );
  };
  ```
  - Real-time performance monitoring
  - Helps identify bottlenecks immediately
  - Only in development mode
  - Test: Press Ctrl+Shift+M, verify overlay appears with live data

- [ ] **Add structured logging with context** (`lib/logger.ts`)
  ```typescript
  class StructuredLogger {
    private context = new Map<string, any>();
    private readonly LOG_LEVELS = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      fatal: 4
    };

    setContext(key: string, value: any): void {
      this.context.set(key, value);
    }

    private formatMessage(level: string, message: string, extra?: any): string {
      const timestamp = new Date().toISOString();
      const contextObj = Object.fromEntries(this.context);

      const log = {
        timestamp,
        level,
        message,
        ...contextObj,
        ...extra
      };

      // In production, send to logging service
      if (process.env.NODE_ENV === 'production') {
        this.sendToLoggingService(log);
      }

      // In development, pretty print
      if (process.env.NODE_ENV === 'development') {
        const emoji = {
          debug: '🔍',
          info: '💡',
          warn: '⚠️',
          error: '❌',
          fatal: '💀'
        }[level];

        return `${emoji} [${timestamp.split('T')[1].split('.')[0]}] ${message} ${JSON.stringify(extra || {})}`;
      }

      return JSON.stringify(log);
    }

    debug(message: string, extra?: any): void {
      console.log(this.formatMessage('debug', message, extra));
    }

    info(message: string, extra?: any): void {
      console.info(this.formatMessage('info', message, extra));
    }

    warn(message: string, extra?: any): void {
      console.warn(this.formatMessage('warn', message, extra));
    }

    error(message: string, error?: Error, extra?: any): void {
      console.error(this.formatMessage('error', message, {
        ...extra,
        error: {
          message: error?.message,
          stack: error?.stack,
          name: error?.name
        }
      }));
    }

    // Create child logger with additional context
    child(context: Record<string, any>): StructuredLogger {
      const child = new StructuredLogger();
      // Copy parent context
      for (const [key, value] of this.context) {
        child.context.set(key, value);
      }
      // Add new context
      for (const [key, value] of Object.entries(context)) {
        child.context.set(key, value);
      }
      return child;
    }
  }

  // Usage:
  const logger = new StructuredLogger();
  logger.setContext('userId', userId);
  logger.setContext('sessionId', sessionId);

  const uploadLogger = logger.child({ operation: 'upload', fileCount: 100 });
  uploadLogger.info('Starting bulk upload', { totalSize: '500MB' });
  uploadLogger.error('Upload failed', error, { fileId: 'abc-123', attempt: 3 });
  ```
  - Structured logs for better searching
  - Automatic context propagation
  - Pretty printing in development
  - Test: Trigger various log levels, verify formatting is consistent

## 🏁 Success Criteria & Metrics

### Performance Targets
- [ ] **10 files**: <5 seconds total (currently 30s)
- [ ] **100 files**: <30 seconds total (currently 5min)
- [ ] **1,000 files**: <5 minutes total (currently crashes)
- [ ] **10,000 files**: <30 minutes total (currently impossible)

### Resource Limits
- [ ] **Memory**: <500MB regardless of file count (O(1))
- [ ] **Concurrent connections**: ≤4 always (never exceed browser limit)
- [ ] **DOM nodes**: <200 visible at any time (virtual scrolling)
- [ ] **API requests/second**: <1 for status updates (batched)

### Error Handling
- [ ] **Zero ERR_INSUFFICIENT_RESOURCES** with any file count
- [ ] **100% automatic recovery** from transient failures
- [ ] **Dead letter queue** for permanent failures with clear error messages
- [ ] **Circuit breaker** prevents cascade failures

### User Experience
- [ ] **Instant feedback**: Upload starts within 100ms of selection
- [ ] **Real-time progress**: Updates every second via WebSocket
- [ ] **Smooth scrolling**: 60fps with 10,000 items
- [ ] **Resume on refresh**: IndexedDB persistence survives browser restart

## 📝 Notes

- "The best code is no code. The best optimization is a better algorithm." - Carmack
- Focus on the critical path first: Fix the connection exhaustion bug before adding features
- Measure everything: You can't optimize what you can't measure
- Test at scale early: Don't wait until production to find out it doesn't work
- Architecture > Implementation: A good architecture makes the implementation obvious

---

_"In the end, the best solution is rarely the most clever one, but rather the one that properly respects the fundamental constraints of the system."_ - John Carmack