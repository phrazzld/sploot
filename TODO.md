# TODO: PR #7 Feedback - Cache Consolidation Improvements

**Context:** Addressing code review feedback from PR #7 before merge. All fixes preserve existing functionality while improving type safety, correctness, and future-proofing.

---

## Critical Fixes (Merge-Blocking)

- [x] **Fix SearchFilters type safety** (`lib/cache/types.ts:67`)
  - **Issue:** Using `Record<string, any>` defeats TypeScript type safety
  - **Current:** `export type SearchFilters = Record<string, any>;`
  - **Required:** Define proper interface based on actual filter properties
  - **Properties to include:** `limit: number`, `threshold: number`, `mimeTypes?: string[]`, `dateFrom?: string`, `dateTo?: string`, `favorites?: boolean`, `minWidth?: number`, `minHeight?: number`
  - **Add:** `[key: string]: unknown;` for extensibility
  - **Success criteria:** No `any` types, all filter properties properly typed, TypeScript compilation passes

- [~] **Fix cache key collision risk** (`lib/cache/CacheService.ts:29-30`)
  - **Issue:** `hashString(query + filters)` can cause collisions ("cat"+"meme" = "catm"+"eme")
  - **Current:** ```typescript
    SEARCH_RESULTS: (userId: string, query: string, filters: string) =>
      `search:${userId}:${hashString(query + filters)}`,
    ```
  - **Required:** Use delimited hashing to prevent collisions
  - **Solution:** ```typescript
    SEARCH_RESULTS: (userId: string, query: string, filters: string) =>
      `search:${userId}:${hashString(query)}:${hashString(filters)}`,
    ```
  - **Success criteria:** Different query+filter combinations always produce unique cache keys

---

## High Priority Improvements

- [x] **Add error handling for future backend compatibility**
  - **Files:** `lib/cache/CacheService.ts`, `lib/cache/MemoryBackend.ts`
  - **Status:** COMPLETED (commit f9f71d5)
  - **Implementation:** All backend operations wrapped in try-catch with graceful fallback
  - **Result:** Prepared for Redis/KV migration with proper error handling

- [x] **Fix stats tracking race condition** (`lib/cache/CacheService.ts:63-72`)
  - **Status:** COMPLETED (commit b93e82a)
  - **Solution:** Moved `totalRequests++` into `incrementHit()` and `incrementMiss()` methods
  - **Result:** Stats always consistent, hit + miss = totalRequests atomically

- [x] **Optimize cache invalidation to use namespace-specific clearing**
  - **Files:** `app/api/assets/[id]/route.ts` (3 locations), `app/api/assets/route.ts` (1 location)
  - **Status:** COMPLETED (commit af237a8)
  - **Implementation:** Changed from `cache.clear()` to `cache.clear('assets')` + `cache.clear('search')`
  - **Locations updated:**
    - `app/api/assets/[id]/route.ts:186` (favorite toggle)
    - `app/api/assets/[id]/route.ts:274` (permanent delete)
    - `app/api/assets/[id]/route.ts:291` (soft delete)
    - `app/api/assets/route.ts:134` (asset creation)
  - **Result:** Text/image embeddings preserved, only affected namespaces cleared

  **Note on Codex P1 Feedback:**
  - Codex bot raised valid concern: namespace clearing affects ALL users, not just current user
  - **Design Decision:** Acceptable for single-user scope (per CLAUDE.md: "Single-user private library")
  - **Future Work:** User-scoped invalidation required for multi-user (see BACKLOG.md)
  - **References:** 4 Codex inline comments on PR #7 (app/api/assets/route.ts:134, app/api/assets/[id]/route.ts:186,274,291)

---

## Verification

After completing all tasks:

- [ ] Run full test suite: `pnpm test` - all 285 tests passing
- [ ] Run type checking: `pnpm type-check` - no TypeScript errors
- [ ] Verify no regressions in cache behavior
- [ ] Update PR with summary of changes
- [ ] Request re-review from PR author
