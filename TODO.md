# TODO

> **Active Work**: Concrete implementation tasks that need to be done now.
> Each task is atomic, testable, and can be completed in a single focused session.

## 🔴 P0: Critical / Merge-Blocking Issues

### Schema & Database

- [ ] **Add deletedAt field to Asset schema** - The cron job at `app/api/cron/purge-deleted-assets/route.ts:64-69` queries `asset.deletedAt` but this field doesn't exist in the Prisma schema. Add `deletedAt DateTime?` to the `Asset` model in `prisma/schema.prisma`, then run `pnpm db:migrate:dev` to generate migration. Update the cron job to handle nullable field properly. (~20 min)
  - **File**: `prisma/schema.prisma`
  - **Why critical**: Will cause production failure when cron runs
  - **PR feedback**: Multiple reviews flagged this

### Security

- [ ] **Fix cron endpoint auth bypass in development** - Currently `app/api/cron/*/route.ts` files skip auth entirely when `NODE_ENV !== 'production'` (lines ~40-50 in each cron file). This leaves dev databases vulnerable. Either: (1) Always require Vercel cron secret header, or (2) Use separate dev-only secret from `.env.local`. Reject requests without proper auth even in dev. (~15 min)
  - **Files**: `app/api/cron/audit-assets/route.ts`, `app/api/cron/purge-deleted-assets/route.ts`
  - **Why critical**: Security vulnerability in development environments
  - **PR feedback**: Flagged as security concern in latest review

### Race Conditions

- [ ] **Add transaction handling or advisory locks to upload route** - The upload flow at `app/api/upload/route.ts:106-469` has a TOCTOU (time-of-check-time-of-use) race condition: existence check → blob upload → DB insert can result in orphaned blobs if two identical files upload simultaneously. Solutions: (1) Use Prisma `$transaction()` with serializable isolation, (2) Add unique constraint on filename+userID and catch violation, or (3) Use Postgres advisory locks during upload. Document the chosen approach. (~45 min)
  - **File**: `app/api/upload/route.ts`
  - **Why critical**: Can cause blob storage leaks
  - **PR feedback**: Identified as high-priority race condition
  - **Note**: May need performance testing after fix

## ⚠️ P1: High-Priority Improvements

### Error Handling

- [ ] **Add embedding failure status update in async handler** - In `app/api/upload/route.ts:567-620`, the `generateEmbeddingAsync()` function catches errors but doesn't update the asset's `embeddingStatus` to 'failed'. This leaves assets stuck in 'processing' state forever. Add `await prisma.asset.update({ where: { id }, data: { embeddingStatus: 'failed', embeddingError: error.message } })` in the catch block. (~10 min)
  - **File**: `app/api/upload/route.ts`
  - **Why important**: User-facing bug that breaks search functionality
  - **PR feedback**: Multiple reviews mentioned this

### Performance

- [ ] **Remove debugInfo.queuePosition from useEffect dependencies** - In `components/library/image-tile.tsx:65-72`, the useEffect includes `debugInfo.queuePosition` in its dependency array, causing unnecessary re-runs every time queue position changes. This is only for debug visualization. Remove from deps or move to separate effect. (~5 min)
  - **File**: `components/library/image-tile.tsx:65-72`
  - **Why important**: Unnecessary re-renders impact performance
  - **PR feedback**: Identified as memory leak potential

- [ ] **Remove console.log from production code** - Found in `components/upload/upload-zone.tsx:94` (production code) and various test files. Remove or replace with proper logger (e.g., create `lib/logger.ts` with dev/prod modes). Use conditional logging: `if (process.env.NODE_ENV === 'development') console.log(...)`. (~20 min)
  - **Files**: `components/upload/upload-zone.tsx`, `__tests__/e2e/batch-upload.spec.ts`, `__tests__/e2e/large-batch-upload.spec.ts`
  - **Why important**: Performance overhead and log pollution
  - **PR feedback**: Flagged in multiple reviews

### Documentation

- [ ] **Document useCallback requirements in ImageTile memo** - The custom `arePropsEqual` function at `components/library/image-tile.tsx:566-592` assumes parent components wrap functions in useCallback, but this isn't enforced or documented. Add JSDoc comment explaining the requirement and consequences of violating it (unnecessary re-renders). Include example of proper parent usage. (~10 min)
  - **File**: `components/library/image-tile.tsx:563-594`
  - **Why important**: Prevents future bugs from misuse
  - **PR feedback**: Suggested as documentation improvement

