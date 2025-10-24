# TODO: Cache Consolidation

**Objective:** Consolidate 3 duplicate cache implementations (cache.ts, multi-layer-cache.ts, search-cache.ts) into single unified CacheService with strategy pattern for future backend swapping.

**Impact:** 872 lines → 343 lines (61% reduction), single source of truth, Redis/KV migration becomes trivial strategy swap

**Current State:** 4 cache files with ~80% overlapping functionality, identical key patterns, duplicate TTL configurations
- `lib/cache.ts` (290 lines) - legacy singleton, appears unused
- `lib/multi-layer-cache.ts` (372 lines) - primary implementation, 9 consumers
- `lib/search-cache.ts` (210 lines) - exported but no active consumers
- `lib/slug-cache.ts` (93 lines) - **KEEP SEPARATE** - three-tier specialized cache for share slugs

**Architecture Decision:** Memory-only (LRUCache) with strategy pattern for future KV/Redis swap. Single user + 3k memes = no distributed cache needed yet.

---

## Phase 1: Create Unified Cache Infrastructure

### Core Implementation

- [x] Create `lib/cache/` directory for new cache module organization

- [x] Create `lib/cache/types.ts` with cache interfaces and types
  - Define `ICacheBackend` interface with methods: `get<T>(key: string): Promise<T | null>`, `set<T>(key: string, value: T, ttl?: number): Promise<void>`, `delete(key: string): Promise<void>`, `clear(namespace?: string): Promise<void>`
  - Define `CacheStats` interface with fields: `hits: number`, `misses: number`, `totalRequests: number`, `hitRate: number`, `lastReset: Date`
  - Define `SearchFilters` type for search result caching (should match existing filters from multi-layer-cache.ts)
  - Success criteria: Types support both current memory backend and future Redis/KV backends without modification

- [x] Create `lib/cache/MemoryBackend.ts` implementing ICacheBackend with LRUCache
  - Import `LRUCache` from 'lru-cache' package
  - Create separate LRUCache instances for: text embeddings (max: 100, ttl: 15min), image embeddings (max: 500, ttl: 24hr), search results (max: 50, ttl: 5min), asset metadata (max: 200, ttl: 30min)
  - Implement `get<T>(key)` method that checks appropriate LRU cache based on key prefix (`txt:`, `img:`, `search:`, `assets:`)
  - Implement `set<T>(key, value, ttl?)` method that stores in appropriate LRU cache, respecting custom TTL if provided, otherwise using default TTL for that namespace
  - Implement `delete(key)` method that removes from appropriate LRU cache
  - Implement `clear(namespace?)` method that clears specific namespace cache if provided, or all caches if namespace is undefined
  - Add private method `getCacheForKey(key: string)` that returns correct LRU cache based on key prefix
  - Preserve exact TTL values from multi-layer-cache.ts: TEXT_EMBEDDING: 900000ms, IMAGE_EMBEDDING: 86400000ms, SEARCH_RESULTS: 300000ms, ASSET_METADATA: 1800000ms
  - Success criteria: All LRU caches properly scoped by namespace, TTL values match existing implementation exactly

- [x] Create `lib/cache/CacheService.ts` as main deep module with domain-specific interface
  - Import `ICacheBackend`, `CacheStats`, `SearchFilters` from './types'
  - Import `MemoryBackend` from './MemoryBackend'
  - Copy `hashString` function from `lib/multi-layer-cache.ts` (lines 52-59) - uses simple checksum algorithm for key generation
  - Define private `CACHE_KEYS` object with generators matching multi-layer-cache.ts exactly: `TEXT_EMBEDDING: (text: string) => 'txt:${hashString(text)}'`, `IMAGE_EMBEDDING: (checksum: string) => 'img:${checksum}'`, `SEARCH_RESULTS: (userId: string, query: string, filters: string) => 'search:${userId}:${hashString(query + filters)}'`, `ASSET_LIST: (userId: string, params: string) => 'assets:${userId}:${hashString(params)}'`
  - Create `CacheService` class with private `backend: ICacheBackend` field, private `stats: CacheStats` field for hit/miss tracking
  - Implement constructor that accepts optional `ICacheBackend` parameter, defaults to `new MemoryBackend()`
  - Implement `async getTextEmbedding(text: string): Promise<number[] | null>` - generates key using CACHE_KEYS.TEXT_EMBEDDING, calls backend.get, increments stats.hits or stats.misses, returns embedding or null
  - Implement `async setTextEmbedding(text: string, embedding: number[]): Promise<void>` - generates key, calls backend.set with default TEXT_EMBEDDING TTL
  - Implement `async getImageEmbedding(checksum: string): Promise<number[] | null>` - generates key using CACHE_KEYS.IMAGE_EMBEDDING, tracks stats, returns embedding or null
  - Implement `async setImageEmbedding(checksum: string, embedding: number[]): Promise<void>` - generates key, calls backend.set with default IMAGE_EMBEDDING TTL
  - Implement `async getSearchResults(userId: string, query: string, filters: SearchFilters): Promise<any[] | null>` - serializes filters to JSON string, generates key using CACHE_KEYS.SEARCH_RESULTS, tracks stats, returns results or null
  - Implement `async setSearchResults(userId: string, query: string, filters: SearchFilters, results: any[]): Promise<void>` - serializes filters, generates key, stores results with SEARCH_RESULTS TTL
  - Implement `async invalidate(key: string): Promise<void>` - calls backend.delete for explicit cache invalidation
  - Implement `async clear(namespace?: string): Promise<void>` - calls backend.clear, optionally scoped to namespace
  - Implement `getStats(): CacheStats` - returns copy of current stats object with calculated hitRate
  - Implement `resetStats(): void` - resets stats counters to zero, updates lastReset timestamp
  - Add private method `incrementHit()` and `incrementMiss()` to update stats consistently
  - Success criteria: Interface exposes only domain methods (embeddings, search), completely hides key generation, namespacing, and backend details from consumers

