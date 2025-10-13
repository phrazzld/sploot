# TODO - Pre-Merge Critical Fixes

> **Blocking Issues**: These 3 P1 bugs MUST be fixed before merging feature/bulk-upload-optimization.
> **Source**: AI code review comments on PR (chatgpt-codex-connector bot)
> **Validated**: All issues confirmed legitimate through code analysis

---

## 🔴 P1: Serverless Function Timeout Bug

**Issue**: Module-level `setInterval` in processing-stats route keeps event loop alive, preventing serverless function from terminating cleanly. Causes 60s timeout on every request after first invocation.

**File**: `app/api/processing-stats/route.ts`

**Root Cause**:
- Lines 25-33 register a `setInterval(() => { cache cleanup }, 60000)` at module load time
- In Vercel/Next.js serverless functions, module loads on first request and stays loaded
- Interval keeps event loop open indefinitely, function never completes
- Request hangs until 60s timeout, wastes compute, leaks execution environments

**Technical Context**:
- Cache purpose: Store stats for 5s TTL per user to avoid expensive DB queries
- Cleanup purpose: Remove entries older than 1 minute to prevent unbounded memory growth
- Current approach: setInterval runs every 60s to sweep stale entries
- Why this fails: Serverless functions must terminate when request completes; intervals prevent this

### Tasks:

- [~] **Remove module-level setInterval cleanup** (`app/api/processing-stats/route.ts:25-33`)
  - Delete lines 25-33 entirely (the setInterval block)
  - Keep `statsCache` Map and interface definitions (lines 6-24)
  - **Rationale**: setInterval is incompatible with serverless execution model

- [~] **Add inline cleanup during cache access** (`app/api/processing-stats/route.ts:68-77`)
  - After line 69 (`const cached = statsCache.get(userId);`), add cleanup logic:
    ```typescript
    // Clean up stale entries inline (serverless-compatible)
    const now = Date.now();
    for (const [key, value] of statsCache.entries()) {
      if (now - value.timestamp > 60000) { // Remove entries older than 1 minute
        statsCache.delete(key);
      }
    }
    ```
  - **Rationale**: Cleanup happens during request processing, no background interval needed
  - **Performance**: O(n) where n = number of cached users, acceptable for <100 users
  - **Alternative**: Could track lastCleanup timestamp and only run every 60s, but premature optimization

- [ ] **Test serverless behavior locally** (`pnpm dev`)
  - Start dev server: `pnpm dev`
  - Make 5 requests to `/api/processing-stats` with 10s gaps
  - Verify no timeout warnings in console
  - Verify cache entries are cleaned up (add debug log showing cache size)
  - **Expected**: Requests complete in <500ms, cache size stays bounded

- [ ] **Verify production behavior after deploy** (Vercel deployment)
  - Deploy to preview environment
  - Monitor function execution logs in Vercel dashboard
  - Look for "Function duration" in logs - should be <1s, not 60s timeout
  - Check "Invocation details" → "Execution state" - should show "Completed", not "Timeout"
  - **Success criteria**: No timeouts, execution time <1s

---

## 🔴 P2: Image Processing Retry Off-by-One Bug

**Issue**: Assets that reach exactly `MAX_RETRIES` (3 attempts) are excluded from cron query but still have `processingNextRetry` scheduled. They never get picked up again to be marked as permanently failed. Assets stuck with `processed=false` forever.

**File**: `app/api/cron/process-images/route.ts`

**Root Cause**:
- Line 58-59: Query filters `processingRetryCount: { lt: MAX_RETRIES }` (less than)
- MAX_RETRIES = 3
- Retry count sequence:
  1. Attempt 1: retryCount=0, fails → increment to 1, schedule retry
  2. Attempt 2: retryCount=1, fails → increment to 2, schedule retry
  3. Attempt 3: retryCount=2, fails → increment to 3, schedule retry
  4. **Bug**: retryCount=3, excluded by `lt: 3`, never picked up again
- Lines 216-226 contain logic to mark as permanently failed when `calculateNextRetry()` returns `null`
- But this logic never runs because assets with retryCount=3 are excluded from query

**Technical Context**:
- `calculateNextRetry(retryCount, RETRY_DELAYS_MS)` returns `null` when `retryCount >= RETRY_DELAYS_MS.length`
- RETRY_DELAYS_MS = [60000, 300000, 900000] (length = 3)
- When retryCount=2 (third attempt), calculateNextRetry(2, [...]) checks `2 >= 3`? No, so returns Date
- This creates the off-by-one: we need retryCount=3 to get `null` back, but query excludes retryCount=3

**Impact**:
- Failed assets accumulate in database with `processed=false`, `processingRetryCount=3`, `processingNextRetry` set to future date
- Dashboard shows them as "processing" but they'll never complete
- Manual intervention required to fix stuck assets

