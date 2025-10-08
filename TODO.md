# TODO: Bulk Upload System Architecture

> **Mission**: Enable reliable upload of 2000+ images simultaneously by decoupling upload, processing, and embedding generation into independent asynchronous stages.
>
> **Core Problem**: Current synchronous upload flow (`Client → Server → Sharp → Blob → DB → Replicate → Response`) creates bottlenecks at 6+ concurrent uploads due to serverless timeout limits, database connection exhaustion, and rate limiting.
>
> **Solution**: Direct client-to-Blob uploads + background processing queues + rate limiting.

---

## Phase 1: Direct-to-Blob Upload Infrastructure

**Goal**: Bypass server processing during upload by allowing direct client-to-Blob transfers with presigned URLs.

### API Endpoints

- [x] **Create `GET /api/upload-url` endpoint for presigned URL generation**
  - Returns `{ uploadUrl: string, assetId: string, pathname: string }` for direct Blob uploads
  - Generate unique asset ID server-side (UUID v4)
  - Use `@vercel/blob` `createPresignedUrl()` or equivalent for signed PUT URLs
  - Add expiration time (5 minutes) to prevent stale URLs
  - Validate user authentication via `requireUserIdWithSync()`
  - Success criteria: Returns valid presigned URL that accepts PUT requests from browser
  - File: `app/api/upload-url/route.ts` (already exists, modify to return presigned URL instead of accepting upload)
  ```
  Work Log:
  - Simplified to return blob token + pathname (client uses @vercel/blob put())
  - Returns assetId for tracking, expiresAt for 5min TTL
  - Fast metadata-only endpoint (<100ms, no file processing)
  - Commit: e9879ff
  ```

- [x] **Create `POST /api/upload-complete` endpoint for post-upload metadata**
  - Accepts `{ assetId: string, blobUrl: string, filename: string, size: number, mimeType: string }`
  - Calculate checksum from blob (fetch blob, hash in chunks to avoid memory overflow)
  - Check for duplicate via `assetExists(userId, checksum)` - return existing asset if found
  - Insert asset record with `processed: false, embedded: false` flags (add these fields)
  - DO NOT process image or generate embedding synchronously
  - Enqueue background job for image processing (add to `image_processing_queue` table or use cron pickup)
  - Return `{ success: true, asset: { id, blobUrl, isDuplicate, needsProcessing } }`
  - Success criteria: Asset saved to DB in <200ms, no Sharp processing, no Replicate calls
  - File: `app/api/upload-complete/route.ts` (new file)
  ```
  Work Log:
  - Client sends checksum (calculated during upload) to avoid server fetch
  - Validates checksum format (64 hex chars for SHA-256)
  - Duplicate detection + blob cleanup if found
  - Creates asset with processed=false, embedded=false flags
  - Fast path: <200ms (no Sharp, no Replicate, metadata-only)
  - Commit: 3d75cab
  ```

### Database Schema Changes

- [x] **Add processing state flags to Asset model**
  - Add `processed: boolean @default(false)` to track image processing completion (resize/thumbnail)
  - Add `embedded: boolean @default(false)` to track embedding generation completion
  - Add `processingError: string?` to store processing failure reasons
  - Add `embeddingError: string?` to store embedding generation failure reasons
  - Add index on `(processed, embedded)` for efficient queue queries
  - Run migration: `pnpm db:migrate` after schema changes
  - Success criteria: Can query unprocessed/unembedded assets efficiently via `WHERE processed=false`
  - File: `prisma/schema.prisma`
  ```
  Work Log:
  - Used 'prisma db push' instead of migrate due to shadow DB issues
  - Added compound index (processed, embedded, createdAt) for queue queries
  - Schema validated and applied successfully (commit: 92fd38f)
  ```

### Client Upload Flow

