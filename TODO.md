# Sploot TODO - Performance Optimization & Reliability

## 🔥 URGENT: Fix 68+ Image Batch Upload Failures

### Immediate UI Feedback Issues (User can't see upload starting)

- [x] **Integrate UploadProgressHeader into upload zone** (`components/upload/upload-zone.tsx:720-730`)
  - Import: `import { UploadProgressHeader, ProgressStats } from './upload-progress-header';`
  - Add state: `const [uploadStats, setUploadStats] = useState<ProgressStats | null>(null);`
  - Update stats in `processFilesWithQueue` after line 344: `setUploadStats({ totalFiles: newFiles.length, uploaded: 0, processingEmbeddings: 0, ready: 0, failed: 0, estimatedTimeRemaining: 0 });`
  - Render header above drop zone when `uploadStats !== null && uploadStats.totalFiles > 0`
  - Wire up stats updates in `uploadFileToServer` success/error handlers
  - Test: Select 68 files, header should appear immediately showing "0 of 68 uploaded"

- [x] **Show "Preparing files..." state during initial processing** (`components/upload/upload-zone.tsx:298-344`)
  - Add state: `const [isPreparing, setIsPreparing] = useState(false);`
  - Set to true at line 298: `setIsPreparing(true);`
  - Set to false at line 357: `setIsPreparing(false);`
  - Display overlay with spinner when `isPreparing === true`: "Preparing {fileList.length} files..."
  - Include total size calculation: `const totalSize = Array.from(fileList).reduce((acc, f) => acc + f.size, 0);`
  - Test: Drop 68 files, should see "Preparing 68 files (X MB)..." immediately

- [x] **Add file count preview before processing** (`components/upload/upload-zone.tsx:609-618`)
  - In `handleDrop`, add immediate feedback before `processFiles` call
  - Show toast: `showToast(\`Processing ${e.dataTransfer.files.length} files...\`, 'info');`
  - Add visual pulse to drop zone during processing
  - Test: Drag 68 files, toast appears before any processing starts

### Memory Management & Performance

- [x] **Increase concurrent upload limit for better throughput** (`components/upload/upload-zone.tsx:391`)
  - Change: `const MAX_CONCURRENT_UPLOADS = 3;`
  - To: `const MAX_CONCURRENT_UPLOADS = 6;`
  - Add adaptive concurrency based on success rate: if failures > 20%, reduce to 4
  - Monitor: `const failureRate = failed / (completed + failed);`
  - Test: Upload 68 files, should see 6 simultaneous XHR requests in Network tab

- [x] **Process files in chunks to prevent memory overload** (`components/upload/upload-zone.tsx:302-343`)
  - Add: `const FILE_PROCESSING_CHUNK_SIZE = 20;`
  - Replace single loop with chunked processing:
    ```typescript
    const chunks = [];
    for (let i = 0; i < fileList.length; i += FILE_PROCESSING_CHUNK_SIZE) {
      chunks.push(Array.from(fileList).slice(i, i + FILE_PROCESSING_CHUNK_SIZE));
    }
    for (const chunk of chunks) {
      await processChunk(chunk);
      // Allow UI to breathe between chunks
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    ```
  - Test: Upload 68 files, browser should remain responsive throughout

- [x] **Implement file reference cleanup after upload** (`components/upload/upload-zone.tsx:526-536`)
  - After successful upload at line 526, clear file reference:
  - Add: `delete (uploadFile as any).file;` to free memory
  - Keep only essential metadata for display
  - Monitor memory usage in Chrome DevTools during 68-file upload
  - Success: Memory should plateau, not continuously increase

### Batch State Updates

- [x] **Batch React state updates to reduce re-renders** (`components/upload/upload-zone.tsx:423-427`)
  - Import: `import { unstable_batchedUpdates } from 'react-dom';`
  - Wrap state updates in `unstable_batchedUpdates(() => { ... })`
  - Particularly in `uploadFileToServer` progress handler (lines 444-454)
  - Debounce progress updates: Only update every 10% or 500ms
  - Test: React DevTools Profiler should show <100 renders for 68-file upload (not 1000+)