### Tasks:

- [ ] **Fix retry count filter in findMany query** (`app/api/cron/process-images/route.ts:54-89`)
  - Line 58-59: Change `processingRetryCount: { lt: MAX_RETRIES }` → `lte: MAX_RETRIES`
  - **Before**: `lt: MAX_RETRIES` (retryCount < 3, excludes 3)
  - **After**: `lte: MAX_RETRIES` (retryCount <= 3, includes 3)
  - **Rationale**: Allow assets at MAX_RETRIES to be picked up one final time for permanent failure marking
  - **This allows**: When retryCount=3, asset is picked up, calculateNextRetry(3, [60k,300k,900k]) returns null (3 >= 3), lines 216-226 mark as permanently failed

- [ ] **Add comment explaining retry logic** (`app/api/cron/process-images/route.ts:58`)
  - Add above line 58:
    ```typescript
    // Use lte (<=) not lt (<) to allow final pickup when retryCount === MAX_RETRIES
    // This is necessary to mark assets as permanently failed via calculateNextRetry() → null logic
    ```
  - **Rationale**: Prevent future confusion about why we use `lte` instead of `lt`

- [ ] **Verify retry logic with calculateNextRetry** (`lib/cron-utils.ts:67-79`)
  - Read calculateNextRetry function to confirm behavior:
    - `if (retryCount >= maxRetries) return null` (line 73)
    - maxRetries = RETRY_DELAYS_MS.length = 3
    - calculateNextRetry(3, [...]) returns null ✓
  - **Confirm**: Our fix (using `lte: MAX_RETRIES`) will pick up retryCount=3, call calculateNextRetry(3, ...), get null back, trigger permanent failure logic
  - **No code changes needed**: Just verification step

