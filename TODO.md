# TODO

> **Active Work**: Concrete implementation tasks that need to be done now.
> Each task is atomic, testable, and can be completed in a single focused session.

## 🔴 P0: Critical / Merge-Blocking Issues

### Schema & Database

- [x] **Add deletedAt field to Asset schema** - ✅ Field already exists at `prisma/schema.prisma:51`. Verified working with type-check. No action needed.
  - **File**: `prisma/schema.prisma`
  - **Why critical**: Will cause production failure when cron runs
  - **PR feedback**: Multiple reviews flagged this
  - **Resolution**: Verified existing implementation

### Security

- [x] **Fix cron endpoint auth bypass in development** - ✅ Fixed in commit `d571184`. All 3 cron endpoints now require `CRON_SECRET` in all environments. Removed `NODE_ENV` bypass that left dev vulnerable.
  - **Files**: `app/api/cron/audit-assets/route.ts`, `app/api/cron/purge-deleted-assets/route.ts`, `app/api/cron/process-embeddings/route.ts`
  - **Why critical**: Security vulnerability in development environments
  - **PR feedback**: Flagged as security concern in latest review
  - **Resolution**: Commit d571184 - require auth in all environments

### Race Conditions

- [x] **Add transaction handling or advisory locks to upload route** - ✅ Implementation already correct. Added comprehensive documentation in commit `493f0eb` explaining the P2002 constraint-based approach with blob cleanup.
  - **File**: `app/api/upload/route.ts`
  - **Why critical**: Can cause blob storage leaks
  - **PR feedback**: Identified as high-priority race condition
  - **Note**: May need performance testing after fix
  - **Resolution**: Commit 493f0eb - documented existing correct implementation

## ⚠️ P1: High-Priority Improvements

### Error Handling

- [x] **Add embedding failure status update in async handler** - ✅ Fixed in commit `0aa5e9e`. Added upsert to AssetEmbedding to mark status='failed' when embedding generation fails. Prevents assets stuck in 'processing' forever.
  - **File**: `app/api/upload/route.ts`
  - **Why important**: User-facing bug that breaks search functionality
  - **PR feedback**: Multiple reviews mentioned this
  - **Resolution**: Commit 0aa5e9e - upsert failed status to database

### Performance

- [x] **Remove debugInfo.queuePosition from useEffect dependencies** - ✅ Fixed in commit `0aa5e9e`. Removed from dependency array as it's set internally by the effect. Added explanatory comment with eslint-disable.
  - **File**: `components/library/image-tile.tsx:65-72`
  - **Why important**: Unnecessary re-renders impact performance
  - **PR feedback**: Identified as memory leak potential
  - **Resolution**: Commit 0aa5e9e - removed from deps array

- [x] **Remove console.log from production code** - ✅ Fixed in commit `0aa5e9e`. Replaced all console.log with logger.debug() which is automatically tree-shaken in production. Kept console.error for actual errors.
  - **Files**: `components/upload/upload-zone.tsx`
  - **Why important**: Performance overhead and log pollution
  - **PR feedback**: Flagged in multiple reviews
  - **Resolution**: Commit 0aa5e9e - replaced with lib/logger.debug()

### Documentation

- [x] **Document useCallback requirements in ImageTile memo** - ✅ Added in commit `a38ddf4`. Comprehensive JSDoc with correct/incorrect examples, performance consequences, and rationale for skipping function comparison.
  - **File**: `components/library/image-tile.tsx:566-607`
  - **Why important**: Prevents future bugs from misuse
  - **PR feedback**: Suggested as documentation improvement
  - **Resolution**: Commit a38ddf4 - added detailed JSDoc

- [x] **Document upload race condition in comments** - ✅ Completed in commit `493f0eb` (P0 task). Added comprehensive comment block explaining concurrency handling, P2002 constraint approach, and rejected alternatives.
  - **File**: `app/api/upload/route.ts:19-37`
  - **Why important**: Helps future maintainers understand critical logic
  - **PR feedback**: Recommended for production readiness
  - **Resolution**: Commit 493f0eb - documented in function JSDoc

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

### P0: Critical / Merge-Blocking Issues (3/3) ✅
- [x] Asset.deletedAt field verification (already existed)
- [x] Cron endpoint auth bypass fix (commit d571184)
- [x] Upload race condition documentation (commit 493f0eb)

### P1: High-Priority Improvements (5/5) ✅
- [x] Embedding failure status update (commit 0aa5e9e)
- [x] useEffect dependency optimization (commit 0aa5e9e)
- [x] Production logging cleanup (commit 0aa5e9e)
- [x] useCallback requirements documentation (commit a38ddf4)
- [x] Upload race condition documentation (commit 493f0eb)

---

## 📊 Progress Tracking

**P0 Critical**: ✅ 3/3 complete (100%)
**P1 High Priority**: ✅ 5/5 complete (100%)
**P2 Test Coverage**: 0/8 complete (0%)

**Total**: 8/16 tasks complete (50%)

**All merge-blocking and high-priority issues resolved!** 🎉

**Remaining work**: P2 test coverage (~4 hours estimated)
- Chrome component tests (5 components, ~2.5 hours)
- Context integration tests (~30 min)
- Error boundary tests (~20 min)
- Cron job tests (~40 min)