- [x] **Add virtual scrolling for file list display** (`components/upload/upload-zone.tsx:830-900`)
  - When `files.length > 20`, use virtual scrolling
  - Import: `import { FixedSizeList } from 'react-window';`
  - Render only visible items in viewport
  - Row height: 64px per file item
  - Test: 68 files in list, smooth scrolling, <50 DOM nodes

### Server-Side Configuration

- [x] **Configure API route body size limit** (`app/api/upload/route.ts:1-5`)
  - Add export: `export const maxDuration = 60;` // 60 second timeout
  - Add export: `export const config = { api: { bodyParser: { sizeLimit: '50mb' } } };`
  - Note: Next.js 15 App Router uses different config format
  - May need to configure in `next.config.ts` instead
  - Test: Upload single 20MB image should succeed

- [x] **Add request timeout handling** (`components/upload/upload-zone.tsx:484-486`)
  - Add timeout to XHR: `xhr.timeout = 30000;` // 30 second timeout per file
  - Add timeout handler:
    ```typescript
    xhr.addEventListener('timeout', () => {
      reject(new Error('Upload timeout - file too large or slow connection'));
    });
    ```
  - Test: Throttle network to 3G, upload should timeout with clear message

### Error Recovery

- [x] **Implement automatic retry queue for failures** (`components/upload/upload-zone.tsx:390-416`)
  - Add: `const retryQueue: UploadFile[] = [];`
  - On failure, add to retry queue with exponential backoff
  - After main batch completes, process retry queue
  - Max 3 retries per file with delays: 1s, 3s, 9s
  - Test: Kill server mid-upload, restart, files should auto-retry

- [x] **Add "Retry All Failed" button for batch failures** (`components/upload/upload-zone.tsx:860-880`)
  - Show when `failedFiles.length > 0`
  - Button: `onClick={() => retryAllFailed()}`
  - Function should reset status and re-queue all failed files
  - Display: "{failedFiles.length} failed • [Retry All]"
  - Test: Fail 30 uploads, click retry, all should re-attempt

- [ ] **Show detailed failure reasons per file** (`components/upload/upload-zone.tsx:850-870`)
  - Parse error responses for specific failure reasons:
    - "File too large" (>10MB)
    - "Invalid file type" (not image)
    - "Network error" (connection failed)
    - "Server error" (500)
    - "Rate limited" (429)
  - Group failures by reason in UI
  - Test: Mix of valid/invalid files should show categorized errors

### Progress Optimization

- [ ] **Throttle progress updates to reduce UI thrashing** (`components/upload/upload-zone.tsx:444-454`)
  - Add: `const progressThrottle = new Map<string, number>();`
  - Only update if change > 5% or 500ms elapsed:
    ```typescript
    const lastProgress = progressThrottle.get(uploadFile.id) || 0;
    if (percentComplete - lastProgress >= 5 || Date.now() - lastUpdate > 500) {
      setFiles(...);
      progressThrottle.set(uploadFile.id, percentComplete);
    }
    ```
  - Test: Network tab should show smooth upload, UI updates ~20 times per file max

- [ ] **Add aggregate progress bar for entire batch** (`components/upload/upload-progress-header.tsx:35-47`)
  - Calculate: `totalBytesUploaded / totalBytesToUpload`
  - Show single progress bar for overall batch progress
  - Below that, show per-file status counts
  - Update every 100ms max using `requestAnimationFrame`
  - Test: 68 files should show smooth 0-100% progress

### Testing

- [ ] **Create test harness for large batch uploads** (`__tests__/e2e/large-batch-upload.spec.ts`)
  - Generate 100 test images programmatically
  - Test: Can handle 100 simultaneous files
  - Measure: Time to complete, memory usage, failure rate
  - Assert: <2min for 100 images, <500MB memory peak
  - Assert: Failure rate <5%

