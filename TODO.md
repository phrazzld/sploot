# TODO

> **Philosophy**: Measure first, fix root causes, optimize hot paths, validate everything.
> Each task is atomic, testable, and can be completed in a single focused session.

## 🔥 P0: Critical Path (Blocking UX)

### Ghost Assets Investigation
- [x] **Audit database for orphaned asset records** - Query `SELECT id, blobUrl, filename FROM Asset` and verify each blob URL returns 200 status. Document count of broken/missing blobs. Expected: identify 4 ghost records causing phantom tiles. (~15 min)
  ```
  Work Log:
  - Created scripts/audit-assets-db.ts to validate all blob URLs
  - Audited 134 assets: 100% valid (134), 0% broken (0), 0% errors (0)
  - No ghost assets found - transactional upload fix appears to have resolved the issue
  - All blob URLs return 200 status, no orphaned records detected
  ```

- [x] **Add debug endpoint `/api/assets/audit`** - Create new API route that iterates all assets, validates blob URLs via HEAD request, returns JSON with `{valid: [], broken: [], missing: []}`. Use for manual inspection. (~20 min)

- [ ] **Reproduce upload failure path** - Test sequence: start upload → interrupt network → verify DB record created but blob missing. Confirm transaction boundary issue in `/app/api/upload/route.ts`. (~10 min)

- [x] **Fix transactional upload flow** - Refactor `/app/api/upload/route.ts:24-91` to: (1) upload to blob first, (2) only create DB record if blob succeeds, (3) rollback blob on DB failure. Atomic operation prevents orphans. (~30 min)

- [x] **Add blob URL validation in Prisma schema** - Modify `prisma/schema.prisma` to add `@db.Text` check constraint ensuring `blobUrl` matches pattern `https://[a-z0-9-]+\.public\.blob\.vercel-storage\.com/.*`. Prevents malformed URLs. (~10 min)
  ```
  Work Log:
  - Created migration 20250929_add_blob_url_validation with PostgreSQL CHECK constraints
  - Validates blobUrl format: ^https://[a-z0-9-]+\.public\.blob\.vercel-storage\.com/.+$
  - Also validates thumbnailUrl format if set (nullable field)
  - Updated schema comments to document validation
  - Run `pnpm db:migrate` to apply constraints to database
  ```

- [x] **Create manual cleanup script** - Write `scripts/clean-orphaned-assets.ts` that: (1) finds assets with invalid blob URLs, (2) prompts for confirmation, (3) deletes from DB with audit log. Run once to clean current state. (~25 min)

## 🎨 P1: Empty State UX Redesign

### Research & Design
- [x] **Measure current empty state render time** - Add console.time() around ImageGrid empty state block (lines 139-209). Baseline performance: target <16ms (1 frame). (~5 min)

- [ ] **A/B test copy variations** - Create 3 headline options: (1) "your meme library awaits", (2) "no memes yet", (3) "drop images to get started". Ask 3 users which feels best. (~20 min)

- [ ] **Design mobile-first empty state** - Create variant for `<640px` viewports that's touch-optimized: full-width tap target, larger touch areas (min 44px), bottom-sheet friendly. (~15 min)

### Implementation
- [x] **Extract EmptyState component** - Create `/components/library/empty-state.tsx` with props: `{variant: 'first-use' | 'filtered' | 'search', onUploadClick?: () => void}`. Separate concerns from ImageGrid. (~20 min)

- [x] **Implement minimal empty state** - In EmptyState component, render: 16x16 icon (not 28x28), single line headline, optional subtext, keyboard hint "⌘V to paste". Total height <200px. Matches Crisp Lab aesthetic. (~25 min)

- [x] **Add contextual empty states** - Different messages based on context: `filtered` → "no memes match these filters", `search` → "no results for 'query'", `first-use` → "drop images here". Pass context via props. (~20 min)

