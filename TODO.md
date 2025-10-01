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

- [ ] **Remove Jest packages from package.json** - Execute `pnpm remove jest @jest/globals @types/jest jest-environment-jsdom`. Verify removal in package.json dependencies section. Check lock file updated. (~2 min)
  - **Command**: `pnpm remove jest @jest/globals @types/jest jest-environment-jsdom`
  - **Verify**: grep "jest" package.json should return empty (except in comments)
  - **Files modified**: `package.json`, `pnpm-lock.yaml`

- [ ] **Add Vitest packages to package.json** - Execute `pnpm add -D vitest@^2.1.0 @vitest/ui@^2.1.0 @vitest/coverage-v8@^2.1.0 jsdom@^25.0.0 @vitejs/plugin-react@^4.3.0`. Verify versions in package.json devDependencies. (~2 min)
  - **Command**: `pnpm add -D vitest@^2.1.0 @vitest/ui@^2.1.0 @vitest/coverage-v8@^2.1.0 jsdom@^25.0.0 @vitejs/plugin-react@^4.3.0`
  - **Verify**: All 5 packages present in devDependencies with correct versions
  - **Files modified**: `package.json`, `pnpm-lock.yaml`

### Configuration Files

- [ ] **Create vitest.config.ts with coverage thresholds** - Create root-level config. Set environment: 'jsdom', setupFiles: ['./vitest.setup.ts'], globals: true. Configure v8 coverage provider with 80% branches/functions, 90% lines/statements thresholds matching jest.config.js. Add path alias '@' → './' for Next.js imports. (~15 min)
  - **File**: `vitest.config.ts` (new file, root directory)
  - **Key config**:
    - `test.environment: 'jsdom'`
    - `test.globals: true` (no need to import describe/it/expect)
    - `test.setupFiles: ['./vitest.setup.ts']`
    - `coverage.provider: 'v8'`
    - `coverage.thresholds: { branches: 80, functions: 80, lines: 90, statements: 90 }`
    - `resolve.alias: { '@': path.resolve(__dirname, './') }`
  - **Verify**: `pnpm vitest --version` returns version number
  - **Template**: See implementation plan for exact config structure

- [ ] **Migrate jest.setup.ts to vitest.setup.ts** - Copy jest.setup.ts → vitest.setup.ts. Replace all `jest.fn()` with `vi.fn()`, `jest.mock()` with `vi.mock()`. Add `import { vi } from 'vitest'` at top. Replace `@testing-library/jest-dom` import with `@testing-library/jest-dom/vitest`. Add `afterEach(() => { cleanup() })` for React Testing Library. (~20 min)
  - **Files**: `vitest.setup.ts` (new), `jest.setup.ts` (keep for reference, delete later)
  - **Import changes**:
    - Add: `import { vi, afterEach } from 'vitest'`
    - Change: `import '@testing-library/jest-dom'` → `import '@testing-library/jest-dom/vitest'`
    - Add: `import { cleanup } from '@testing-library/react'`
  - **Global replacements**:
    - `jest.fn()` → `vi.fn()`
    - `jest.mock(` → `vi.mock(`
    - `jest.spyOn(` → `vi.spyOn(`
  - **Verify**: No syntax errors, TypeScript compiles
  - **Testing**: Run `pnpm vitest run` to ensure setup loads

- [ ] **Update package.json test scripts** - Replace test script with `"test": "vitest"`. Add `"test:ui": "vitest --ui"`, `"test:coverage": "vitest run --coverage"`, `"test:watch": "vitest watch"`. Remove jest-specific scripts if any exist. (~3 min)
  - **File**: `package.json`
  - **Scripts to modify**:
    ```json
    {
      "test": "vitest",
      "test:ui": "vitest --ui",
      "test:coverage": "vitest run --coverage",
      "test:watch": "vitest watch"
    }
    ```
  - **Verify**: `pnpm test --version` shows Vitest version
  - **Commit point**: Configuration complete, ready for test migration

### Test File Migration

- [ ] **Update test file imports in __tests__ directory** - Scan all `__tests__/**/*.test.{ts,tsx}` files. Replace Jest imports with Vitest. Change `import { describe, it, expect } from '@jest/globals'` to `import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'`. Replace `jest.fn()` → `vi.fn()`, `jest.mock()` → `vi.mock()`. (~30 min)
  - **Files to modify**: All files matching `__tests__/**/*.test.{ts,tsx}`
  - **Find command**: `find __tests__ -name "*.test.ts" -o -name "*.test.tsx"`
  - **Replacements per file**:
    - Import: `from '@jest/globals'` → `from 'vitest'`
    - Add `vi` to imports if using mocks
    - `jest.fn()` → `vi.fn()`
    - `jest.mock(` → `vi.mock(`
    - `jest.spyOn(` → `vi.spyOn(`
    - `jest.clearAllMocks()` → `vi.clearAllMocks()`
  - **Verify**: TypeScript compilation passes with no import errors
  - **Estimate**: 3-5 files currently exist, ~6 min per file