- [ ] **Document upload race condition in comments** - Add detailed comment block at top of `app/api/upload/route.ts` explaining the concurrency considerations, chosen solution (from P0 task above), and why alternative approaches were rejected. Include example of problematic scenario. (~15 min)
  - **File**: `app/api/upload/route.ts`
  - **Why important**: Helps future maintainers understand critical logic
  - **PR feedback**: Recommended for production readiness

## 📝 P2: Test Coverage Gaps

All test tasks should aim for >80% coverage of new components.

### Chrome Component Tests

- [ ] **Add unit tests for Navbar component** - Create `__tests__/components/chrome/navbar.test.tsx`. Test: renders all navigation items, handles auth state correctly, responds to viewport changes (mobile/desktop), keyboard shortcuts work (⌘K opens palette). (~30 min)
  - **File**: `components/chrome/navbar.tsx`
  - **Why important**: Core navigation with no test coverage
  - **PR feedback**: Flagged by all 8 reviews

- [ ] **Add unit tests for FilterChips component** - Create `__tests__/components/chrome/filter-chips.test.tsx`. Test: renders active filters, clicking chip clears filter, URL params sync correctly, favorites toggle works, recent filter displays. (~25 min)
  - **File**: `components/chrome/filter-chips.tsx`
  - **PR feedback**: Mentioned in multiple reviews

- [ ] **Add unit tests for ViewModeToggle** - Create `__tests__/components/chrome/view-mode-toggle.test.tsx`. Test: switches between grid/list modes, updates URL params, persists selection, keyboard shortcuts (1, 2) trigger correct modes, shows active state. (~20 min)
  - **File**: `components/chrome/view-mode-toggle.tsx`
  - **PR feedback**: Consistently mentioned as untested

- [ ] **Add unit tests for CommandPalette** - Create `__tests__/components/chrome/command-palette.test.tsx`. Test: opens with ⌘K, filters commands on typing, executes selected command, closes on Escape, focus trap works, handles navigation. (~35 min)
  - **File**: `components/chrome/command-palette.tsx`
  - **PR feedback**: Complex component with zero coverage

- [ ] **Add unit tests for SearchBarElastic** - Create `__tests__/components/chrome/search-bar-elastic.test.tsx`. Test: debounces input (300ms), updates URL on Enter, clears on X button, handles empty state, triggers search callback, elastic width animation works. (~25 min)
  - **File**: `components/chrome/search-bar-elastic.tsx`
  - **PR feedback**: Mentioned as needing debounce validation

### Context Tests

- [ ] **Add integration tests for FilterContext** - Create `__tests__/contexts/filter-context.test.tsx`. Test: provides correct initial state from URL, updates URL on filter changes, clears filters correctly, tag filter works, favorites toggle persists, recent filter applies correct sort. (~30 min)
  - **File**: `contexts/filter-context.tsx`
  - **Why important**: Central state management with no coverage
  - **PR feedback**: Identified as gap by multiple reviews

### Error Boundary Tests

- [ ] **Add tests for ImageTileErrorBoundary** - Extend `__tests__/components/library/image-grid-error-boundary.test.tsx` to cover the tile-level boundary. Test: catches render errors, shows retry button, retry resets error state, delete button works, displays filename for context. (~20 min)
  - **File**: `components/library/image-tile-error-boundary.tsx`
  - **PR feedback**: Error boundaries need test coverage

### Cron Job Tests

- [ ] **Add tests for cron endpoints** - Create `__tests__/api/cron/`. Test audit-assets route: finds orphaned blobs, sends alerts when >10 found, respects auth header. Test purge-deleted-assets route: only deletes assets >30 days old, updates counts correctly, handles empty case. (~40 min)
  - **Files**: `app/api/cron/audit-assets/route.ts`, `app/api/cron/purge-deleted-assets/route.ts`
  - **Why important**: Critical data integrity operations with zero coverage
  - **PR feedback**: Mentioned as testing gap

---

## ✅ Completed Tasks

*(Tasks will move here as they're completed)*

---

## 📊 Progress Tracking

**P0 Critical**: 0/3 complete
**P1 High Priority**: 0/6 complete
**P2 Test Coverage**: 0/8 complete

**Total**: 0/17 tasks complete

**Estimated time to P0 completion**: ~1.5 hours
**Estimated time to P1 completion**: ~2.5 hours
**Estimated time to full completion**: ~6 hours