- [x] **Refactor `uploadFileToServer()` to use direct Blob uploads**
  - Step 1: `GET /api/upload-url` to get presigned URL and asset ID
  - Step 2: `PUT` file directly to presigned URL with `XMLHttpRequest` for progress tracking
  - Step 3: `POST /api/upload-complete` with blob URL and metadata to finalize
  - Remove FormData upload to `/api/upload` (keep old endpoint for backward compatibility initially)
  - Handle presigned URL expiration (5min) - regenerate if upload takes too long
  - Track upload progress via `xhr.upload.addEventListener('progress')` (already implemented)
  - Success criteria: 10MB file uploads in <5s (network-bound, not server-bound)
  - File: `components/upload/upload-zone.tsx:1085-1333`
  ```
  Work Log:
  - 3-step flow: GET credentials → PUT to Blob → POST finalize
  - Client calculates SHA-256 checksum via Web Crypto API
  - Direct XHR PUT to blob.vercel-storage.com with Bearer token
  - Progress 0-95% for upload, 95-100% for finalization
  - Timeout increased to 30s (was 10s) for large files
  - Network-bound performance achieved
  - Commit: d588428
  ```

- [x] **Add retry logic for presigned URL failures**
  - Retry on 403 (expired presigned URL) by fetching new URL and resuming
  - Retry on 5xx errors with exponential backoff (1s, 2s, 4s)
  - Detect network failures vs. server errors via `xhr.status === 0`
  - Maximum 3 retries for presigned URL generation, 5 retries for PUT operations
  - Success criteria: Transient network failures auto-recover without user intervention
  - File: `components/upload/upload-zone.tsx:1085-1333`
  ```
  Work Log:
  - Generic retry helper with exponential backoff (1s, 2s, 4s)
  - Retry on credentials fetch (3 max): 5xx, 429, network failures
  - Retry on upload-complete (3 max): 5xx, network failures
  - Blob PUT relies on existing batch-level retry (complex w/ progress)
  - Smart retry conditions: skip 4xx client errors, retry transient
  - Commit: d74469c
  ```

### Rate Limiting (Server-Side Protection)

- [x] **Implement token bucket rate limiter utility**
  - Create `lib/rate-limiter.ts` with `TokenBucketRateLimiter` class
  - Configuration: 100 tokens per user, refill rate 10 tokens/minute
  - Store state in memory Map (single-instance) or Upstash Redis (multi-instance)
  - Methods: `consume(userId, tokens=1): Promise<{ allowed: boolean, retryAfter?: number }>`
  - Return `retryAfter` seconds when bucket empty for client backoff
  - Success criteria: Can throttle 150 requests/minute to 100 allowed + 50 rejected
  - File: `lib/rate-limiter.ts` (new file)
  ```
  Work Log:
  - Token bucket algorithm: 100 max tokens, refill 10/minute
  - Simple interface: consume(userId, tokens) → { allowed, retryAfter, remaining }
  - In-memory Map storage with automatic cleanup (every 10min)
  - Removes inactive buckets after 1 hour to prevent memory leaks
  - Singleton instance exported: uploadRateLimiter
  - Can migrate to Redis later without breaking API
  - Commit: 4575c5a
  ```

- [ ] **Add rate limiting to `/api/upload-url` endpoint**
  - Check rate limit before generating presigned URL: `await rateLimiter.consume(userId, 1)`
  - Return 429 with `Retry-After: <seconds>` header if rate limited
  - Response body: `{ error: 'Too many uploads. Please wait ${retryAfter}s and try again', retryAfter }`
  - Log rate limit violations for monitoring: `console.warn('[RateLimit] User ${userId} exceeded limit')`
  - Success criteria: Endpoint rejects >100 requests/minute from single user with proper 429 response
  - File: `app/api/upload-url/route.ts`

- [ ] **Handle 429 rate limit responses in client**
  - Detect 429 status code in upload error handler
  - Parse `retryAfter` from response body or `Retry-After` header
  - Show user-friendly message: "Upload rate limited. Retrying in ${retryAfter}s..."
  - Automatically retry after `retryAfter` delay + jitter (prevent thundering herd)
  - Add rate limit errors to `UploadErrorType.RATE_LIMITED` classification (already exists)
  - Success criteria: Client gracefully handles rate limiting with automatic retry
  - File: `components/upload/upload-zone.tsx:1270-1333` (error handler)

---

## Phase 2: Background Processing Queues

**Goal**: Process uploaded images and generate embeddings asynchronously via cron jobs, respecting external API rate limits.