- [ ] **Run vitest to verify existing tests pass** - Execute `pnpm test` and verify all existing tests pass with Vitest. Check for any timing issues (Vitest runs in parallel by default). Review test output for warnings or deprecations. Fix any breaking changes. (~15 min)
  - **Command**: `pnpm test`
  - **Acceptance criteria**:
    - All tests pass (green checkmarks)
    - No console warnings about incompatible APIs
    - Test count matches previous Jest runs
    - Execution time < 2 seconds (should be faster than Jest)
  - **Troubleshooting**: If tests fail, check mock implementations (vi.fn() vs jest.fn() behavior differences)
  - **Commit point**: All existing tests passing on Vitest

### CI/CD Integration

- [ ] **Create GitHub Actions workflow for Vitest** - Create `.github/workflows/test.yml` with job that runs pnpm install, pnpm test:coverage. Add coverage report action using `davelosert/vitest-coverage-report-action@v2`. Configure to fail if coverage thresholds not met. (~20 min)
  - **File**: `.github/workflows/test.yml` (new file)
  - **Required steps**:
    1. Checkout code (actions/checkout@v4)
    2. Setup pnpm (pnpm/action-setup@v4)
    3. Setup Node.js 22 with pnpm cache (actions/setup-node@v4)
    4. Install dependencies (pnpm install)
    5. Run tests with coverage (pnpm test:coverage)
    6. Post coverage report (davelosert/vitest-coverage-report-action@v2)
  - **Trigger events**: pull_request, push to master/main
  - **Verify**: Create test PR or push to branch, watch Actions tab
  - **Expected result**: Workflow runs in ~2-3 minutes, posts coverage comment on PR

- [ ] **Verify coverage enforcement in CI** - Push test commit that artificially lowers coverage below thresholds (comment out test case). Verify workflow fails with clear error message about coverage. Revert change and verify workflow passes. (~10 min)
  - **Test procedure**:
    1. Comment out a test in existing test file
    2. Commit and push
    3. Check GitHub Actions failure with "Coverage threshold not met" message
    4. Revert commit
    5. Verify workflow passes
  - **Acceptance criteria**: CI fails when thresholds not met, passes when thresholds met
  - **Files**: Temporary change to any `__tests__/**/*.test.tsx` file
  - **Commit point**: Quality gates enforced, migration complete

- [ ] **Delete jest.config.js and jest.setup.ts** - Remove obsolete Jest configuration files. Verify no references remain in codebase (grep for 'jest.config' and 'jest.setup'). Update any documentation that references Jest testing. (~5 min)
  - **Files to delete**: `jest.config.js`, `jest.setup.ts`
  - **Commands**:
    - `rm jest.config.js jest.setup.ts`
    - `grep -r "jest\.config" .` (should return empty)
    - `grep -r "jest\.setup" .` (should return empty)
  - **Update**: `CLAUDE.md` if it references Jest commands
  - **Commit message**: "chore: remove Jest configuration after Vitest migration"

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

- [ ] **Create audit-assets cron endpoint test suite** - Create `__tests__/api/cron/audit-assets.test.ts`. Mock Vercel Blob `list()` and Prisma queries. Test case 1: Finds orphaned blobs (blobs exist but no asset records). Test case 2: Returns count of orphaned blobs. Test case 3: Sends alert when >10 orphans found. Test case 4: Returns 401 when auth header missing. Test case 5: Returns 401 when auth header incorrect. (~25 min)
  - **File**: `__tests__/api/cron/audit-assets.test.ts` (new file)
  - **Imports needed**: `@vercel/blob` mock, Prisma mock from test-helpers
  - **Test structure**: 5 test cases minimum
  - **Mocks required**:
    - `vi.mock('@vercel/blob')` - list() returns blob URLs
    - Prisma.asset.findMany() - returns subset of blobs (creates orphans)
    - headers() - returns auth header or empty
  - **Assertions**:
    - Orphan detection: blobs in storage but not in database
    - Alert threshold: console.warn when orphanCount > 10
    - Auth: 401 when CRON_SECRET missing/incorrect
  - **Coverage target**: 95%+ (critical data integrity path)
  - **Reference**: `app/api/cron/audit-assets/route.ts`

