
### [Architecture] Refactor Upload Route to Service Layer
**File**: `/app/api/upload/route.ts:39-561` (669 lines in single function)
**Perspectives**: complexity-archaeologist (temporal decomposition), architecture-guardian (business logic in API route)
**Why**: 523-line function organized by execution order (validation → processing → upload → database → embedding) causes change amplification - every new feature requires editing deeply nested conditionals
**Approach**: Extract services: `UploadValidator`, `ImageProcessor`, `DeduplicationChecker`, `BlobUploader`, `AssetRecorder`, `EmbeddingScheduler`. Clean orchestrator pattern in route handler.
**Effort**: 6-8h | **Impact**: Enables testing business logic, reduces comprehension barrier, unlocks parallel feature development

### [Architecture] Decompose UploadZone God Component
**File**: `/components/upload/upload-zone.tsx` (2001 lines)
**Perspectives**: complexity-archaeologist, architecture-guardian (8 responsibilities: drag/drop, paste, queue, progress, embedding status, offline, error display, virtual scrolling)
**Approach**: Split into 7 focused components: `UploadOrchestrator.tsx` (~150 lines), `FileValidator.ts`, `UploadNetworkClient.ts`, `UploadQueueService.ts`, `EmbeddingStatusTracker.tsx`, `UploadDropZone.tsx`, `UploadFileList.tsx`
**Effort**: 16-24h | **Impact**: Most complex component, changed 46 times in 3 months - blocks maintainability
**Dependencies**: None