### Image Processing Queue

- [ ] **Create `/api/cron/process-images` cron endpoint**
  - Query unprocessed assets: `SELECT * FROM assets WHERE processed=false AND processingError IS NULL ORDER BY createdAt ASC LIMIT 10`
  - For each asset: download from Blob, process with Sharp (resize + thumbnail), upload processed versions
  - Use existing `processUploadedImage(buffer, mimeType)` function from `lib/image-processing.ts`
  - Update original blob with processed main image, create new blob for thumbnail
  - Set `processed=true, thumbnailUrl=<url>` on success
  - Set `processingError=<error.message>` on failure (keep `processed=false` for retry)
  - Process max 10 images per cron invocation to avoid timeout (10 × 2s processing = 20s < 60s limit)
  - Success criteria: Processes 10 images/minute, completes within 60s timeout
  - File: `app/api/cron/process-images/route.ts` (new file)

- [ ] **Add Vercel Cron configuration for image processing**
  - Add cron job to `vercel.json`: `{ "path": "/api/cron/process-images", "schedule": "* * * * *" }` (every minute)
  - Verify cron authentication via `CRON_SECRET` header (Vercel adds this automatically)
  - Log cron execution: `console.log('[Cron] Processing ${count} images')`
  - Success criteria: Cron job runs every 60 seconds in production
  - File: `vercel.json`

### Embedding Generation Queue

- [ ] **Enhance `/api/cron/process-embeddings` to process queue**
  - Already exists at `app/api/cron/process-embeddings/route.ts`
  - Modify to query: `SELECT * FROM assets WHERE embedded=false AND embeddingError IS NULL AND processed=true ORDER BY createdAt ASC LIMIT 5`
  - Add dependency: only process embeddings AFTER image processing completes (`processed=true`)
  - Respect Replicate rate limits: max 5 embeddings/minute (conservative estimate)
  - Set `embedded=true` on success, `embeddingError=<message>` on failure
  - Success criteria: Processes 5 embeddings/minute without hitting Replicate rate limits
  - File: `app/api/cron/process-embeddings/route.ts`

- [ ] **Add exponential backoff for embedding failures**
  - Add `embeddingRetryCount: number @default(0)` and `embeddingNextRetry: DateTime?` to Asset model
  - On embedding failure: increment retry count, calculate next retry time via exponential backoff
  - Backoff schedule: 1min, 5min, 15min, 1hr, 6hr (max 5 retries)
  - Modify queue query: `WHERE embedded=false AND (embeddingNextRetry IS NULL OR embeddingNextRetry < NOW())`
  - Permanent failure after 5 retries: set `embeddingError='Max retries exceeded'` and stop retrying
  - Success criteria: Transient Replicate failures auto-retry, permanent failures don't block queue
  - File: `app/api/cron/process-embeddings/route.ts` and `prisma/schema.prisma`

### Progress Monitoring

- [ ] **Create `/api/processing-stats` endpoint for queue metrics**
  - Return aggregated statistics without fetching all assets (efficient)
  - Query counts: `uploading`, `processing`, `embedding`, `ready`, `failed`
  - Use aggregation queries: `COUNT(*) WHERE processed=false`, `COUNT(*) WHERE embedded=false`, etc.
  - Response: `{ stats: { total, uploaded, processed, embedded, failed }, timestamp }`
  - Cache results for 5 seconds to reduce DB load (use in-memory cache or Upstash)
  - Success criteria: Returns stats in <100ms, called by client every 5s during uploads
  - File: `app/api/processing-stats/route.ts` (new file)

- [ ] **Create SSE endpoint `/api/sse/processing-updates` for real-time progress**
  - Establish Server-Sent Events connection for live progress updates
  - Poll `/api/processing-stats` every 5 seconds and stream to connected clients
  - Send events: `data: {"type":"progress","stats":{...}}\n\n`
  - Automatically disconnect after 5 minutes of inactivity (prevent hanging connections)
  - Support reconnection via `Last-Event-ID` header for recovery
  - Success criteria: Client receives progress updates every 5s, reconnects on disconnect
  - File: `app/api/sse/processing-updates/route.ts` (new file)

