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

## ⚡ M0: Vitest Migration (Blocking P2 Test Work)

> **Why migrate**: 4-10x faster execution, instant HMR in watch mode, native ESM/TypeScript support, unified Vite ecosystem. Jest → Vitest is blocking all P2 test implementation work.

### Dependency Management

- [x] **Remove Jest packages from package.json** - ✅ Completed in commit `91be15c`. Jest packages removed, verified with grep.
  - **Resolution**: Commit 91be15c - all Jest dependencies removed

- [x] **Add Vitest packages to package.json** - ✅ Completed in commit `91be15c`. All 5 Vitest packages added with correct versions.
  - **Resolution**: Commit 91be15c - vitest, @vitest/ui, @vitest/coverage-v8, jsdom, @vitejs/plugin-react installed

### Configuration Files

- [x] **Create vitest.config.ts with coverage thresholds** - ✅ Completed in commit `60c76a1`. Full config with jsdom environment, globals, coverage thresholds, and path aliases.
  - **Resolution**: Commit 60c76a1 - created vitest.config.ts with all required settings

- [x] **Migrate jest.setup.ts to vitest.setup.ts** - ✅ Completed in commit `a3b3181`. All jest.* replaced with vi.*, updated imports, added cleanup.
  - **Resolution**: Commit a3b3181 - migrated to vitest.setup.ts with proper mocks and cleanup

- [x] **Update package.json test scripts** - ✅ Completed in commit `e2406d4`. All test scripts now use Vitest.
  - **Resolution**: Commit e2406d4 - updated scripts to vitest, test:ui, test:watch, test:coverage

### Test File Migration

- [x] **Update test file imports in __tests__ directory** - ✅ Completed in commit `4b28620`. All 15 test files migrated from Jest to Vitest imports.
  - **Resolution**: Commit 4b28620 - migrated all test file imports to Vitest

- [x] **Run vitest to verify existing tests pass** - ✅ Completed in commit `4202784`. All tests pass, faster execution than Jest.
  - **Resolution**: Commit 4202784 - verified all tests pass with Vitest

### CI/CD Integration

- [x] **Create GitHub Actions workflow for Vitest** - ✅ Completed in commit `fd76149`. Full CI workflow with coverage reporting.
  - **Resolution**: Commit fd76149 - created .github/workflows/test.yml

- [x] **Verify coverage enforcement in CI** - ✅ Verified during CI setup. Coverage thresholds enforced in vitest.config.ts.
  - **Resolution**: Coverage enforcement validated, thresholds active

- [x] **Delete jest.config.js and jest.setup.ts** - ✅ Completed in commit `1bdb73f`. All Jest configuration removed.
  - **Resolution**: Commit 1bdb73f - removed obsolete Jest files

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

> **Blocked by M0 Vitest Migration** - Complete M0 tasks before starting P2 test implementation.

All test tasks should aim for >80% coverage of new components. Use Vitest's `test.concurrent` for parallelization where tests don't share state.

### Cron Job Tests (Highest Priority - Data Integrity)

- [x] **Create audit-assets cron endpoint test suite** - ✅ Completed with 16 comprehensive test cases covering all critical paths.
  - **File**: `__tests__/api/cron/audit-assets.test.ts`
  - **Test coverage**:
    - ✅ Authentication (4 tests): CRON_SECRET validation, auth header checks, database availability
    - ✅ Asset auditing (12 tests): valid assets, broken blobs (404/403), error handling, user tracking, alert threshold
    - All 16 tests passing
  - **Resolution**: Comprehensive test suite exceeding coverage targets

- [x] **Create purge-deleted-assets cron endpoint test suite** - ✅ Completed with 16 comprehensive test cases covering all critical paths.
  - **File**: `__tests__/api/cron/purge-deleted-assets.test.ts`
  - **Test coverage**:
    - ✅ Authentication (4 tests): CRON_SECRET validation, auth headers, database availability
    - ✅ Asset purging (11 tests): 30-day cutoff, blob deletion, thumbnail handling, error resilience, success rate calculation
    - ✅ Error handling (1 test): unexpected errors
    - All 16 tests passing
  - **Resolution**: Comprehensive test suite exceeding coverage targets

- [x] **Create process-embeddings cron endpoint test suite** - ✅ Completed with 19 comprehensive test cases covering all critical paths.
  - **File**: `__tests__/api/cron/process-embeddings.test.ts`
  - **Test coverage**:
    - ✅ Authentication (4 tests): CRON_SECRET validation, auth headers, database availability
    - ✅ Asset discovery (4 tests): 1-hour cutoff, batch size limit, oldest-first ordering
    - ✅ Embedding processing (6 tests): successful generation, upsert validation, failure handling, error resilience
    - ✅ Service availability (1 test): initialization failure handling
    - ✅ Statistics (4 tests): processing stats, success rate, average time, zero success handling
    - All 19 tests passing
  - **Resolution**: Comprehensive test suite exceeding coverage targets

### Context Tests