- [x] **Remove redundant upload button** - If navbar already has upload button visible, hide EmptyState button to avoid duplication. Check screen width and navbar state. (~10 min)
  ```
  Work Log:
  - Added showUploadButton prop to EmptyState component (default: true for backwards compatibility)
  - Updated ImageGrid and ImageList to pass showUploadButton={false}
  - Main page toolbar already has prominent upload button, so EmptyState button is redundant
  - Users can still use ⌘V keyboard shortcut to paste images
  ```

- [x] **Add drag-and-drop visual feedback** - On `dragover` event, highlight entire empty state with `border-[#7C5CFF]` and scale(1.02). On `drop`, trigger upload flow. Tactile affordance. (~15 min)
  ```
  Work Log:
  - Added drag-and-drop event handlers (dragEnter, dragOver, dragLeave, drop)
  - Implemented drag state tracking with counter for nested events
  - Visual feedback: purple dashed border, scale(1.02), subtle bg tint when dragging
  - Filters dropped files to images only (file.type.startsWith('image/'))
  - Added onFilesDropped callback prop for parent components to handle uploads
  - Only enabled for 'first-use' variant (not search/filtered states)
  ```

- [x] **Implement skeleton → empty state transition** - When `loading: true → false` and `assets.length === 0`, fade out skeletons (300ms ease-out) before showing empty state. Prevents jarring pop. (~15 min)
  ```
  Work Log:
  - Added transition state tracking in ImageGrid and ImageList components
  - Created fadeOut animation (300ms ease-out) in globals.css
  - Skeleton shows with fade-out animation when loading completes with 0 assets
  - Empty state fades in after skeleton completes (200ms)
  - Prevents jarring layout shift by maintaining container dimensions
  - Total transition time: 300ms skeleton fade-out + 200ms empty state fade-in
  ```

### Testing
- [ ] **Test empty state on slow network** - Throttle to Slow 3G, verify skeleton → empty state transition is smooth. No layout shift (CLS = 0). (~10 min)

- [ ] **Verify keyboard accessibility** - Tab through empty state, ensure upload button focusable, Enter key triggers upload. Screen reader announces "Empty library, upload button". (~10 min)

- [ ] **Test drag-drop on empty state** - Drag image from Finder onto empty state, verify upload triggers. Test with multiple files (batch upload). (~10 min)

## 🛡️ P1: Error Boundaries & Robustness

### Component-Level Error Handling
- [ ] **Add ImageTileErrorBoundary** - Wrap ImageTile in error boundary that catches blob load failures. Render tombstone tile with retry button instead of crashing grid. Use React Error Boundary API. (~25 min)

- [x] **Implement broken image fallback** - In ImageTile, add `<Image onError={handleError} />` handler. On 404/403, show placeholder icon + "Image unavailable" + delete button. Graceful degradation. (~20 min)
  ```
  Work Log:
  - Enhanced existing error fallback UI in ImageTile component
  - Added "Image unavailable" text message for clarity
  - Added delete button styled in red with trash icon
  - Error state maintains tile dimensions to prevent layout shift
  - Uses bg-[#14171A] background to match dark theme
  - Button has proper hover states and focus-visible outline
  - Gracefully handles 404/403 errors without crashing grid
  ```

- [ ] **Add circuit breaker for blob requests** - If >3 consecutive blob 404s, pause loading and show banner "Storage connection issue detected. Retrying...". Prevent cascade failures. (~30 min)

- [ ] **Log blob errors to monitoring** - On image load failure, send to `/api/telemetry` with: `{assetId, blobUrl, errorType, timestamp}`. Track patterns for debugging. (~15 min)

### Data Integrity Guards
- [ ] **Add asset integrity check on mount** - In `useAssets` hook, validate first 10 assets have valid blob URLs. If >50% broken, show warning banner + audit button. Early detection. (~20 min)

- [ ] **Implement optimistic UI rollback** - On upload, show optimistic tile immediately. If upload fails after 10s, animate tile out and show toast error. Don't leave ghost tiles. (~25 min)

- [ ] **Add blob URL TTL tracking** - Vercel Blob URLs may expire. Store `blobCreatedAt` timestamp, warn if >1 year old. Proactive regeneration before 404s. (~20 min)