---

## Phase 3: Client UX Improvements

**Goal**: Provide clear visibility into three-stage processing (upload → process → embed) and handle errors gracefully.

### Progress Tracking UI

- [ ] **Add three-phase progress indicator to UploadZone**
  - Replace single progress bar with three stages: "Uploading", "Processing", "Searchable"
  - Uploading: tracked by `uploadFileToServer()` progress (already implemented)
  - Processing: tracked by SSE updates from `/api/sse/processing-updates`
  - Searchable: tracked when `embedded=true` (embedding generation complete)
  - Show counts: "Uploading: 1500/2000", "Processing: 450/2000", "Searchable: 120/2000"
  - Success criteria: User sees clear progress through all three stages
  - File: `components/upload/upload-zone.tsx:1719-1813` (replace existing progress header)

- [ ] **Connect to SSE endpoint for real-time processing updates**
  - Create `useProcessingProgress()` hook to consume SSE endpoint
  - Connect to `/api/sse/processing-updates` when uploads complete
  - Update UI state with progress events: `{ uploaded, processing, searchable }`
  - Handle reconnection on network failures (EventSource auto-reconnects)
  - Disconnect SSE when all processing completes (`processed=embedded=true` for all assets)
  - Success criteria: UI updates every 5s with latest processing progress
  - File: `hooks/use-processing-progress.ts` (new file) and `components/upload/upload-zone.tsx`

- [ ] **Add processing status to individual file items**
  - Update `FileMetadata` interface with `processingStatus: 'pending' | 'processing' | 'complete' | 'failed'`
  - Show processing state next to upload success indicator
  - Display: "✓ Uploaded → ⏳ Processing images..." → "✓ Ready to search"
  - Allow retry for failed processing (call `/api/assets/[id]/retry-processing`)
  - Success criteria: Each file shows its current processing stage
  - File: `components/upload/upload-zone.tsx:24-40` (FileMetadata interface)

### Reduce Client Concurrency (Immediate Relief)

- [ ] **Lower concurrent upload limit to prevent rate limiting**
  - Change `BASE_CONCURRENT_UPLOADS` from 6 → 2 for hobby tier limits
  - Change `MAX_CONCURRENT_UPLOADS` from 8 → 3 to respect serverless concurrency
  - Keep adaptive concurrency logic (adjust based on failure rate)
  - Add 200ms delay between upload batches to smooth request distribution
  - Success criteria: <5% upload failures on 2000-file bulk uploads
  - File: `components/upload/upload-zone.tsx:938-941`

- [ ] **Increase upload timeout to accommodate processing**
  - Change XHR timeout from 10s → 30s for large file uploads
  - Note: With direct-to-Blob uploads, this should rarely timeout (network-only)
  - Keep server-side timeout at 60s (Vercel limit)
  - Success criteria: 10MB files upload successfully 95%+ of the time
  - File: `components/upload/upload-zone.tsx:1195` (xhr.timeout)

### Error Recovery & Resilience

- [ ] **Integrate DistributedQueue for upload retry logic**
  - Use existing `lib/distributed-queue.ts` for upload retry management
  - Replace manual retry logic with `DistributedQueue.enqueue(fileMetadata, 'normal')`
  - User-initiated retries use 'urgent' priority (10 max retries vs 5 for normal)
  - Automatic exponential backoff for rate limit errors (5x multiplier vs 2x for network)
  - Move permanently failed uploads to dead letter queue for analysis
  - Success criteria: Failed uploads automatically retry up to 5 times with exponential backoff
  - File: `components/upload/upload-zone.tsx:942-1016` (uploadBatch function)

- [ ] **Add dead letter queue UI for permanent failures**
  - Show "Failed permanently (view details)" for items in dead letter queue
  - Display error classification: rate_limit, network, server, invalid, unknown
  - Allow manual retry from UI: `DistributedQueue.retryDeadLetterItem(id)`
  - Log dead letter items for debugging: `console.error('[DeadLetter]', item)`
  - Success criteria: Users can see and retry permanently failed uploads
  - File: `components/upload/upload-zone.tsx:1799-1812` (error summary section)