- [x] **Create FilterContext integration test suite** - ✅ Completed with 23 comprehensive test cases covering all filter management scenarios.
  - **File**: `__tests__/contexts/filter-context.test.tsx`
  - **Test coverage**:
    - ✅ Hook usage (2 tests): error handling outside provider, context access within provider
    - ✅ Initial state (5 tests): URL param parsing for filterType ('all'/'favorites'/'recent'), tagId initialization
    - ✅ setFilterType (3 tests): URL synchronization for all filter types
    - ✅ setTagFilter (3 tests): tag setting, clearing, URL param preservation
    - ✅ toggleFavorites (3 tests): toggle from all, favorites, and recent states
    - ✅ clearTagFilter (1 test): tag removal
    - ✅ clearAllFilters (1 test): complete filter reset
    - ✅ Derived states (1 test): hasActiveFilters computation
    - ✅ Hook variants (2 tests): useFilterState and useFilterActions separation
    - ✅ URL synchronization (2 tests): scroll prevention, multi-param handling
    - All 23 tests passing
  - **Resolution**: Comprehensive test suite exceeding coverage targets

### Chrome Component Tests

- [ ] **Create Navbar component test suite** - Create `__tests__/components/chrome/navbar.test.tsx`. Mock Clerk useAuth hook. Test case 1: Renders LogoWordmark and UserAvatar when authenticated. Test case 2: Does not render UserAvatar when not authenticated. Test case 3: Opens CommandPalette when ⌘K pressed (mock window.dispatchEvent). Test case 4: Fixed positioning with correct height (56px). Test case 5: Contains correct navigation items. (~30 min)
  - **File**: `__tests__/components/chrome/navbar.test.tsx` (new file)
  - **Component**: `components/chrome/navbar.tsx` (client component)
  - **Mocks required**:
    - @clerk/nextjs useAuth() - return { isSignedIn: true/false, userId: 'test-id' }
    - Mock child components: LogoWordmark, UserAvatar (optional, can test actual)
  - **Test structure**: 5 test cases minimum
  - **Assertions**:
    - screen.getByRole('banner') exists (nav element)
    - UserAvatar present when isSignedIn=true
    - UserAvatar absent when isSignedIn=false
    - Height style = 56px (getComputedStyle)
    - Position = fixed (getComputedStyle)
  - **Keyboard shortcut test**: fireEvent.keyDown with { key: 'k', metaKey: true }, verify command palette event
  - **Coverage target**: 80%+
  - **Reference**: `components/chrome/navbar.tsx`

- [ ] **Create CommandPalette component test suite** - Create `__tests__/components/chrome/command-palette.test.tsx`. Test case 1: Opens when ⌘K pressed (custom event listener). Test case 2: Closes when Escape pressed. Test case 3: Filters command list when typing in search input. Test case 4: Executes command when Enter pressed. Test case 5: Focus trap prevents tabbing outside. Test case 6: Clicking backdrop closes palette. Test case 7: Arrow keys navigate command list. (~40 min)
  - **File**: `__tests__/components/chrome/command-palette.test.tsx` (new file)
  - **Component**: `components/chrome/command-palette.tsx` (complex client component)
  - **Test structure**: 7 test cases minimum
  - **Setup**: May need to mock next/navigation for command actions
  - **Assertions**:
    - Initially closed (display: none or not in DOM)
    - Opens on custom event or ⌘K
    - Filter input reduces visible commands (getAllByRole('option').length)
    - Enter on command executes action (verify callback or route change)
    - Escape closes palette
    - Tab focus stays within dialog
  - **User interaction test**: Use userEvent.keyboard() for key sequences
  - **Coverage target**: 85%+ (complex interaction logic)
  - **Reference**: `components/chrome/command-palette.tsx`

- [ ] **Create SearchBarElastic component test suite** - Create `__tests__/components/chrome/search-bar-elastic.test.tsx`. Use fake timers for debounce testing. Test case 1: Input debounced for 300ms (no callback until debounce expires). Test case 2: Pressing Enter triggers immediate search. Test case 3: Clear button (X) clears input and triggers empty search. Test case 4: Elastic width animation applies correct CSS classes. Test case 5: Handles empty state correctly. Test case 6: Updates URL params on search. (~30 min)
  - **File**: `__tests__/components/chrome/search-bar-elastic.test.tsx` (new file)
  - **Component**: `components/chrome/search-bar-elastic.tsx`
  - **Test structure**: 6 test cases minimum
  - **Timing test setup**:
    - `vi.useFakeTimers()` in beforeEach
    - `vi.runAllTimers()` or `vi.advanceTimersByTime(300)` to test debounce
    - `vi.useRealTimers()` in afterEach
  - **Assertions**:
    - Type "test", verify callback NOT called immediately
    - Advance timers 300ms, verify callback called with "test"
    - Type "test", press Enter, verify callback called immediately (before debounce)
    - Click clear button, verify input.value = "" and callback called
  - **Animation test**: Check classList contains expected CSS classes for width expansion
  - **Coverage target**: 85%+ (includes debounce logic)
  - **Reference**: `components/chrome/search-bar-elastic.tsx`

