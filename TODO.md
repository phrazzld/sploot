# TODO: Test Suite Remediation

**Context**: CI test failures preventing merge. 66 tests failing across multiple suites.
**Branch**: `redesign/navbar-footer-architecture`
**Status**: Build passing ✅, Tests failing ❌ (332/398 passing, 83.4%)
**Goal**: Achieve 95%+ pass rate (380+/398 tests passing)

---

## P0: Critical Mocking Infrastructure Fixes (Blocks 32 tests)

### [TEST FIX] Refactor Prisma Mocking Strategy

**Root Cause**: `vi.mocked(prisma)` doesn't create nested mock functions. Tests call `prisma.assetTag.findMany.mockResolvedValue()` but that method doesn't exist as a mock.

**Current (Broken)**:
```typescript
vi.mock('@/lib/db');
const mockPrisma = vi.mocked(prisma);
// Later in test:
prisma.assetTag.findMany.mockResolvedValue([]);  // ❌ Not a function
```

**Solution Options**:

**Option A: Use mockPrisma() factory (RECOMMENDED)**
- Leverage existing `mockPrisma()` helper from test-helpers.ts
- Provides pre-configured nested mocks for all Prisma models
- Consistent with other working tests

**Option B: Manual nested mock creation**
- Create mocks for each Prisma method individually
- More boilerplate but maximum control

---

### Task 1: Fix search-flow.test.ts Prisma Mocks (12 failures)

**File**: `__tests__/integration/search-flow.test.ts`
**Failures**: 12/16 tests
**Error Pattern**: `prisma.assetTag.findMany.mockResolvedValue is not a function`

**Implementation Steps**:

1. **Replace current mock setup** (lines 10-22):
   ```typescript
   // REMOVE:
   vi.mock('@/lib/db');
   const mockPrisma = vi.mocked(prisma);

   // REPLACE WITH:
   import { mockPrisma } from '../utils/test-helpers';

   vi.mock('@/lib/db', () => ({
     prisma: mockPrisma(),
     vectorSearch: vi.fn(),
     logSearch: vi.fn(),
     databaseAvailable: true,
   }));
   ```

2. **Update beforeEach** to configure mock behavior:
   ```typescript
   beforeEach(() => {
     vi.clearAllMocks();

     // Configure prisma mocks
     const db = require('@/lib/db');
     db.prisma.assetTag.findMany.mockResolvedValue([]);
     db.prisma.searchLog.findMany.mockResolvedValue([]);
     db.prisma.searchLog.create.mockResolvedValue({});
     db.vectorSearch.mockResolvedValue([/* mock results */]);
     db.logSearch.mockResolvedValue(undefined);
   });
   ```

3. **Remove direct prisma references** throughout file:
   ```typescript
   // CHANGE: prisma.assetTag.findMany.mockResolvedValue([])
   // TO: db.prisma.assetTag.findMany.mockResolvedValue([])
   // (where db = require('@/lib/db'))
   ```

4. **Test verification**:
   ```bash
   pnpm test __tests__/integration/search-flow.test.ts --run
   # Expected: 16/16 passing (currently 4/16)
   ```

**Affected Lines**: 11-14, 89, 328, 403, 450, 559, 620, 652, 698
**Time Estimate**: 20 minutes
**Priority**: P0 - Blocking

---

### Task 2: Fix upload-flow.test.ts Prisma Mocks (9 failures)

**File**: `__tests__/integration/upload-flow.test.ts`
**Failures**: 9/13 tests
**Error Pattern**: Same as Task 1

**Implementation Steps**:

1. Apply same mockPrisma() factory pattern as Task 1
2. Update mock configuration in beforeEach
3. Fix all prisma method calls throughout file
4. Verify with: `pnpm test __tests__/integration/upload-flow.test.ts --run`

**Expected Result**: 13/13 passing (currently 4/13)
**Time Estimate**: 20 minutes
**Priority**: P0 - Blocking

---

### Task 3: Fix asset-crud.test.ts Prisma Mocks (11 failures)

**File**: `__tests__/api/asset-crud.test.ts`
**Failures**: 11/15 tests
**Error Pattern**: `mockPrisma.asset.findUnique.mockResolvedValue is not a function`

**Implementation Steps**:

1. Check current mock setup (likely uses vi.mocked pattern)
2. Replace with mockPrisma() factory from test-helpers
3. Configure mocks in beforeEach for asset CRUD operations:
   ```typescript
   db.prisma.asset.findUnique.mockResolvedValue(mockAsset);
   db.prisma.asset.update.mockResolvedValue(mockAsset);
   db.prisma.asset.delete.mockResolvedValue(mockAsset);
   ```
