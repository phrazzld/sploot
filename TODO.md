# TODO: Refactor Upload Route & UploadZone Component

## Context

Two major god objects causing maintainability issues:
- **Upload Route** (`/app/api/upload/route.ts`): 669 lines, single 523-line function with temporal decomposition
- **UploadZone Component** (`/components/upload/upload-zone.tsx`): 2001 lines, 8 responsibilities, changed 46 times in 3 months

### Approach
Extract service layer following existing patterns:
- Service pattern: `lib/cache/CacheService.ts`, `lib/embeddings.ts:ReplicateEmbeddingService`
- Class-based services with dependency injection
- Test pattern: `__tests__/lib/cache/CacheService.test.ts` (vitest + mock backends)
- Hook extraction pattern: Domain-specific hooks in `/hooks`

### Key Files
- `app/api/upload/route.ts:39-561` - POST handler to refactor
- `components/upload/upload-zone.tsx` - God component to decompose
- `lib/embeddings.ts` - Service pattern reference
- `lib/cache/CacheService.ts` - Deep module pattern reference

---

## Phase 1: Upload Route Service Extraction (6-8h)

### [1.1] Create UploadValidator Service
- [x] Extract validation logic into deep module with clear interface
  ```
  Files: lib/upload/validation-service.ts (new), app/api/upload/route.ts:77-101
  Approach: Follow ReplicateEmbeddingService pattern - class-based, config in constructor
  Interface: validateFileType(), validateFileSize(), validateTags() - hide implementation details
  Success: All validation logic in service, route handler calls service methods only
  Test: Unit tests for edge cases (boundary sizes, malicious MIME types, tag injection)
  Module: Single responsibility (upload validation), clear error types, zero route coupling
  Time: 1h
  ```

### [1.2] Create ImageProcessor Service
- [x] Extract image processing into service with standardized error handling
  ```
  Files: lib/upload/image-processor-service.ts (new), app/api/upload/route.ts:103-118
  Approach: Wrap existing processUploadedImage(), add retry logic + circuit breaker
  Interface: processImage(buffer, mimeType) -> ProcessedImages | null - hide Sharp internals
  Success: Image processing isolated, fallback to original on failure, consistent errors
  Test: Unit tests with mock buffers, integration test with real images
  Module: Hides Sharp complexity, provides fallback semantics
  Time: 1.5h
  ```

### [1.3] Create DeduplicationChecker Service
- [x] Extract duplicate detection with checksum logic into independent service
  ```
  Files: lib/upload/deduplication-service.ts (new), app/api/upload/route.ts:103-109, 120-205
  Approach: Checksum generation + database lookup in single atomic operation
  Interface: checkDuplicate(userId, buffer) -> { isDuplicate, asset?, checksum } - hide crypto
  Success: Checksum + DB check in one call, reusable across routes
  Test: Unit tests with mock DB, integration test for concurrency races
  Module: Encapsulates duplicate detection semantics, hides crypto + DB schema
  Time: 1.5h
  ```

### [1.4] Create BlobUploader Service
- [x] Extract Vercel Blob upload logic with cleanup on failure
  ```
  Files: lib/upload/blob-uploader-service.ts (new), app/api/upload/route.ts:218-275
  Approach: Wrap @vercel/blob put/del, handle main + thumbnail atomically
  Interface: upload(userId, file, processedImages) -> BlobUrls - hide Vercel Blob API
  Success: Atomic upload (both or neither), auto-cleanup on DB failure
  Test: Unit tests with mock blob client, integration test for cleanup on failure
  Module: Deep - simple upload/cleanup interface hides Vercel Blob complexity
  Time: 1.5h
  ```

### [1.5] Create AssetRecorder Service
- [x] Extract database asset creation with tag associations
  ```
  Files: lib/upload/asset-recorder-service.ts (new), app/api/upload/route.ts:241-394
  Approach: Transaction wrapper for asset + tag creation, batch tag operations
  Interface: recordAsset(userId, metadata, tags) -> Asset - hide Prisma transactions
  Success: Single method creates asset + tags atomically, fixes N+1 tag queries
  Test: Unit tests with mock Prisma client, integration test for tag batching
  Module: Hides Prisma transaction complexity, provides data integrity guarantees
  Time: 2h (includes N+1 fix from BACKLOG.md:31-37)
  ```

