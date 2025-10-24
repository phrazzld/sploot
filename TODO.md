# TODO: PR #7 Feedback - Cache Consolidation Improvements

**Context:** Addressing code review feedback from PR #7 before merge. All fixes preserve existing functionality while improving type safety, correctness, and future-proofing.

---

## Critical Fixes (Merge-Blocking)

- [ ] **Fix SearchFilters type safety** (`lib/cache/types.ts:67`)
  - **Issue:** Using `Record<string, any>` defeats TypeScript type safety
  - **Current:** `export type SearchFilters = Record<string, any>;`
  - **Required:** Define proper interface based on actual filter properties
  - **Properties to include:** `limit: number`, `threshold: number`, `mimeTypes?: string[]`, `dateFrom?: string`, `dateTo?: string`, `favorites?: boolean`, `minWidth?: number`, `minHeight?: number`
  - **Add:** `[key: string]: unknown;` for extensibility
  - **Success criteria:** No `any` types, all filter properties properly typed, TypeScript compilation passes

- [ ] **Fix cache key collision risk** (`lib/cache/CacheService.ts:29-30`)
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

- [ ] **Add error handling for future backend compatibility**
  - **Files:** `lib/cache/CacheService.ts`, `lib/cache/MemoryBackend.ts`
  - **Issue:** No try-catch blocks; future Redis/KV backends could throw network errors
  - **Implementation:**
    - Wrap all `backend.get()`, `backend.set()`, `backend.delete()`, `backend.clear()` calls in try-catch
    - On error: log with context (key, operation, error message)
    - Return graceful fallback: `null` for get, `void` for set/delete/clear
    - Use console.error with structured logging format: `[CacheService] Operation failed: { method, key, error }`
  - **Example:**
    ```typescript
    async getTextEmbedding(text: string): Promise<number[] | null> {
      try {
        const key = CACHE_KEYS.TEXT_EMBEDDING(text);
        this.stats.totalRequests++;
        const embedding = await this.backend.get<number[]>(key);
        if (embedding) {
          this.incrementHit();
          return embedding;
        }
        this.incrementMiss();
        return null;
      } catch (error) {
        console.error('[CacheService] getTextEmbedding failed:', { text: text.substring(0, 50), error });
        this.incrementMiss(); // Count as miss
        return null; // Graceful degradation
      }
    }
    ```
  - **Success criteria:** All backend operations wrapped, errors logged, graceful degradation verified

- [ ] **Fix stats tracking race condition** (`lib/cache/CacheService.ts:63-72`)
  - **Issue:** `totalRequests++` incremented before async operation, but hit/miss after
  - **Impact:** Temporary inconsistency under concurrent load
  - **Current:** `totalRequests` incremented in each method, hit/miss in private methods
  - **Solution:** Move `totalRequests++` into `incrementHit()` and `incrementMiss()`
  - **Changes:**
    - Remove `this.stats.totalRequests++` from all public methods (6 locations)
    - Add `this.stats.totalRequests++` to `incrementHit()` method
    - Add `this.stats.totalRequests++` to `incrementMiss()` method
  - **Success criteria:** Stats always consistent, hit + miss = totalRequests at any point in time

- [ ] **Optimize cache invalidation to use namespace-specific clearing**
  - **Files:** `app/api/assets/[id]/route.ts` (3 locations), `app/api/assets/route.ts` (1 location)
  - **Issue:** Using global `cache.clear()` clears expensive embeddings unnecessarily
  - **Current:** `await cache.clear();` after favorite toggle, soft delete, permanent delete, asset creation
  - **Solution:** Clear only affected namespaces
    ```typescript
    // Clear only asset and search caches (preserve embeddings)
    await cache.clear('assets');
    await cache.clear('search');
    ```
  - **Rationale:** Text/image embeddings don't change when assets are favorited/deleted
  - **Locations to update:**
    - `app/api/assets/[id]/route.ts:183` (favorite toggle)
    - `app/api/assets/[id]/route.ts:270` (permanent delete)
    - `app/api/assets/[id]/route.ts:285` (soft delete)
    - `app/api/assets/route.ts` (check for invalidation after asset list operations)
  - **Success criteria:** Only necessary cache namespaces cleared, embeddings preserved

---

## Verification

After completing all tasks:

- [ ] Run full test suite: `pnpm test` - all 285 tests passing
- [ ] Run type checking: `pnpm type-check` - no TypeScript errors
- [ ] Verify no regressions in cache behavior
- [ ] Update PR with summary of changes
- [ ] Request re-review from PR author