- [ ] **Add memory leak detection test** (`__tests__/performance/memory-leak.test.ts`)
  - Upload 50 files, complete, measure heap
  - Clear file list, force GC
  - Heap should return to baseline ±10MB
  - No detached DOM nodes
  - No lingering file references

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

- [x] **Add embeddings cleanup endpoint** (`app/api/cron/process-embeddings/route.ts`)
  ```typescript
  // Runs every 5 minutes via Vercel Cron or manual trigger
  - Find assets with embeddingStatus = 'failed' AND retryCount < 3
  - Find assets older than 1 hour with no embeddings
  - Process in batches of 10
  - Log: success rate, average processing time
  ```

### Phase 4: Visual Feedback & UX

- [x] **Add embedding status badge to ImageTile** (`components/library/image-tile.tsx`)
  - Display states:
    - `pending`: Yellow dot with pulse animation
    - `processing`: Blue spinner (CSS animation, no JS)
    - `ready`: Green checkmark (fade in on completion)
    - `failed`: Red X with retry button
  - Position: Bottom-left corner, 8px padding
  - Size: 24x24px icon area
  - Click behavior: If failed, trigger manual retry

- [x] **Create upload progress header** (`components/upload/upload-progress-header.tsx`)
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

- [x] **Add inline embedding status to upload zone** (`components/upload/upload-zone.tsx`)
  - After upload completes, show: "✓ Uploaded • Preparing search..."
  - Monitor embedding generation, update to: "✓ Ready to search"
  - If fails: "⚠️ Upload complete • Search prep failed [Retry]"
  - Auto-dismiss success after 3s, keep failures visible

### Phase 5: Performance Monitoring & Metrics

- [x] **Add performance tracking utility** (`lib/performance.ts`)
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

- [x] **Log critical performance metrics**
  - Upload API: Time to blob store, time to database
  - Embedding: Queue wait time, Replicate API time, total time
  - Client: Time from file select to "ready to search"
  - Success criteria:
    - Single image: <1s upload, <5s to searchable
    - 10 images: <10s upload, <15s to searchable
    - 50 images: <30s upload, <60s to searchable

- [x] **Add debug mode for embedding status** (`components/library/image-tile.tsx`)
  - When `localStorage.debug_embeddings = 'true'`
  - Show detailed status: Queue position, retry count, error message
  - Log all embedding state transitions to console
  - Display Replicate API response time

### Phase 6: Error Handling & Recovery

- [x] **Implement smart retry logic** (`lib/embedding-queue.ts`)
  - Exponential backoff: 1s, 2s, 4s, 8s, 16s
  - Different strategies per error type:
    - Rate limit (429): Wait full duration, don't count as retry
    - Network error: Immediate retry once, then backoff
    - Invalid image: Mark as permanently failed, don't retry
    - Server error (500): Standard backoff
  - Max retries: 5 for user-triggered, 3 for background

- [x] **Add manual bulk retry action** (`app/app/page.tsx`)
  - Button: "Retry Failed Searches (N images)"
  - Only show if failed embeddings exist
  - Triggers batch processing of all failed assets
  - Shows progress modal during processing

- [x] **Persist upload queue for recovery** (`lib/upload-queue.ts`)
  - Save pending uploads to IndexedDB (not localStorage - size limits)
  - On page load, check for incomplete uploads
  - Show notification: "Resume N interrupted uploads?"
  - Auto-resume after 3s if no user action

### Phase 7: Testing & Validation

- [x] **Create embedding generation test suite** (`__tests__/embeddings/`)
  - Test: Upload without embedding blocks < 1s
  - Test: Embedding generates within 10s via background
  - Test: Failed embedding retries automatically
  - Test: 10 simultaneous uploads complete successfully
  - Test: Network interruption recovery

- [x] **Add E2E test for batch upload** (`e2e/batch-upload.spec.ts`)
  - Upload 5 images simultaneously
  - Verify all show "uploading" state immediately
  - Verify all complete upload within 5s
  - Verify all become searchable within 15s
  - Verify search finds images by content

- [x] **Load test embedding generation** (`scripts/load-test-embeddings.ts`)
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