- [x] Create `lib/cache/index.ts` barrel export and singleton management
  - Export all types from './types'
  - Export `CacheService` class from './CacheService'
  - Export `MemoryBackend` class from './MemoryBackend'
  - Create singleton instance: `let cacheServiceInstance: CacheService | null = null`
  - Export `getCacheService(): CacheService` function that lazy-initializes singleton with MemoryBackend on first call, returns existing instance on subsequent calls
  - Export `createCacheService(backend?: ICacheBackend): CacheService` factory function for testing with custom backends
  - Add JSDoc comments explaining: "Singleton instance for application-wide caching. Uses memory-backed LRU cache by default. Future migration to Redis/Vercel KV requires only swapping the backend strategy."
  - Success criteria: Consumers get consistent singleton instance, test files can inject mock backends via factory

---

## Phase 2: Migrate Consumers to Unified CacheService

### API Route Migrations

- [x] Update `app/api/search/route.ts` to use new CacheService
  - Replace import `import { createMultiLayerCache, getMultiLayerCache } from '@/lib/multi-layer-cache'` with `import { getCacheService } from '@/lib/cache'`
  - Replace lines 52-53 initialization `const multiCache = getMultiLayerCache() || createMultiLayerCache()` with `const cache = getCacheService()`
  - Replace lines 56-61 `await multiCache.getSearchResults(userId, query, { limit: effectiveLimit, threshold })` with `await cache.getSearchResults(userId, query, { limit: effectiveLimit, threshold })`
  - Remove null check on line 55 `if (multiCache)` - getCacheService() always returns valid instance
  - Update cache.set call around line 150-160 to use `await cache.setSearchResults(userId, query, { limit: effectiveLimit, threshold }, formattedResults)`
  - Preserve all existing search logic, threshold handling, and response formatting - only change cache access method
  - Success criteria: Search results still cached with 5min TTL, cache hits return immediately, cache misses perform vector search and populate cache

- [x] Update `app/api/search/advanced/route.ts` to use new CacheService
  - Replace import statement from multi-layer-cache to `import { getCacheService } from '@/lib/cache'`
  - Replace cache initialization (likely around line 40-60) with `const cache = getCacheService()`
  - Update getSearchResults call to use cache.getSearchResults with appropriate filters parameter including all advanced search filters (mimeTypes, tags, dateRange, favorites, etc.)
  - Update setSearchResults call after search execution to cache results with all filter parameters
  - Ensure filters object is serializable (no functions, circular refs) for JSON stringification in key generation
  - Success criteria: Advanced search caching preserves all filter parameters in cache key, different filter combinations create distinct cache entries

- [x] Update `app/api/assets/route.ts` to use new CacheService
  - Replace multi-layer-cache import with `import { getCacheService } from '@/lib/cache'`
  - Locate asset list caching logic (likely in GET handler around line 50-100)
  - Replace cache initialization with `const cache = getCacheService()`
  - Note: This file likely doesn't use text/image embedding methods, might use generic get/set - check actual usage pattern in file
  - If using asset list caching, preserve existing cache key pattern `assets:${userId}:${hashString(params)}`
  - Update cache.get and cache.set calls to match new interface
  - Success criteria: Asset list responses still cached with 30min TTL, pagination parameters included in cache key

