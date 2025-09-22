# Sploot TODO - Performance Optimization & Reliability

## 🚨 CRITICAL: Batch Upload Performance (Target: <1s per image)

### Phase 1: Remove Synchronous Bottleneck (Immediate Impact)

- [x] **Remove sync_embeddings parameter from upload zone** (`components/upload/upload-zone.tsx:270`)
  - Change: `xhr.open('POST', '/api/upload?sync_embeddings=true');`
  - To: `xhr.open('POST', '/api/upload');`
  - Impact: Reduces upload time from ~3-4s to <1s per image
  - Test: Upload 10 images, should complete in <10s total (not 30-40s)

- [x] **Add performance timing to upload endpoint** (`app/api/upload/route.ts`)
  - Add `const startTime = Date.now();` at request start
  - Log: `console.log(\`[perf] Upload completed in ${Date.now() - startTime}ms\`);`
  - Track separately: blob storage time, database write time, embedding queue time
  - Success metric: Upload endpoint responds in <800ms without embedding generation

- [x] **Implement parallel upload batching** (`components/upload/upload-zone.tsx`)
  - Current: Files upload sequentially via `forEach`
  - Change to: `Promise.all()` with max concurrency of 3
  - Add: `const MAX_CONCURRENT_UPLOADS = 3;`
  - Implementation: Use p-limit or manual queue management
  - Success metric: 10 files start uploading within 100ms of each other

### Phase 2: Reliable Background Embedding Generation

- [x] **Create embedding queue manager** (`lib/embedding-queue.ts`)
  ```typescript
  interface EmbeddingQueueItem {
    assetId: string;
    blobUrl: string;
    checksum: string;
    priority: number; // 0 = high, 1 = normal
    retryCount: number;
    addedAt: number;
  }
  ```
  - Implement FIFO queue with priority support
  - Max concurrent embedding requests: 2 (Replicate API rate limits)
  - Retry logic: 3 attempts with exponential backoff (1s, 2s, 4s)
  - Persist queue to localStorage for recovery after page reload

- [x] **Add embedding status to Asset type** (`types/index.ts` or inline)
  ```typescript
  embeddingStatus: 'pending' | 'processing' | 'ready' | 'failed'
  embeddingError?: string
  embeddingRetryCount: number
  embeddingLastAttempt?: Date
  ```
  - Update all Asset interfaces across components
  - Ensure database schema supports these fields

- [x] **Modify upload response to include asset IDs** (`app/api/upload/route.ts:320-340`)
  - Current response: `{ url, pathname, message }`
  - Add: `{ assetId, needsEmbedding: true }`
  - Client uses this to start monitoring immediately

- [x] **Implement client-side embedding monitor** (`hooks/use-batch-embedding-status.ts`)
  - Monitor multiple assets simultaneously
  - Poll `/api/assets/batch/embedding-status` (new endpoint)
  - Batch status checks: Send array of asset IDs, receive status map
  - Auto-retry failed embeddings after 5 seconds
  - Stop monitoring after 10 retries or success
  - Performance: Single request for N assets, not N requests

### Phase 3: Optimized API Endpoints

- [x] **Create batch embedding status endpoint** (`app/api/assets/batch/embedding-status/route.ts`)
  ```typescript
  POST /api/assets/batch/embedding-status
  Body: { assetIds: string[] }
  Response: {
    statuses: { [assetId: string]: {
      hasEmbedding: boolean,
      status: 'pending' | 'processing' | 'ready' | 'failed',
      error?: string
    }}
  }
  ```
  - Single database query with `WHERE id IN (...)`
  - Max 50 assets per request
  - Response time target: <100ms for 50 assets

- [x] **Optimize embedding generation endpoint** (`app/api/assets/[id]/generate-embedding/route.ts`)
  - Add request deduplication (if already processing, return early)
  - Track in-flight requests in memory: `Map<assetId, Promise>`
  - Log performance metrics: Replicate API response time
  - Add circuit breaker: If 3 consecutive failures, pause for 30s

- [ ] **Add embeddings cleanup endpoint** (`app/api/cron/process-embeddings/route.ts`)
  ```typescript
  // Runs every 5 minutes via Vercel Cron or manual trigger
  - Find assets with embeddingStatus = 'failed' AND retryCount < 3
  - Find assets older than 1 hour with no embeddings
  - Process in batches of 10
  - Log: success rate, average processing time
  ```

### Phase 4: Visual Feedback & UX

- [ ] **Add embedding status badge to ImageTile** (`components/library/image-tile.tsx`)
  - Display states:
    - `pending`: Yellow dot with pulse animation
    - `processing`: Blue spinner (CSS animation, no JS)
    - `ready`: Green checkmark (fade in on completion)
    - `failed`: Red X with retry button
  - Position: Bottom-left corner, 8px padding
  - Size: 24x24px icon area
  - Click behavior: If failed, trigger manual retry

- [ ] **Create upload progress header** (`components/upload/upload-progress-header.tsx`)
  ```typescript
  interface ProgressStats {
    totalFiles: number
    uploaded: number
    processingEmbeddings: number
    ready: number
    failed: number
    estimatedTimeRemaining: number // ms
  }
  ```
  - Real-time stats update via React state
  - Progress bar: Dual-layer (upload progress + embedding progress)
  - Time estimate: Based on rolling average of last 5 operations
  - Minimize/expand capability to reduce visual noise