- [ ] **Test retry exhaustion scenario** (Integration test or manual test)
  - Create test asset with `processingRetryCount=2`
  - Simulate cron job pickup
  - Force processing failure (e.g., invalid blobUrl or throw error)
  - Verify asset updated with: `processingRetryCount=3`, `processingNextRetry=null`, `processingError` contains "Max retries exceeded"
  - **Expected**: Asset marked as permanently failed, not stuck in limbo
  - **Test file**: Consider adding to `__tests__/api/cron/process-images.test.ts` (currently doesn't exist, per BACKLOG.md)

- [ ] **Check for existing stuck assets in production** (Database query)
  - Run query to find affected assets:
    ```sql
    SELECT id, pathname, processingRetryCount, processingNextRetry, processingError
    FROM "Asset"
    WHERE "deletedAt" IS NULL
      AND processed = false
      AND "processingRetryCount" >= 3
      AND "processingNextRetry" IS NOT NULL
    ORDER BY "createdAt" ASC;
    ```
  - If found, manually mark as failed:
    ```sql
    UPDATE "Asset"
    SET "processingError" = 'Max retries exceeded (manual fix)',
        "processingNextRetry" = NULL
    WHERE "processingRetryCount" >= 3 AND processed = false;
    ```
  - **Document count**: Record how many assets were stuck (include in PR description)

---

## 🔴 P3: Embedding Retry Off-by-One Bug

**Issue**: Identical to P2 but for embedding processing. Assets that reach exactly `MAX_RETRIES` (5 attempts) are excluded from cron query, never marked as permanently failed. Assets stuck with `embedded=false` forever.

**File**: `app/api/cron/process-embeddings/route.ts`

**Root Cause**:
- Line 60-61: Query filters `embeddingRetryCount: { lt: MAX_RETRIES }` (less than)
- MAX_RETRIES = 5
- Same off-by-one logic as P2:
  - Attempts 1-5: retryCount 0→1→2→3→4→5
  - After 5th attempt fails: retryCount=5, excluded by `lt: 5`
  - Permanent failure logic (lines 214-225) never executes
- RETRY_DELAYS_MS = [60s, 5min, 15min, 1hr, 6hr] (length = 5)

**Impact**:
- Failed embedding generation accumulates in database
- Assets show as "processing" but embeddings never complete
- Search functionality degraded (can't find assets without embeddings)

### Tasks:

- [ ] **Fix retry count filter in findMany query** (`app/api/cron/process-embeddings/route.ts:55-90`)
  - Line 60-61: Change `embeddingRetryCount: { lt: MAX_RETRIES }` → `lte: MAX_RETRIES`
  - **Before**: `lt: MAX_RETRIES` (retryCount < 5, excludes 5)
  - **After**: `lte: MAX_RETRIES` (retryCount <= 5, includes 5)
  - **Rationale**: Same as P2 - allow final pickup for permanent failure marking

- [ ] **Add comment explaining retry logic** (`app/api/cron/process-embeddings/route.ts:60`)
  - Add above line 60:
    ```typescript
    // Use lte (<=) not lt (<) to allow final pickup when retryCount === MAX_RETRIES
    // This is necessary to mark assets as permanently failed via calculateNextRetry() → null logic
    ```
  - **Rationale**: Consistency with P2 fix, prevent future confusion

- [ ] **Verify retry logic with calculateNextRetry** (`lib/cron-utils.ts:67-79`)
  - Same verification as P2, but with embedding parameters:
    - calculateNextRetry(5, [60k,300k,900k,3.6M,21.6M]) returns null (5 >= 5) ✓
  - **Confirm**: Fix will pick up retryCount=5, get null back, trigger permanent failure logic
  - **No code changes needed**: Just verification step

- [ ] **Test retry exhaustion scenario** (Integration test or manual test)
  - Create test asset with `embeddingRetryCount=4`, `processed=true`, `embedded=false`
  - Simulate cron job pickup
  - Force embedding failure (e.g., mock Replicate API error)
  - Verify asset updated with: `embeddingRetryCount=5`, `embeddingNextRetry=null`, `embeddingError` contains "Max retries exceeded"
  - **Expected**: Asset marked as permanently failed, not stuck in limbo
  - **Test file**: Consider adding to `__tests__/api/cron/process-embeddings.test.ts` (already has excellent test coverage, 19 tests)

- [ ] **Check for existing stuck assets in production** (Database query)
  - Run query to find affected assets:
    ```sql
    SELECT id, pathname, embeddingRetryCount, embeddingNextRetry, embeddingError
    FROM "Asset"
    WHERE "deletedAt" IS NULL
      AND processed = true
      AND embedded = false
      AND "embeddingRetryCount" >= 5
      AND "embeddingNextRetry" IS NOT NULL
    ORDER BY "createdAt" ASC;
    ```
  - If found, manually mark as failed:
    ```sql
    UPDATE "Asset"
    SET "embeddingError" = 'Max retries exceeded (manual fix)',
        "embeddingNextRetry" = NULL
    WHERE "embeddingRetryCount" >= 5 AND embedded = false;
    ```
  - **Document count**: Record how many assets were stuck (include in PR description)

---

## 📋 Pre-Merge Checklist

After completing all fixes:

- [ ] **Run full test suite** (`pnpm test`)
  - Verify no regressions
  - All existing tests should pass
  - **Expected**: 0 failures (note: some tests were removed in commit 110daf5, this is intentional)

- [ ] **Run type checking** (`pnpm type-check`)
  - Verify no TypeScript errors introduced
  - **Expected**: 0 errors

- [ ] **Run linter** (`pnpm lint`)
  - Verify code style compliance
  - **Expected**: 0 errors

- [ ] **Build for production** (`pnpm build`)
  - Verify build succeeds without warnings
  - **Expected**: Successful build, no errors

- [ ] **Manual smoke test on dev server** (`pnpm dev`)
  - Upload 5 test images
  - Check `/api/processing-stats` shows correct queue depth
  - Wait for cron jobs to process (or manually trigger with curl + CRON_SECRET)
  - Verify all images reach `processed=true, embedded=true` state
  - **Expected**: No stuck assets, all complete successfully

- [ ] **Deploy to preview environment** (Vercel)
  - Create preview deployment
  - Run same smoke test as above
  - Monitor Vercel function logs for timeouts or errors
  - **Expected**: Clean logs, no timeouts, <1s function duration

- [ ] **Update PR description**
  - Document the 3 bugs fixed
  - Include count of stuck assets fixed in production (from database queries)
  - Reference code review comments that identified issues
  - Add "Fixes 3 critical P1 bugs" to PR title

- [ ] **Request re-review**
  - Tag reviewers who identified these issues
  - Confirm all concerns addressed
  - **Ready to merge**: Only after review approval

---

## 📚 Reference Links

- **AI Code Review Comments**: [PR #X comments](link-to-pr-comments)
- **setInterval in Serverless**: [Vercel Docs - Function Execution](https://vercel.com/docs/functions/execution)
- **Retry Logic Pattern**: `lib/cron-utils.ts:67-79` (calculateNextRetry function)
- **Related Tests**: `__tests__/api/cron/process-embeddings.test.ts` (19 tests, good template)
- **Backlog Items**: See BACKLOG.md for deferred improvements (these are NOT blocking)

---

**Last Updated**: 2025-10-13
**Status**: 🔴 BLOCKING - Must complete before merge
**Estimated Effort**: ~3-4 hours (2 hours for fixes + testing, 1-2 hours for validation + cleanup)