- [ ] Update `app/api/assets/[id]/route.ts` for single asset caching
  - Replace multi-layer-cache import with `import { getCacheService } from '@/lib/cache'`
  - Update cache access in asset detail endpoint (likely GET handler)
  - Replace cache initialization with `const cache = getCacheService()`
  - Preserve any asset metadata caching behavior
  - Success criteria: Individual asset fetches use cache when available, updates invalidate cached asset

- [ ] Update `app/api/cache/stats/route.ts` to expose new cache statistics
  - Replace multi-layer-cache import with `import { getCacheService } from '@/lib/cache'`
  - Replace cache.getStats() call with `getCacheService().getStats()`
  - Ensure response format matches existing API contract expected by frontend components
  - Map new CacheStats fields (hits, misses, hitRate, lastReset) to existing response structure
  - If multi-layer-cache returned additional fields (cache sizes, entry counts), add equivalent methods to CacheService or remove from API response
  - Success criteria: `/api/cache/stats` endpoint returns statistics compatible with `components/settings/cache-status.tsx` expectations

### Library and Service Migrations

- [ ] Update `lib/embeddings.ts` (ReplicateEmbeddingService) to use new cache
  - Replace line 2 import `import { createMultiLayerCache, getMultiLayerCache } from './multi-layer-cache'` with `import { getCacheService } from './cache'`
  - In `embedText` method (lines 54-67), replace line 58 `const cache = getMultiLayerCache() || createMultiLayerCache()` with `const cache = getCacheService()`
  - Replace line 59 `await cache.getTextEmbedding(query)` with `await cache.getTextEmbedding(query)` - interface unchanged, should work directly
  - Locate cache.set call after successful embedding generation (likely around line 90-110), replace with `await cache.setTextEmbedding(query, embedding)`
  - In `embedImage` method (likely lines 100-180), locate cache.getImageEmbedding call, replace with `await cache.getImageEmbedding(checksum)`
  - Locate cache.setImageEmbedding call after successful image embedding, replace with `await cache.setImageEmbedding(checksum, embedding)`
  - Remove any null checks for cache instance - getCacheService() always returns valid instance
  - Success criteria: Text embeddings cached with 15min TTL, image embeddings cached with 24hr TTL, same cache keys as before (txt:hash, img:checksum)

### Frontend Hook Migrations

- [ ] Update `hooks/use-assets.ts` custom React hook for asset caching
  - Locate any multi-layer-cache imports (may not exist if this is pure client-side)
  - If this hook uses server actions or API routes that access cache, no changes needed (caching happens server-side)
  - If this hook has client-side cache logic (uncommon for Next.js), evaluate if it should be removed in favor of server-side caching
  - Review file to confirm it only calls API routes, doesn't directly instantiate cache
  - Success criteria: Hook continues to work with cached API responses from server-side CacheService

- [ ] Update `components/settings/cache-status.tsx` component displaying cache statistics
  - Review component to identify cache stats data source (likely fetches from `/api/cache/stats`)
  - No code changes needed if component only consumes API endpoint
  - Verify component handles new CacheStats shape: `{ hits, misses, totalRequests, hitRate, lastReset }`
  - If component displays additional stats (cache sizes, entry counts) that are no longer available, either: (a) add equivalent methods to CacheService to expose LRU cache sizes, or (b) remove those UI elements
  - Check for any direct cache imports - should only use API endpoint
  - Success criteria: Cache status UI displays hit rate, total requests, and last reset time correctly

- [ ] Update `hooks/use-cache-management.ts` hook for cache management operations
  - Replace multi-layer-cache import with `import { getCacheService } from '@/lib/cache'` if server-side hook
  - If this hook provides cache clear/invalidate functionality, update to call new CacheService methods
  - Check if this is client-side hook that calls API endpoint for cache operations - if so, verify API endpoint updated
  - If hook has resetStats functionality, update to call `getCacheService().resetStats()`
  - If hook has clear cache functionality, update to call `getCacheService().clear(namespace?)`
  - Success criteria: Cache management UI actions (clear cache, reset stats) work with new implementation

---

## Phase 3: Cleanup and Test Updates

### Remove Consolidated Files

- [ ] Delete `lib/cache.ts` (290 lines, legacy singleton implementation)
  - Verify no remaining imports of this file: `git grep -n "from.*lib/cache'" --exclude-dir=node_modules --exclude-dir=.git`
  - Verify singleton `cacheService` instance from this file is not referenced anywhere
  - Delete file only after confirming all consumers migrated to new cache
  - Success criteria: Zero references to old cache.ts in codebase