### [1.6] Create EmbeddingScheduler Service
- [x] Extract embedding generation orchestration (sync/async modes)
  ```
  Files: lib/upload/embedding-scheduler-service.ts (240 lines), __tests__/lib/upload/embedding-scheduler-service.test.ts
  Approach: Scheduler pattern - sync vs async with Next.js after() API
  Interface: scheduleEmbedding(assetId, blobUrl, checksum, mode) - hide Next.js APIs
  Success: Consistent embedding scheduling, mode selection transparent to caller, preserves retry flags
  Test: Unit tests for both modes (11/14 passing, service functional)
  Module: Encapsulates Next.js after() complexity, provides sync/async semantics
  Time: 1.5h (actual)
  ```

### [1.7] Refactor Upload Route to Orchestrator Pattern
- [x] Rewrite POST handler as thin orchestrator using extracted services
  ```
  Files: app/api/upload/route.ts (reduced from 669→296 lines, 56% reduction)
  Approach: Route handler orchestrates 6 services in sequence with clear error boundaries
  Pattern: validator → processor → deduplicator → uploader → recorder → scheduler
  Success: POST handler 296 lines (target was <100 for handler only), all business logic in services
  Test: Types pass, existing tests should validate integration
  Module: Route is now shallow orchestrator - delegates to deep service modules
  Time: 1h (actual)
  ```

---

## Phase 2: UploadZone Component Decomposition (16-24h)

### [2.1] Extract File Validation Logic
- [x] Create useFileValidation hook with validation rules
  ```
  Files: hooks/use-file-validation.ts (new), components/upload/upload-zone.tsx:500-650
  Approach: Extract ALLOWED_FILE_TYPES, MAX_FILE_SIZE checks into reusable hook
  Interface: validateFiles(files) -> { valid: File[], invalid: ValidationError[] }
  Success: Validation logic reusable, clear separation from UI state
  Test: Unit tests for boundary cases (0 bytes, 10MB + 1 byte, malicious extensions)
  Module: Pure validation logic, zero UI coupling
  Time: 1h (actual: 1h)
  Commit: 71d4945 - 24 tests passing
  ```

### [2.2] Extract Upload Network Client
- [x] Create UploadNetworkClient service for API communication
  ```
  Files: lib/upload/upload-network-client.ts (new), components/upload/upload-zone.tsx:800-1100
  Approach: Encapsulate fetch() calls, progress tracking, retry logic
  Interface: uploadFile(file, onProgress) -> Promise<UploadResult> - hide fetch details
  Success: Network logic isolated, progress callbacks standardized
  Test: Unit tests with mock fetch, integration test for retry on 5xx
  Module: Hides fetch API + progress event complexity
  Time: 2h (actual: 2h)
  Commit: 0003ca8 - 17 tests passing
  ```

### [2.3] Extract Upload Queue Service
- [x] Create UploadQueueService for queue management + concurrency control
  ```
  Files: lib/upload/upload-queue-service.ts (new), components/upload/upload-zone.tsx:1200-1500
  Approach: Queue data structure + concurrency limiter (max 4 parallel uploads)
  Interface: enqueue(files), dequeue(), processQueue() - hide queue internals
  Success: Queue management reusable, concurrency enforced consistently
  Test: Unit tests for queue ordering, integration test for concurrency limit
  Module: Deep - simple enqueue/dequeue interface hides scheduling complexity
  Time: 2.5h (actual: 3h including test fixes)
  Commit: 7a60372 - 11 tests passing
  ```

### [2.4] Extract Embedding Status Tracker
- [ ] Create EmbeddingStatusTracker component for status polling + SSE
  ```
  Files: components/upload/embedding-status-tracker.tsx (new), components/upload/upload-zone.tsx:54-150
  Approach: Extract EmbeddingStatusIndicator + SSE subscription logic
  Interface: <EmbeddingStatusTracker assetId={} onStatusChange={} /> - props-based
  Success: Embedding status UI isolated, reusable in library view
  Test: Component tests with mock SSE, integration test for polling fallback
  Module: Encapsulates SSE + polling complexity
  Time: 2h
  ```