- [ ] **Create purge-deleted-assets cron endpoint test suite** - Create `__tests__/api/cron/purge-deleted-assets.test.ts`. Mock Prisma queries and Vercel Blob delete. Test case 1: Only deletes assets where deletedAt > 30 days ago. Test case 2: Skips assets with deletedAt within 30 days. Test case 3: Returns correct counts (purgedCount, failedCount). Test case 4: Handles blob deletion failures gracefully. Test case 5: Returns 401 when auth header missing. Test case 6: Handles empty result set (no assets to purge). (~25 min)
  - **File**: `__tests__/api/cron/purge-deleted-assets.test.ts` (new file)
  - **Test structure**: 6 test cases minimum
  - **Mocks required**:
    - Prisma.asset.findMany() with deletedAt filtering
    - Prisma.asset.delete()
    - @vercel/blob del()
    - headers() for auth
  - **Date calculations**: 30 days = 30 * 24 * 60 * 60 * 1000 ms
  - **Critical test**: Mock Date.now() to control time, create assets with deletedAt = now - 31 days (should purge) and now - 29 days (should skip)
  - **Assertions**:
    - Deletes assets where deletedAt < (now - 30 days)
    - Returns accurate counts
    - Continues on blob delete failure (failedCount increments)
  - **Coverage target**: 95%+ (critical data integrity path)
  - **Reference**: `app/api/cron/purge-deleted-assets/route.ts`

- [ ] **Create process-embeddings cron endpoint test suite** - Create `__tests__/api/cron/process-embeddings.test.ts`. Mock embedding service and Prisma queries. Test case 1: Finds assets older than 1 hour with no embedding. Test case 2: Processes batch of 10 assets maximum. Test case 3: Updates AssetEmbedding on success. Test case 4: Marks embedding as failed on error. Test case 5: Returns stats (totalProcessed, successCount, failureCount). Test case 6: Continues processing after single asset failure. Test case 7: Returns 503 when embedding service unavailable. (~30 min)
  - **File**: `__tests__/api/cron/process-embeddings.test.ts` (new file)
  - **Test structure**: 7 test cases minimum
  - **Mocks required**:
    - createEmbeddingService() - returns mock with embedImage()
    - Prisma.asset.findMany() - returns assets needing embeddings
    - upsertAssetEmbedding() - stores embedding result
    - headers() for auth
  - **Time calculations**: 1 hour ago = Date.now() - (60 * 60 * 1000)
  - **Critical test**: Verify batch size limit (findMany take: 10), verify oldest-first ordering (orderBy createdAt asc)
  - **Error handling test**: embedImage() throws error, verify next assets still processed
  - **Assertions**:
    - Batch size ≤ 10 assets
    - Processes oldest assets first
    - Stats match actual results
    - Failed assets don't block batch
  - **Coverage target**: 90%+ (includes error paths)
  - **Reference**: `app/api/cron/process-embeddings/route.ts`

### Context Tests

- [ ] **Create FilterContext integration test suite** - Create `__tests__/contexts/filter-context.test.tsx`. Use renderHook from @testing-library/react. Mock useSearchParams and useRouter from next/navigation. Test case 1: Initializes state from URL search params (query, tags, showFavorites, showRecent). Test case 2: setQuery updates state and pushes to router. Test case 3: toggleTag adds/removes tags from array. Test case 4: toggleFavorites toggles boolean. Test case 5: toggleRecent toggles boolean and updates sort order. Test case 6: clearFilters resets all state to defaults. (~35 min)
  - **File**: `__tests__/contexts/filter-context.test.tsx` (new file)
  - **Test utilities**: `renderHook` from @testing-library/react
  - **Mocks required**:
    - next/navigation useSearchParams (return URLSearchParams mock)
    - next/navigation useRouter (return mock with push, replace)
    - next/navigation usePathname (return '/library')
  - **Test structure**: 6 test cases minimum
  - **Setup per test**: Create wrapper with FilterProvider, render hook inside
  - **Assertions**:
    - Initial state matches URL params
    - State updates trigger router.push with new URLSearchParams
    - Tag array manipulation works (add/remove)
    - Boolean toggles work correctly
    - clearFilters returns to empty state
  - **URL sync test**: After state change, verify router.push called with correct query string
  - **Coverage target**: 85%+ (central state management)
  - **Reference**: `contexts/filter-context.tsx`

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

**M0 Vitest Migration**: 0/9 tasks complete (0%) - **BLOCKING P2**
- Dependency management (2 tasks)
- Configuration files (3 tasks)
- Test migration (2 tasks)
- CI/CD integration (2 tasks)

**P0 Critical**: ✅ 3/3 complete (100%)
**P1 High Priority**: ✅ 5/5 complete (100%)
**P2 Test Coverage**: 0/14 complete (0%) - **BLOCKED BY M0**
- Cron job tests (3 tasks, ~80 min)
- Context tests (1 task, ~35 min)
- Chrome component tests (5 tasks, ~2.5 hours)
- Error boundary tests (1 task, ~25 min)

**Total**: 8/34 tasks complete (23.5%)

**Next milestone**: Complete M0 Vitest migration (~2 hours) to unblock P2 test work (~5 hours)

**Critical path**: M0 → P2 Cron tests → P2 Context tests → P2 Chrome tests → P2 Error boundaries

**Estimated completion**: ~7 hours total remaining work