- [ ] **Add inline embedding status to upload zone** (`components/upload/upload-zone.tsx`)
  - After upload completes, show: "✓ Uploaded • Preparing search..."
  - Monitor embedding generation, update to: "✓ Ready to search"
  - If fails: "⚠️ Upload complete • Search prep failed [Retry]"
  - Auto-dismiss success after 3s, keep failures visible

### Phase 5: Performance Monitoring & Metrics

- [ ] **Add performance tracking utility** (`lib/performance.ts`)
  ```typescript
  class PerformanceTracker {
    private metrics: Map<string, number[]> = new Map();

    track(operation: string, duration: number): void
    getAverage(operation: string): number
    getP95(operation: string): number
    reset(): void
  }
  ```
  - Track: upload time, embedding time, total time
  - Store last 100 samples per metric
  - Calculate percentiles for monitoring

- [ ] **Log critical performance metrics**
  - Upload API: Time to blob store, time to database
  - Embedding: Queue wait time, Replicate API time, total time
  - Client: Time from file select to "ready to search"
  - Success criteria:
    - Single image: <1s upload, <5s to searchable
    - 10 images: <10s upload, <15s to searchable
    - 50 images: <30s upload, <60s to searchable

- [ ] **Add debug mode for embedding status** (`components/library/image-tile.tsx`)
  - When `localStorage.debug_embeddings = 'true'`
  - Show detailed status: Queue position, retry count, error message
  - Log all embedding state transitions to console
  - Display Replicate API response time

### Phase 6: Error Handling & Recovery

- [ ] **Implement smart retry logic** (`lib/embedding-queue.ts`)
  - Exponential backoff: 1s, 2s, 4s, 8s, 16s
  - Different strategies per error type:
    - Rate limit (429): Wait full duration, don't count as retry
    - Network error: Immediate retry once, then backoff
    - Invalid image: Mark as permanently failed, don't retry
    - Server error (500): Standard backoff
  - Max retries: 5 for user-triggered, 3 for background

- [ ] **Add manual bulk retry action** (`app/app/page.tsx`)
  - Button: "Retry Failed Searches (N images)"
  - Only show if failed embeddings exist
  - Triggers batch processing of all failed assets
  - Shows progress modal during processing

- [ ] **Persist upload queue for recovery** (`lib/upload-queue.ts`)
  - Save pending uploads to IndexedDB (not localStorage - size limits)
  - On page load, check for incomplete uploads
  - Show notification: "Resume N interrupted uploads?"
  - Auto-resume after 3s if no user action

### Phase 7: Testing & Validation

- [ ] **Create embedding generation test suite** (`__tests__/embeddings/`)
  - Test: Upload without embedding blocks < 1s
  - Test: Embedding generates within 10s via background
  - Test: Failed embedding retries automatically
  - Test: 10 simultaneous uploads complete successfully
  - Test: Network interruption recovery

- [ ] **Add E2E test for batch upload** (`e2e/batch-upload.spec.ts`)
  - Upload 5 images simultaneously
  - Verify all show "uploading" state immediately
  - Verify all complete upload within 5s
  - Verify all become searchable within 15s
  - Verify search finds images by content

- [ ] **Load test embedding generation** (`scripts/load-test-embeddings.ts`)
  - Simulate 100 concurrent users uploading 10 images each
  - Measure: API response times, queue depth, failure rate
  - Identify bottlenecks: Database, Replicate API, server CPU
  - Target: System remains responsive under load

## Success Metrics

### Performance Targets
- **Upload Speed**: <1s per image (was 3-4s)
- **Batch Upload**: Linear scaling (10 images = ~10s, not 40s)
- **Time to Searchable**: <5s for single image, <15s for batch of 10
- **UI Responsiveness**: No blocking during upload or embedding generation

### Reliability Targets
- **Embedding Success Rate**: >95% on first attempt
- **Recovery Rate**: 100% within 3 retries
- **Data Loss**: Zero (all uploads persisted even if embedding fails)

### User Experience
- **Immediate Feedback**: Upload progress visible within 100ms
- **Clear Status**: User always knows state of their images
- **Graceful Degradation**: Images viewable even if search fails
- **One-Click Recovery**: Failed embeddings retryable with single action

## Implementation Order

1. **Quick Win** (30 min): Remove sync_embeddings parameter (immediate 3-4x speedup)
2. **Core Loop** (2 hours): Client-side monitoring + auto-retry
3. **Robustness** (2 hours): Queue manager + batch endpoints
4. **Polish** (1 hour): Visual feedback + progress indicators
5. **Validation** (1 hour): Tests + metrics

**Total Estimated Time**: 6-7 hours for complete implementation

## Notes

- The `after()` function in Next.js 15 is experimental but works in production on Vercel
- Prioritize upload speed over immediate searchability - users care more about seeing their images
- Consider webhook from Replicate when embedding completes (future optimization)
- Monitor Replicate API costs - batch processing might be more economical