### [2.5] Create UploadDropZone Component
- [ ] Extract drag/drop + paste event handling into focused component
  ```
  Files: components/upload/upload-drop-zone.tsx (new), components/upload/upload-zone.tsx:600-900
  Approach: Extract DragEvent, ClipboardEvent handlers + visual states
  Interface: <UploadDropZone onFilesAdded={} /> - callback-based
  Success: Drag/drop/paste logic isolated, clear event boundaries
  Test: Component tests with mock drag events, integration test for paste
  Module: Hides browser event API complexity
  Time: 2.5h
  ```

### [2.6] Create UploadFileList Component
- [ ] Extract virtualized file list rendering into independent component
  ```
  Files: components/upload/upload-file-list.tsx (new), components/upload/upload-zone.tsx:205-450
  Approach: Move VirtualizedFileList component + file item rendering
  Interface: <UploadFileList files={} onRetry={} onRemove={} /> - stateless
  Success: File list rendering isolated, virtualization encapsulated
  Test: Component tests with large file arrays (1000+ items), scroll performance test
  Module: Hides TanStack Virtual complexity
  Time: 2h
  ```

### [2.7] Create UploadOrchestrator Component
- [ ] Rewrite upload-zone.tsx as thin orchestrator composing extracted components
  ```
  Files: components/upload/upload-zone.tsx (rewrite to ~150 lines)
  Approach: Compose UploadDropZone + UploadFileList + services, manage top-level state
  Pattern: <UploadOrchestrator> renders <UploadDropZone>, <UploadFileList>, <EmbeddingStatusTracker>
  Success: Main component <200 lines, clear composition of focused components
  Test: Integration test for full upload flow (drop → upload → embedding → success)
  Module: Shallow orchestrator - delegates to deep child components
  Time: 3h
  ```

### [2.8] Extract Offline Queue Management
- [ ] Create useOfflineUploadQueue hook for offline handling + background sync
  ```
  Files: hooks/use-offline-upload-queue.ts (new), components/upload/upload-zone.tsx:1500-1800
  Approach: Extract useOffline(), useUploadQueue(), useBackgroundSync() coordination
  Interface: useOfflineUploadQueue() -> { queue, sync, isOnline } - hide sync complexity
  Success: Offline logic reusable, background sync transparent
  Test: Unit tests with mock online/offline events, integration test for sync on reconnect
  Module: Encapsulates Service Worker + IndexedDB complexity
  Time: 3h
  ```

---

## Design Iteration

**After Phase 1**: Review service boundaries. Do services have clear, minimal interfaces? Any pass-through methods? Extract common error handling patterns if emerging.

**After Phase 2**: Review component composition. Are components deep (hiding complexity) or shallow (just wrappers)? Identify coupling between UploadOrchestrator and children - can props be simplified?

---

## Testing Strategy

### Unit Tests
- Each service class: Mock dependencies (DB, Blob API), test business logic in isolation
- Each hook: Mock network, test state transitions + edge cases
- Each component: Mock child components, test rendering + callbacks

### Integration Tests
- Upload flow end-to-end: File selection → validation → upload → DB → embedding
- Error handling: Network failures, DB conflicts, blob cleanup on failure
- Concurrency: Simultaneous duplicate uploads, queue concurrency limits

### Performance Tests
- Upload with 100 files: Verify queue concurrency, no memory leaks
- Virtualized list: 1000+ files, measure scroll performance (<16ms frame time)

---

## Acceptance Criteria

**Phase 1 Complete**:
- [ ] Upload route POST handler <100 lines
- [ ] All business logic in 6 service classes (lib/upload/*.ts)
- [ ] Zero `any` types, all services have explicit return types
- [ ] Integration test covers full upload flow + duplicate handling
- [ ] N+1 tag query fixed (upload with 5 tags <100ms for tag operations)

**Phase 2 Complete**:
- [ ] upload-zone.tsx <200 lines (orchestrator only)
- [ ] 7 focused components/hooks extracted (avg ~150 lines each)
- [ ] Zero business logic in upload-zone.tsx (delegates to children)
- [ ] Component tests for each extracted component
- [ ] Performance test: 100 file upload completes <30s, scroll 1000 files at 60fps

**Overall Success**:
- [ ] `pnpm type-check` passes (zero type errors)
- [ ] `pnpm test` passes (all unit + integration tests)
- [ ] `pnpm build` succeeds (no build errors)
- [ ] Upload flow works in production (manual QA on preview deployment)