4. Test verification: `pnpm test __tests__/api/asset-crud.test.ts --run`

**Expected Result**: 15/15 passing (currently 4/15)
**Time Estimate**: 15 minutes
**Priority**: P0 - Blocking

---

## P1: Distributed Queue Test Logic Fixes (5 failures)

### [TEST LOGIC FIX] Distributed Queue FIFO Order Test

**Root Cause**: Test assumes all 3 items process, but queue processes items one at a time. `normal-2` might be skipped due to async timing or queue implementation.

**File**: `__tests__/lib/distributed-queue.test.ts:60-75`
**Failure**: `expected ['normal-1', 'normal-3'] to deeply equal ['normal-1', 'normal-2', 'normal-3']`

**Investigation Required**:
1. Check if `processNext()` processes exactly one item or multiple
2. Verify queue state after each processNext() call
3. Determine if test expectation is wrong or implementation has bug

**Task 4: Debug and Fix FIFO Order Test**

**Steps**:
1. Add logging to understand actual behavior:
   ```typescript
   console.log('Queue size before:', queue.size());
   await queue.processNext();
   console.log('Processed:', processed, 'Queue size:', queue.size());
   ```

2. Run test in isolation: `pnpm test -t "should maintain FIFO order"`

3. **Hypothesis A**: processNext() doesn't process all items
   - **Fix**: Call processNext() in loop until queue empty
   - **Verification**: All items processed in order

4. **Hypothesis B**: Queue implementation has FIFO bug
   - **Fix**: Investigate PriorityQueue.dequeue() logic
   - **Verification**: Items dequeue in insertion order for same priority

**Time Estimate**: 30 minutes
**Priority**: P1 - Important

---

### Task 5: Fix Dead Letter Queue Tests (3 failures)

**Files**: Lines 113-180
**Failures**:
- "should move items to dead letter queue after max retries" - `expected 0 to be 1`
- "should not retry invalid errors" - `expected 0 to be 1`
- "should allow retrying dead letter items" - `expected 0 to be 1`

**Root Cause**: `metrics.dead` always returns 0, suggesting items aren't moving to dead letter queue.

**Investigation Steps**:
1. Check DistributedQueue.moveToDeadLetter() implementation
2. Verify maxRetries logic in retry handling
3. Confirm dead letter queue is actually populated

**Implementation**:
1. Add dead letter queue size check: `expect(queue.getDeadLetterQueue().length).toBe(1)`
2. If implementation is broken, fix moveToDeadLetter() logic
3. If test is wrong, update assertions to match actual behavior

**Time Estimate**: 45 minutes
**Priority**: P1 - Important

---

### Task 6: Fix Metrics Tracking Test

**File**: Line 211-223
**Failure**: `expected 1 to be 2` - successCount tracking

**Root Cause**: Metrics not incrementing correctly or test expectations wrong.

**Steps**:
1. Verify both test items actually succeed (check executor mock)
2. Add logging: `console.log('Metrics:', queue.getMetrics())`
3. Check if metrics.successCount increments in DistributedQueue
4. Fix either metrics logic or test expectation

**Time Estimate**: 15 minutes
**Priority**: P1 - Important

---

## P2: Embedding Generation Timing Fixes (2 failures)

### Task 7: Fix Exponential Backoff Retry Test

**File**: `__tests__/embeddings/embedding-generation.test.ts:252-284`
**Failure**: `expected ['completed'] to include 'retry'`
**Timeout**: 5012ms (indicates slow/hanging test)

**Root Cause**: Event subscription doesn't capture 'retry' events, only captures 'completed'.

**Investigation**:
1. Check EmbeddingQueueManager event emission
2. Verify retry events are actually emitted during failures
3. Confirm event subscription timing (subscribe before or after retry?)

**Fix Options**:

**Option A: Subscribe earlier to catch retry events**
```typescript
const events: QueueEvent[] = [];
const unsubscribe = embeddingQueue.subscribe((event) => {
  events.push(event);
});

// Then trigger failure and wait
```

**Option B: Use waitForQueueEvent for specific retry event**
```typescript
await waitForQueueEvent(
  embeddingQueue,
  (event) => event.type === 'retry',
  10000  // Longer timeout for retries
);
```

**Time Estimate**: 30 minutes
**Priority**: P2 - Optional

---

### Task 8: Fix Network Recovery Test Timeout

**File**: `__tests__/embeddings/embedding-generation.test.ts:436-474`
**Failure**: `Timeout waiting for queue event after 5000ms`
**Timeout**: 6007ms