- [ ] Delete `lib/multi-layer-cache.ts` (372 lines, primary implementation being replaced)
  - Verify no remaining imports: `git grep -n "multi-layer-cache" --exclude-dir=node_modules --exclude-dir=.git`
  - Confirm all 9 consumers updated to use new CacheService
  - Delete file only after migration complete and tests passing
  - Success criteria: Zero references to multi-layer-cache.ts in codebase

- [ ] Delete `lib/search-cache.ts` (210 lines, unused Map-based implementation)
  - Verify no imports: `git grep -n "search-cache" --exclude-dir=node_modules --exclude-dir=.git`
  - Confirm this file had no active consumers in current codebase
  - Delete file
  - Success criteria: Zero references to search-cache.ts in codebase

### Test Updates

- [ ] Update `__tests__/api/cache-stats.test.ts` for new CacheService
  - Update import: `import { getCacheService, createCacheService } from '@/lib/cache'`
  - Update mock setup: replace `vi.mock('@/lib/multi-layer-cache')` with appropriate mocking strategy
  - Update test that checks cache stats API response to expect new CacheStats shape
  - Create mock CacheService instance for tests using `createCacheService(mockBackend)`
  - Update assertions to check: `{ hits, misses, totalRequests, hitRate, lastReset }` fields
  - If tests checked for additional stats fields from old implementation, remove or update assertions
  - Success criteria: All cache stats tests passing with new implementation

- [ ] Create `__tests__/lib/cache/CacheService.test.ts` unit tests for new cache implementation
  - Test `getTextEmbedding` returns null on cache miss, increments miss counter
  - Test `setTextEmbedding` stores embedding, subsequent `getTextEmbedding` returns cached value and increments hit counter
  - Test `getImageEmbedding` with checksum returns null on miss, cached value on hit
  - Test `setImageEmbedding` stores and retrieves correctly
  - Test `getSearchResults` with same userId, query, and filters returns cached results
  - Test `getSearchResults` with different filters creates separate cache entry
  - Test cache key generation: same text generates same key, different text generates different key
  - Test stats tracking: hitRate calculated correctly as hits / totalRequests
  - Test `resetStats` zeros out counters and updates lastReset timestamp
  - Test `clear()` without namespace removes all cached entries
  - Test `clear(namespace)` removes only entries for specified namespace (if implemented)
  - Test TTL expiration: set embedding, wait for TTL expiry (mock time), verify cache miss (may require LRU cache mocking)
  - Success criteria: >80% code coverage for CacheService, all core caching behaviors verified

- [ ] Create `__tests__/lib/cache/MemoryBackend.test.ts` unit tests for backend implementation
  - Test `get` returns null for non-existent key
  - Test `set` then `get` returns stored value
  - Test `delete` removes key, subsequent get returns null
  - Test TTL: set value with custom TTL, verify it expires (may need to mock LRU cache or use real timeouts)
  - Test namespace routing: verify 'txt:' prefix uses text embeddings cache, 'img:' uses image cache, etc.
  - Test `clear()` removes all entries from all LRU caches
  - Test `clear(namespace)` removes only from specified namespace cache
  - Mock LRUCache to verify correct max sizes and TTL values passed to constructor
  - Success criteria: Backend correctly routes to appropriate LRU cache based on key prefix, respects TTL values

---

## Verification Checklist

After completing all tasks above, verify:

**Functionality Preserved:**
- Text embeddings still cached with 15min TTL, same cache keys as before
- Image embeddings still cached with 24hr TTL, same cache keys as before
- Search results cached with 5min TTL, filters properly serialized in cache key
- Cache hit/miss statistics tracked and exposed via `/api/cache/stats`
- Cache clear/reset functionality works in settings UI

**Code Quality:**
- 872 lines consolidated to ~343 lines (61% reduction)
- Single source of truth for caching logic
- Strategy pattern enables future Redis/KV swap without touching business logic
- Deep module: simple domain interface (6 methods) hides complex implementation details
- Zero references to deleted files (cache.ts, multi-layer-cache.ts, search-cache.ts)

**Testing:**
- All existing tests passing with new implementation
- New unit tests for CacheService and MemoryBackend
- Cache stats API test updated for new response format

**Future-Proofing:**
- ICacheBackend interface ready for VercelKVBackend or RedisBackend implementation
- Swapping from Memory to KV requires only: `const cache = new CacheService(new VercelKVBackend())`
- Slug cache (slug-cache.ts) preserved as specialized three-tier implementation