## 🔧 P2: Infrastructure & Monitoring

### Automated Cleanup
- [ ] **Create cron job for orphan detection** - Add Vercel Cron route `/api/cron/audit-assets` that runs daily, finds broken blobs, sends alert email if >10 found. Proactive monitoring. (~30 min)

- [ ] **Implement soft delete for assets** - Add `deletedAt` timestamp instead of hard delete. Keep 30-day retention for recovery. Modify delete API to set timestamp, add cron to purge old. (~35 min)

- [ ] **Add blob garbage collection** - Script to find blobs in Vercel Blob storage not referenced by any DB record. Prompt for deletion. Reclaim storage. (~40 min)

### Performance Monitoring
- [ ] **Add empty state render metrics** - Track `time_to_empty_state` metric from data load → empty state render. P95 target <100ms. Send to analytics. (~15 min)

- [ ] **Monitor broken image ratio** - Emit metric `broken_images_count / total_images_count`. Alert if >1%. Dashboard in Vercel Analytics. (~20 min)

- [ ] **Add Core Web Vitals for grid** - Measure CLS (Cumulative Layout Shift) for ImageGrid. Target CLS <0.1. Empty state shouldn't cause layout shift. (~15 min)

### Documentation
- [ ] **Document upload transaction flow** - Add mermaid diagram to `/docs/upload-flow.md` showing: client → API → Blob → DB → response. Clarify error paths. (~20 min)

- [ ] **Create troubleshooting guide** - Document "Ghost assets appeared in my library" → run `/api/assets/audit` → review broken list → run cleanup script. User-facing help. (~25 min)

- [ ] **Add empty state design rationale** - In `AESTHETIC.md`, document why minimal empty state aligns with "Crisp Lab" aesthetic. Design decision log. (~15 min)

---

## 📊 Success Metrics

### Critical (P0)
- [ ] Zero ghost assets in production after cleanup script run
- [ ] Upload success rate >99.5% (measure via telemetry)
- [ ] No DB records created without valid blob URLs

### Important (P1)
- [ ] Empty state renders in <100ms (P95)
- [ ] Zero layout shift (CLS = 0) on skeleton → empty transition
- [ ] Broken image fallbacks catch 100% of 404s without React crashes

### Nice-to-have (P2)
- [ ] Orphaned blob detection cron runs daily with <5% false positives
- [ ] Core Web Vitals for empty state: LCP <1s, FID <100ms, CLS <0.1
- [ ] Documentation covers all error paths and recovery procedures

---

## 🧪 Testing Checklist

- [ ] **Unit tests**: EmptyState component renders all variants correctly
- [ ] **Integration tests**: Upload → DB → Blob → Success path completes atomically
- [ ] **E2E tests**: New user flow: empty state → drag-drop → grid shows image
- [ ] **Error tests**: Blob 404 → ImageTile shows fallback, not blank tile
- [ ] **Performance tests**: Empty state render time <16ms in Chrome DevTools
- [ ] **Accessibility tests**: Empty state navigable via keyboard, screen reader compatible

---

## 📝 Notes

### Why this structure?
- **Atomicity**: Each task is independently testable and deployable
- **Context**: Every task explains WHY (root cause) not just WHAT (symptom)
- **Measurability**: Success criteria are objective and verifiable
- **Dependencies**: Tasks ordered by criticality, can be parallelized within priority level

### Carmack-style reasoning
1. **Ghost assets** = transactional integrity bug. Fix at root (upload flow) not symptom (UI).
2. **Empty state** = hot path for first impression. Optimize for <16ms render (60fps).
3. **Error boundaries** = graceful degradation. Never crash entire grid for one bad tile.
4. **Monitoring** = measure everything. Can't improve what you don't measure.

### Time estimates
- **P0**: ~2 hours (critical path, do first)
- **P1 UX**: ~3 hours (improves first-run experience)
- **P1 Error**: ~2.5 hours (robustness layer)
- **P2**: ~4 hours (infrastructure, can be deferred)

**Total**: ~11.5 hours for complete solution (split across 2-3 sessions)