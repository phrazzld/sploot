# CI Resolution Plan

## Root Cause Analysis

### Primary Issue: `require()` in Vitest Mock Factories

**The Problem**: Multiple test files use `require('../utils/test-helpers')` inside `vi.mock()` factory functions. Vitest hoists these factories to the top of the file and runs them in a special context where CommonJS `require()` is not available in ESM mode.

**Example** (`__tests__/api/search.test.ts:10`):
```typescript
vi.mock('@/lib/db', () => {
  const helpers = require('../utils/test-helpers');  // ❌ This fails in Vitest
  return {
    prisma: helpers.mockPrisma(),
    vectorSearch: vi.fn(),
    logSearch: vi.fn(),
  };
});
```

**Why it works locally but fails in CI**:
- Local development may have different module resolution
- CI uses strict ESM mode
- The error is legitimate - this pattern doesn't work in Vitest

### Secondary Issues

1. **Coverage Report Generation**: CI workflow doesn't handle test failures gracefully
2. **Mock Configuration**: `mockAuth.mockResolvedValue` not properly configured
3. **Incomplete Vitest Migration**: `jest.fn` remnants in upload-preflight.test.ts
4. **Date Serialization**: Test assertion expects string but gets Date object

## Classification

### [CODE FIX] Issues (Must fix to pass tests)
1. ✅ **High Impact**: Fix `require()` in mock factories (7 test files blocked)
2. ✅ **Medium Impact**: Fix `mockAuth` configuration (7 test failures)
3. ✅ **Medium Impact**: Complete Vitest migration (jest.fn → vi.fn)
4. ✅ **Low Impact**: Fix date serialization assertion

### [CI FIX] Issues (CI infrastructure improvements)
1. ⚡ **High Impact**: Update workflow to skip coverage report on test failure
2. ⚡ **Low Impact**: Add `File.arrayBuffer()` polyfill to vitest.setup.ts

## Resolution Strategy

### Phase 1: Unblock Test Execution (CODE FIX - Required)

**Goal**: Fix module import issues so all tests can at least run in CI

**Approach**: Replace `require()` in mock factories with proper ESM imports

**Pattern**:
```typescript
// ❌ BEFORE (doesn't work in Vitest)
vi.mock('@/lib/db', () => {
  const helpers = require('../utils/test-helpers');
  return {
    prisma: helpers.mockPrisma(),
  };
});

// ✅ AFTER (proper ESM pattern)
import { mockPrisma } from '../utils/test-helpers';

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma(),
  vectorSearch: vi.fn(),
  logSearch: vi.fn(),
}));
```

**Files to fix**:
1. `__tests__/api/search.test.ts`
2. `__tests__/api/search-advanced.test.ts`
3. `__tests__/api/assets.test.ts`
4. `__tests__/api/asset-crud.test.ts`
5. Similar pattern in other affected files

### Phase 2: Fix Mock Configuration (CODE FIX - Required)

**Goal**: Fix `mockAuth.mockResolvedValue is not a function` errors

**File**: `__tests__/api/upload-url.test.ts`

**Current Issue**: The `mockAuth` object is not a proper Vitest mock function

**Solution**: Check how `mockAuth` is created and ensure it's using `vi.fn()`

### Phase 3: Complete Vitest Migration (CODE FIX - Required)

**Goal**: Remove all `jest.fn` references

**File**: `__tests__/api/upload-preflight.test.ts:138`

**Solution**:
```typescript
// Replace
const mockFn = jest.fn();  // ❌

// With
const mockFn = vi.fn();  // ✅
```

### Phase 4: Fix Date Serialization (CODE FIX - Required)

**Goal**: Handle Date objects consistently in assertions

**File**: `__tests__/api/upload-preflight.test.ts:73`

**Solution**: Either:
- Convert Date to ISO string in test assertion
- Or update mock to return Date string instead of Date object

### Phase 5: Update CI Workflow (CI FIX - Optional but recommended)

**Goal**: Prevent coverage report failure when tests fail

**File**: `.github/workflows/test-coverage.yml` (or similar)

**Solution**:
```yaml
- name: Run tests with coverage
  id: test
  run: pnpm test:coverage
  continue-on-error: true  # Don't fail workflow yet

- name: Coverage Report
  if: steps.test.outcome == 'success'  # Only run if tests passed
  uses: davelosert/vitest-coverage-report-action@v2

- name: Fail if tests failed
  if: steps.test.outcome == 'failure'
  run: exit 1
```

### Phase 6: Add File.arrayBuffer Polyfill (CI FIX - Optional)

**Goal**: Support `file.arrayBuffer()` in test environment

**File**: `vitest.setup.ts`

**Solution**: Add polyfill for File.arrayBuffer if not already present

## Implementation Order

### Critical Path (Must complete for CI to pass)
1. ✅ **Fix require() in mock factories** → Unblocks 7 test files
2. ✅ **Fix mockAuth configuration** → Fixes 7 test failures
3. ✅ **Replace jest.fn with vi.fn** → Fixes 1 test failure
4. ✅ **Fix date serialization** → Fixes 1 test failure

### Optional Improvements (Can be done later)
5. ⚡ **Update CI workflow** → Prevents misleading coverage errors
6. ⚡ **Add arrayBuffer polyfill** → Improves test environment completeness

## Success Criteria

### Minimum (CI Passes)
- ✅ All tests can load and execute (no module resolution errors)
- ✅ No mock configuration errors
- ✅ No Vitest migration remnants (jest.fn)
- ✅ Test assertion logic is correct

### Ideal (Full Green)
- ✅ All 316 tests passing
- ✅ Coverage report generates successfully
- ✅ No flaky tests
- ✅ CI provides clear feedback on failures

## Risk Assessment

### Low Risk
- Fixing require() → ESM imports (well-understood pattern)
- Replacing jest.fn → vi.fn (mechanical change)

### Medium Risk
- Fixing mockAuth configuration (need to understand current setup)
- Date serialization fix (might have implications for other tests)

### High Risk
- None identified - all fixes are localized and well-understood

## Time Estimate

### Phase 1 (require() fixes): ~30 minutes
- 7 test files × ~4 minutes each

### Phase 2 (mockAuth fix): ~15 minutes
- Investigate + fix + verify

### Phase 3 (jest.fn replacement): ~5 minutes
- Simple find & replace

### Phase 4 (date serialization): ~10 minutes
- Adjust assertion or mock

### Phase 5 (CI workflow update): ~10 minutes
- Update YAML configuration

**Total**: ~70 minutes for complete fix

## Validation Plan

1. **Local verification**: Run `pnpm test` after each phase
2. **Commit incrementally**: Each phase gets its own atomic commit
3. **Push and monitor**: Watch CI run after all phases complete
4. **Iterate if needed**: Address any remaining issues revealed by CI

## Prevention Strategy

### For Future PRs
1. **Pre-commit hook**: Run `pnpm test` before allowing commit
2. **Local CI simulation**: Run tests in strict mode locally
3. **Documentation**: Add note about ESM imports in test files
4. **Code review checklist**: Check for `require()` in mock factories

### Test Best Practices
1. Never use `require()` in Vitest mock factories
2. Always use `vi.fn()` not `jest.fn()`
3. Handle Date objects consistently (use .toISOString() or expect Date objects)
4. Test locally with `--run` flag to catch issues early