---

## Phase 4: Testing & Validation

**Goal**: Verify system handles bulk uploads reliably under various conditions.

### Load Testing

- [ ] **Create load test script for bulk upload scenarios**
  - Generate 100, 500, 1000, 2000 synthetic test images (various sizes: 1MB, 5MB, 10MB)
  - Use Playwright or Puppeteer to automate upload flow
  - Measure: upload success rate, P95 latency, memory usage, failure types
  - Run test suite: happy path, network interruption, rate limiting, concurrent users
  - Success criteria: >95% success rate for 2000 files, <10s P95 upload latency
  - File: `__tests__/load/bulk-upload.test.ts` (new file)

- [ ] **Add integration test for direct-to-Blob upload flow**
  - Test sequence: GET upload-url → PUT to presigned URL → POST upload-complete
  - Verify asset created with `processed=false, embedded=false`
  - Verify presigned URL expires after 5 minutes (mock timer)
  - Verify duplicate detection works (upload same file twice)
  - Success criteria: All three API calls succeed, asset saved correctly
  - File: `__tests__/api/upload-direct.test.ts` (new file)

- [ ] **Add unit tests for rate limiter**
  - Test token consumption: 100 tokens → 0 → refill to 10 after 1min
  - Test burst handling: consume 100 tokens instantly, reject 101st request
  - Test concurrent access: multiple users don't share buckets
  - Test retry-after calculation: bucket empty → returns correct wait time
  - Success criteria: Rate limiter enforces limits correctly under load
  - File: `__tests__/lib/rate-limiter.test.ts` (new file)

### Monitoring Setup

- [ ] **Add performance telemetry to upload endpoints**
  - Track metrics: upload latency, processing queue depth, embedding queue depth
  - Log to console with structured format: `[Metrics] upload_latency_p95=450ms`
  - Add to existing `/api/telemetry` endpoint for dashboard consumption
  - Expose via `/api/telemetry` endpoint: `{ uploadLatency: { p50, p95, p99 }, queueDepth, ... }`
  - Success criteria: Can monitor upload performance and queue backlog in real-time
  - File: `app/api/upload-url/route.ts`, `app/api/upload-complete/route.ts`, `app/api/telemetry/route.ts`

---

## Rollout Strategy

**Incremental deployment to minimize risk:**

1. **Phase 1**: Ship direct-to-Blob uploads behind feature flag (`NEXT_PUBLIC_ENABLE_DIRECT_UPLOAD`)
2. **Phase 2**: Enable for 10% of users, monitor error rates
3. **Phase 3**: Enable for 50% of users if error rate <5%
4. **Phase 4**: Enable for 100% of users, deprecate old `/api/upload` endpoint
5. **Phase 5**: Remove old upload code after 2 weeks of stable operation

---

## Success Metrics

**System is production-ready when:**
- ✅ 2000-file upload completes with >95% success rate
- ✅ Upload latency P95 <5s per file (network-bound, not server-bound)
- ✅ Processing completes within 30 minutes (10 images/min × 2000 = 200min → optimize to 30min)
- ✅ No serverless timeout errors (60s limit not hit)
- ✅ Rate limiting prevents abuse (>100 uploads/min rejected)
- ✅ Users see clear progress through upload → process → searchable stages
- ✅ Failures auto-retry with exponential backoff
- ✅ System recovers from network interruptions without data loss

---

## Future Enhancements (BACKLOG.md)

Items deferred for post-implementation optimization:

- **Batch upload API**: Accept multiple files in single request for reduced network overhead
- **Vercel Queue integration**: Use `@vercel/queue` for distributed background processing
- **Database optimizations**: Batch INSERT statements, connection pooling tuning
- **Image processing optimizations**: Use `sharp` worker threads for parallel processing
- **Grafana dashboard**: Visualize queue metrics, upload success rates, P95 latencies
- **WebSocket progress updates**: Replace SSE with WebSocket for bi-directional communication
- **Resume interrupted uploads**: Store partial upload state in IndexedDB, resume on reconnect
- **Adaptive rate limiting**: Adjust limits based on system load (e.g., fewer concurrent uploads during peak)