**Root Cause**: Queue doesn't resume processing after mock network recovery, or event never fires.

**Steps**:
1. Verify network error simulation actually pauses queue
2. Check if "online" event listener is set up in test
3. Confirm queue.start() is called after recovery
4. Increase timeout if operation legitimately takes longer

**Fix**:
```typescript
// Ensure queue starts processing after recovery
Object.defineProperty(navigator, 'onLine', { value: true });
window.dispatchEvent(new Event('online'));
embeddingQueue.start(); // Explicitly start if needed

await waitForQueueEvent(
  embeddingQueue,
  (event) => event.type === 'completed',
  10000 // Increase timeout
);
```

**Time Estimate**: 20 minutes
**Priority**: P2 - Optional

---

## P3: Search API Tests (6 failures)

### Task 9: Fix Search API Prisma Mock Issues

**File**: `__tests__/api/search.test.ts`
**Failures**: 6/15 tests
**Error Pattern**: Same prisma mocking issue as P0 tasks

**Steps**:
1. Apply mockPrisma() factory pattern
2. Configure search-specific mocks:
   ```typescript
   db.prisma.searchLog.findMany.mockResolvedValue([]);
   db.prisma.searchLog.groupBy.mockResolvedValue([]);
   db.vectorSearch.mockResolvedValue([/* mock results */]);
   ```
3. Test: `pnpm test __tests__/api/search.test.ts --run`

**Expected Result**: 15/15 passing (currently 9/15)
**Time Estimate**: 15 minutes
**Priority**: P3 - Optional

---

## P4: Batch Upload Concurrency (1 failure)

### Task 10: Fix Batch Upload Concurrency Test

**File**: `__tests__/e2e/batch-upload.spec.ts`
**Failure**: 1/10 tests
**Test**: "should handle concurrent uploads efficiently"
**Timeout**: 255ms (suggests slow operation)

**Investigation**:
1. Check expected vs actual concurrency limit
2. Verify upload throttling logic
3. Confirm test timeout is reasonable

**Steps**:
1. Run test in isolation with verbose logging
2. Check if concurrency limit is correctly enforced
3. Adjust test expectations or increase timeout if needed

**Time Estimate**: 15 minutes
**Priority**: P4 - Low

---

## Summary & Execution Strategy

### Task Prioritization

**Phase 1: Critical Infrastructure** (60 minutes)
- Task 1: search-flow.test.ts Prisma mocks
- Task 2: upload-flow.test.ts Prisma mocks
- Task 3: asset-crud.test.ts Prisma mocks
- **Impact**: Fixes 32/66 failures (48%)

**Phase 2: Queue Logic** (90 minutes)
- Task 4: FIFO order debugging
- Task 5: Dead letter queue fixes
- Task 6: Metrics tracking
- **Impact**: Fixes 5/66 failures (8%)

**Phase 3: Optional Improvements** (80 minutes)
- Tasks 7-10: Embedding, search, batch upload
- **Impact**: Fixes remaining 29/66 failures (44%)

### Success Metrics

**Minimum Viable** (Merge Ready):
- ✅ P0 tasks complete: 364/398 passing (91%)
- ✅ No infrastructure blocking issues
- ✅ All critical paths tested

**Ideal Target**:
- ✅ All phases complete: 398/398 passing (100%)
- ✅ Robust, maintainable test suite
- ✅ Fast execution (<60s total)

### Testing After Each Phase

```bash
# After P0:
pnpm test __tests__/integration/ __tests__/api/asset-crud.test.ts --run

# After P1:
pnpm test __tests__/lib/distributed-queue.test.ts --run

# Full suite:
pnpm test --run
```

---

## Notes & Learnings

### Why Tests Failed
1. **Mock Infrastructure**: vi.mocked() doesn't create nested mocks automatically
2. **Test Expectations**: Some tests written before implementation was finalized
3. **Timing Issues**: Async event capture requires proper subscription setup
4. **Documentation Gap**: Mocking patterns not documented in test-helpers.ts

### Preventing Future Failures
1. **Document Mocking Patterns**: Add examples to test-helpers.ts
2. **Mock Validation**: Create helper to validate mock structure
3. **Event Testing**: Use waitForQueueEvent consistently
4. **CI Fast-Fail**: Run tests before expensive build steps

### Technical Debt Created
- None - all changes are test-only fixes
- Opportunity to refactor mockPrisma() for better ergonomics
- Consider creating `setupPrismaMocks()` helper for common patterns