- [ ] **Create FilterChips component test suite** - Create `__tests__/components/chrome/filter-chips.test.tsx`. Mock useFilterContext hook. Test case 1: Renders chip for each active filter (tags, favorites, recent). Test case 2: Clicking tag chip calls toggleTag with tag value. Test case 3: Clicking favorites chip calls toggleFavorites. Test case 4: Clicking recent chip calls toggleRecent. Test case 5: URL params stay in sync with visible chips. Test case 6: "Clear all" button clears all filters. (~25 min)
  - **File**: `__tests__/components/chrome/filter-chips.test.tsx` (new file)
  - **Component**: `components/chrome/filter-chips.tsx`
  - **Test structure**: 6 test cases minimum
  - **Mocks required**:
    - contexts/filter-context useFilterContext() - return mock state and actions
  - **Setup**: Mock context with active filters (tags: ['meme', 'cat'], showFavorites: true)
  - **Assertions**:
    - getAllByRole('button') length = number of active filters + 1 (clear all)
    - Click chip, verify mock toggleTag/toggleFavorites called
    - Click "Clear all", verify clearFilters called
    - No chips rendered when no active filters
  - **Coverage target**: 80%+
  - **Reference**: `components/chrome/filter-chips.tsx`

- [ ] **Create ViewModeToggle component test suite** - Create `__tests__/components/chrome/view-mode-toggle.test.tsx`. Mock useSearchParams and useRouter. Test case 1: Shows active state for current view mode (grid or list). Test case 2: Clicking grid button sets viewMode=grid in URL. Test case 3: Clicking list button sets viewMode=list in URL. Test case 4: Keyboard shortcut "1" sets grid mode. Test case 5: Keyboard shortcut "2" sets list mode. Test case 6: Persists selection across page reloads (via URL). (~25 min)
  - **File**: `__tests__/components/chrome/view-mode-toggle.test.tsx` (new file)
  - **Component**: `components/chrome/view-mode-toggle.tsx`
  - **Test structure**: 6 test cases minimum
  - **Mocks required**:
    - next/navigation useSearchParams - return URLSearchParams with viewMode
    - next/navigation useRouter - return mock with push()
  - **Assertions**:
    - Active button has aria-pressed="true" or CSS class
    - Click grid button, verify router.push called with viewMode=grid
    - Click list button, verify router.push called with viewMode=list
    - fireEvent.keyDown "1", verify grid mode set
    - fireEvent.keyDown "2", verify list mode set
  - **Persistence test**: Mock searchParams with viewMode=list, verify list button active on render
  - **Coverage target**: 80%+
  - **Reference**: `components/chrome/view-mode-toggle.tsx`

### Error Boundary Tests

- [ ] **Create ImageTileErrorBoundary test suite** - Create or extend `__tests__/components/library/image-tile-error-boundary.test.tsx`. Test case 1: Catches render error in child component. Test case 2: Displays fallback UI with filename for context. Test case 3: Retry button resets error boundary state and re-renders child. Test case 4: Delete button triggers onDelete callback. Test case 5: Error boundary doesn't catch errors from event handlers (expected behavior). (~25 min)
  - **File**: `__tests__/components/library/image-tile-error-boundary.test.tsx` (new or extend existing)
  - **Component**: `components/library/image-tile-error-boundary.tsx`
  - **Test structure**: 5 test cases minimum
  - **Setup**: Create ThrowError component that throws on render
  - **Error boundary testing**:
    - Wrap ThrowError in ImageTileErrorBoundary
    - Suppress console.error during test: `vi.spyOn(console, 'error').mockImplementation(() => {})`
    - Verify fallback UI renders
  - **Assertions**:
    - Error message displayed
    - Filename prop shown in fallback
    - Click retry button, error boundary resets (child re-renders)
    - Click delete button, verify onDelete callback fired
  - **Coverage target**: 85%+ (error path coverage)
  - **Reference**: `components/library/image-tile-error-boundary.tsx`
  - **Note**: May already have `image-grid-error-boundary.test.tsx`, extend for tile-level boundary

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

**M0 Vitest Migration**: ✅ 9/9 tasks complete (100%) - **COMPLETE**
- ✅ Dependency management (2 tasks)
- ✅ Configuration files (3 tasks)
- ✅ Test migration (2 tasks)
- ✅ CI/CD integration (2 tasks)

**P0 Critical**: ✅ 3/3 complete (100%)
**P1 High Priority**: ✅ 5/5 complete (100%)
**P2 Test Coverage**: 4/14 complete (29%) - **IN PROGRESS**
- ✅ Cron job tests (3/3 complete - audit-assets, purge-deleted-assets, process-embeddings)
- ✅ Context tests (1/1 complete - FilterContext)
- Chrome component tests (5 tasks, ~2.5 hours) - **NEXT UP**
- Error boundary tests (1 task, ~25 min)

**Total**: 21/34 tasks complete (62%)

**Next milestone**: Complete P2 chrome component tests (~2.5 hours)

**Critical path**: P2 Chrome tests → P2 Error boundaries

**Estimated completion**: ~2.75 hours total remaining work
