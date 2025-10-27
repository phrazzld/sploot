# BACKLOG: Cache Consolidation Future Enhancements

**Context:** Cache consolidation completed with memory-only backend and strategy pattern. These items deferred for multi-user scale or specific performance needs.

---

## Multi-User Readiness

### User-Scoped Cache Invalidation
**Value:** Prevent one user's actions from evicting other users' caches
**Trigger:** Multi-user launch (when sharing features added)
**Effort:** ~2 hours
**Context:** PR #7 Codex P1 feedback (4 inline comments)
**Priority:** Required before multi-user release

**Current Limitation:**
- `cache.clear('assets')` clears ALL users' asset caches globally
- `cache.clear('search')` clears ALL users' search results globally
- One user favoriting an asset evicts cached data for everyone
- Acceptable for single-user scope (per CLAUDE.md), regression for multi-user

**Previous Implementation:**
- Used `invalidateUserData(userId)` function
- Cleared only keys prefixed with specific userId
- Example: cleared `search:user123:*` without affecting `search:user456:*`

**Required Implementation:**

1. **Add user-scoped clear method to ICacheBackend:**
   ```typescript
   interface ICacheBackend {
     // ... existing methods
     clearUserData(userId: string, namespace?: string): Promise<void>;
   }
   ```

2. **Implement in MemoryBackend:**
   ```typescript
   async clearUserData(userId: string, namespace?: string): Promise<void> {
     const caches = namespace ? [this.getCacheForNamespace(namespace)] :
                               [this.searchResults, this.assetMetadata];

     for (const cache of caches) {
       // LRU cache iteration: delete keys starting with namespace:userId:
       for (const key of cache.keys()) {
         if (key.startsWith(`search:${userId}:`) ||
             key.startsWith(`assets:${userId}:`)) {
           cache.delete(key);
         }
       }
     }
   }
   ```

3. **Update asset mutation routes** (4 locations):
   - `app/api/assets/route.ts:134` (asset creation)
   - `app/api/assets/[id]/route.ts:186` (favorite toggle)
   - `app/api/assets/[id]/route.ts:274` (permanent delete)
   - `app/api/assets/[id]/route.ts:291` (soft delete)

   ```typescript
   // Change from:
   await cache.clear('assets');
   await cache.clear('search');

   // To:
   await cache.clearUserData(userId, 'assets');
   await cache.clearUserData(userId, 'search');
   ```

**Redis/KV Alternative:**
- Redis: Use `SCAN` + `DEL` with pattern `search:${userId}:*`
- Vercel KV: Use `scan()` with cursor and pattern matching
- More efficient than LRU iteration for large datasets

**Testing Requirements:**
- Verify user A's cache unaffected when user B modifies assets
- Test concurrent operations: user A and B both favoriting simultaneously
- Measure performance impact of cache iteration (should be <10ms for 1000 entries)

**Success Criteria:**
- Cache hit rate remains high under multi-user load
- One user's mutations don't evict other users' cached data
- Backwards compatible with single-user behavior

---

## Future Backend Implementations

### Vercel KV Backend (When Multi-User Scale Reached)
**Value:** Persistent cache across deployments, shared across serverless function instances
**Trigger:** Multi-user launch or hitting memory limits (>1GB cache footprint)
**Effort:** ~2-3 hours

**Implementation:**
- Create `lib/cache/VercelKVBackend.ts` implementing `ICacheBackend`
- Use existing `@vercel/kv` package (already in dependencies)
- Implement get/set/delete using `kv.get()`, `kv.set()`, `kv.del()`
- Handle JSON serialization/deserialization for complex objects
- Map TTL seconds to KV's `ex` parameter
- Add error handling for KV connection failures (fallback to memory or fail gracefully)

**Swap:** Single line change in `lib/cache/index.ts`:
```typescript
const cacheServiceInstance = new CacheService(new VercelKVBackend());
```

**Cost Consideration:** Upstash free tier = 256MB + 500k commands/month. Estimate usage before adopting.

---

### Redis Backend (Self-Hosted or Cloud Redis)
**Value:** Full control over caching infrastructure, no vendor lock-in
**Trigger:** Need for advanced Redis features (pub/sub, streams) or cost optimization at scale
**Effort:** ~3-4 hours

**Implementation:**
- Add `ioredis` package dependency
- Create `lib/cache/RedisBackend.ts` implementing `ICacheBackend`
- Connection string from `REDIS_URL` environment variable
- Handle connection pooling, reconnection logic
- Implement pipelining for batch operations (future optimization)
- Add health check method to verify Redis connectivity

**Benefits over Vercel KV:**
- Lower cost at high scale (self-hosted)
- Advanced features: pub/sub for cache invalidation across instances
- Better observability/monitoring options

---

### Hybrid Two-Tier Backend (Memory L1 + KV/Redis L2)
**Value:** Best of both worlds - 0ms L1 hits, persistent L2 cache
**Trigger:** High cache hit rate (>70%) with need for persistence
**Effort:** ~4-5 hours
**Pattern:** Copy from existing `lib/slug-cache.ts` three-tier implementation

**Implementation:**
- Create `lib/cache/HybridBackend.ts` implementing `ICacheBackend`
- Wrap existing MemoryBackend as L1 cache
- Wrap VercelKVBackend or RedisBackend as L2 cache
- On `get`: check L1 → if miss, check L2 → if hit, warm L1 → return
- On `set`: write to both L1 and L2 in parallel
- On `delete`: invalidate both L1 and L2
- Add config for L1 TTL (shorter) vs L2 TTL (longer)

**Optimization:** Async L2 writes - return immediately after L1 write, queue L2 write in background

**Success Metrics:** L1 hit rate >70%, L2 hit rate >20%, combined latency <10ms p95

---

## Cache Warming Strategies

### Popular Query Pre-Warming (Multi-User Context)
**Value:** Avoid cold cache performance hits after deployment
**Trigger:** Multiple users experiencing cache misses for same popular searches
**Effort:** ~2 hours

**Implementation:**
- Track search query frequency in database (or analytics)
- Identify top 20 most common queries per user
- After deployment, background job warms cache by generating embeddings for top queries
- Schedule: Run on deployment, every 6 hours to refresh

**Code from `multi-layer-cache.ts` WARMING config** (lines 24-28):
```typescript
WARMING: {
  POPULAR_QUERIES_COUNT: 20,
  RECENT_ASSETS_COUNT: 100,
  REFRESH_INTERVAL: 15 * 60 * 1000, // 15 minutes
}
```

**Metrics to Track:** Cache hit rate before/after warming, time to first search result

---

### Asset Metadata Pre-Loading
**Value:** Faster asset list rendering on homepage
**Trigger:** Users complain about slow initial page load (>1s)
**Effort:** ~1 hour

**Implementation:**
- On user login, background job fetches recent 100 assets and caches metadata
- Populate `assets:${userId}:recent` cache key
- Expire after 30 minutes to ensure freshness

**Trade-off:** Increased database load on login vs faster initial render

---

## Observability Enhancements

### Prometheus Metrics Export
**Value:** Production monitoring, alerting on low cache hit rates
**Trigger:** Multi-user production deployment
**Effort:** ~3 hours

**Implementation:**
- Add `prom-client` package
- Create `lib/cache/ObservableCache.ts` decorator wrapping CacheService
- Track metrics: cache hits/misses (counter), cache latency (histogram), cache size (gauge)
- Export `/api/metrics` endpoint for Prometheus scraping
- Set up Grafana dashboard for visualization

**Metrics:**
- `cache_requests_total{namespace, status}` - counter (hit/miss)
- `cache_latency_ms{namespace, operation}` - histogram (get/set)
- `cache_size_bytes{namespace}` - gauge (current size)

---

### Structured Logging with Context
**Value:** Debug cache issues in production
**Trigger:** Unexplained cache behavior or performance degradation
**Effort:** ~1 hour

**Implementation:**
- Add logging to CacheService: debug level for hits/misses, error level for failures
- Include context: userId, query snippet (first 50 chars), cache key hash
- Use structured logger (Winston or Pino) for JSON output
- Log to Vercel logging or external service (Datadog, Sentry)

**Example Log:**
```json
{
  "level": "debug",
  "msg": "Cache hit",
  "namespace": "text-embeddings",
  "keyHash": "a3f2c1",
  "querySnippet": "funny cat meme...",
  "userId": "user_123",
  "timestamp": "2025-10-23T12:34:56Z"
}
```

---

## Performance Optimizations

### Batch Cache Operations
**Value:** Reduce RTT for multiple cache lookups
**Trigger:** Routes fetching embeddings for multiple images/texts in single request
**Effort:** ~2 hours

**Implementation:**
- Add methods to ICacheBackend: `getMany(keys: string[]): Promise<Map<string, T>>`
- Add methods to CacheService: `getTextEmbeddings(texts: string[]): Promise<Map<string, number[]>>`
- For MemoryBackend: loop over keys (no real benefit, already in-process)
- For RedisBackend: use MGET command or pipeline
- For VercelKVBackend: parallelize with `Promise.all(keys.map(k => kv.get(k)))`

**Use Case:** Upload endpoint generating embeddings for 10 images - batch fetch existing embeddings in single call

---

### Compression for Large Values
**Value:** Reduce memory footprint and network transfer for cached embeddings
**Trigger:** Cache using >500MB memory or Vercel KV approaching storage limits
**Effort:** ~2 hours

**Implementation:**
- Add compression layer in CacheService before backend.set()
- Use `lz4` or `zstd` for fast compression (embeddings are floating point arrays, compress well)
- Compress on set, decompress on get
- Add `compressed: boolean` flag to cached values to handle migration

**Expected Savings:** 768-dim float32 embeddings compress ~40-60% (3KB → 1.5KB)

---

### Smart TTL Adjustment Based on Access Patterns
**Value:** Keep frequently accessed items longer, evict stale items faster
**Trigger:** Cache hit rate drops below 50% despite sufficient capacity
**Effort:** ~3 hours

**Implementation:**
- Track access frequency for each cache key
- On cache hit, extend TTL proportionally to access frequency
- On cache set, calculate initial TTL based on predicted access pattern
- Use exponential backoff: 1 access = 15min, 10 accesses = 1hr, 100 accesses = 6hr

**Complexity Warning:** Adds state tracking overhead. Only implement if demonstrated need.

---

## Testing Infrastructure

### Cache Integration Tests
**Value:** Catch cache behavior issues before production
**Trigger:** Migration to Vercel KV or Redis backend
**Effort:** ~2 hours

**Implementation:**
- Create `__tests__/integration/cache-integration.test.ts`
- Test real backend (not mocked): spin up Redis in Docker for tests, or use Vercel KV test instance
- Test scenarios: cache persistence across service restarts, concurrent access, TTL expiration
- Use `testcontainers` package for Redis container management in tests

---

### Cache Performance Benchmarks
**Value:** Quantify performance impact of different backends
**Trigger:** Evaluating Memory vs KV vs Redis backends
**Effort:** ~1 hour

**Implementation:**
- Create `__benchmarks__/cache-benchmark.ts` using `vitest bench` or `tinybench`
- Benchmark operations: get (hit), get (miss), set, delete
- Compare Memory vs Vercel KV vs Redis backends
- Measure: latency (p50, p95, p99), throughput (ops/sec)

**Baseline Expectations:**
- Memory: <1ms p99
- Vercel KV: 5-15ms p99 (network RTT)
- Redis (same region): 2-5ms p99

---

## Nice-to-Have Improvements

### Testing Infrastructure Enhancements (from PR #7 review)
**Value:** Improved test coverage and developer experience
**Trigger:** Implementing Redis/KV backend or debugging cache issues
**Effort:** ~3 hours total
**Source:** PR #7 code review feedback

**Memory Leak Prevention (10 min):**
- Add `resetCacheService()` function to `lib/cache/index.ts` for test cleanup
- Allows tests to start with fresh cache state
- Prevents singleton accumulating stale data across test runs

**Additional Test Scenarios (2-3 hours):**
- LRU eviction testing: Verify max size limits trigger eviction
- TTL expiration testing: Advance time mocks to verify expiration behavior
- Concurrent stress testing: High-volume parallel reads/writes
- Would use test-specific backends or time mocking

**TTL Behavior Documentation (15 min):**
- Clarify per-item vs cache-wide TTL in `ICacheBackend` interface JSDoc
- Current: Interface suggests per-item TTL, implementation uses cache-wide defaults
- Document that `MemoryBackend` supports per-item TTL via LRUCache options
- Future Redis/KV backends would naturally support per-item TTL

### Cache Key Versioning
**Value:** Invalidate all cache entries when embedding model changes
**Effort:** ~30 minutes

Add version prefix to cache keys:
```typescript
TEXT_EMBEDDING: (text: string) => `v2:txt:${hashString(text)}`
```

Bump version when changing CLIP model or embedding dimension. All old cache entries automatically invalidated (different key prefix).

---

### Namespace-Aware Cache Clearing
**Value:** Clear only specific cache type (e.g., "clear all search caches")
**Effort:** ~1 hour

Implement `clear(namespace)` method that only clears specified namespace:
```typescript
await cache.clear('text-embeddings'); // Only clears txt: keys
await cache.clear('search-results');  // Only clears search: keys
```

Useful for debugging or when specific data type becomes stale.

---

### Cache Hit Rate Alerting
**Value:** Proactive notification when cache performance degrades
**Effort:** ~1 hour (depends on monitoring setup)

Set up alert in monitoring system:
- Alert when hit rate <40% over 15min window
- Alert when cache latency p95 >100ms
- Send to Slack/email for investigation

---

## Technical Debt Opportunities

### Migrate Slug Cache to Unified Service
**Current State:** `lib/slug-cache.ts` exists as separate three-tier implementation
**Opportunity:** Merge into CacheService as specialized caching strategy
**Effort:** ~3 hours
**Benefit:** Single caching codebase, easier to maintain
**Risk:** Slug cache is well-tested and stable, migration may introduce bugs
**Recommendation:** Leave separate unless actively causing maintenance burden

---

### Type-Safe Cache Keys
**Current State:** Cache keys are strings, easy to mistype or create inconsistent keys
**Opportunity:** Create branded types for cache keys to enforce correct usage
**Effort:** ~2 hours

```typescript
type TextEmbeddingKey = string & { __brand: 'TextEmbeddingKey' };
type ImageEmbeddingKey = string & { __brand: 'ImageEmbeddingKey' };

// Factory functions ensure correct key format
function createTextEmbeddingKey(text: string): TextEmbeddingKey {
  return `txt:${hashString(text)}` as TextEmbeddingKey;
}
```

**Benefit:** Compile-time safety, prevents mixing up key types
**Complexity:** Adds type gymnastics, may not be worth it for internal API

---

## Future Backend Considerations

### Cloudflare KV (If Migrating from Vercel)
**Trigger:** Move to Cloudflare Workers/Pages from Vercel
**Effort:** ~2 hours
**Implementation:** Similar to VercelKVBackend, use Cloudflare KV bindings

### DynamoDB (If on AWS)
**Trigger:** Migrate to AWS infrastructure
**Effort:** ~4 hours
**Considerations:** TTL requires DynamoDB TTL attribute, partition key design for even distribution

### In-Memory + Disk Persistence (SQLite)
**Trigger:** Single-server deployment, need persistence without external service
**Effort:** ~3 hours
**Implementation:** Use `better-sqlite3` for disk-backed cache with LRU eviction logic

---

# BACKLOG: Mobile-Friendly Enhancements

**Context:** Mobile share & actions implementation (TODO.md). These items deferred as non-critical enhancements or alternative approaches.

---

## Future Enhancements

### Server-Side Mobile Detection
**Value:** Optimized initial render for mobile clients (buttons visible immediately without JS)
**Trigger:** Measurable CLS/FCP improvements needed, or SSR optimization focus
**Effort:** ~2-3 hours

**Implementation:**
- Add `ua-parser-js` dependency for user-agent parsing
- Create middleware in `middleware.ts` to detect mobile clients
- Set header `x-device-type: mobile|desktop` on request
- Read header in components via `headers()` in React Server Components
- Render mobile-optimized markup server-side (no hover classes)

**Benefit:** Improved perceived performance, no layout shift when JS loads
**Trade-off:** Increased server CPU for UA parsing on every request

---

### Progressive Web App Share Target
**Value:** "Save to sploot" workflow - share images TO sploot from other apps
**Trigger:** User feedback requesting save-to-library from camera/other apps
**Effort:** ~4-6 hours

**Implementation:**
- Add `share_target` to `public/manifest.json`:
  ```json
  {
    "share_target": {
      "action": "/app/share-target",
      "method": "POST",
      "enctype": "multipart/form-data",
      "params": {
        "files": [{"name": "image", "accept": ["image/*"]}]
      }
    }
  }
  ```
- Create `app/app/share-target/route.ts` POST handler
- Extract file from FormData, process like upload
- Redirect to library after save
- Handle auth: require sign-in before accepting share

**Benefit:** Native app-like workflow on mobile, differentiated feature
**Complexity:** Additional surface area for uploads, authentication flow

---

### Touch Gesture Controls for Fullscreen Modal
**Value:** More native app-like feel, cleaner UI on mobile
**Trigger:** User testing shows desire for gesture navigation
**Effort:** ~6-8 hours

**Implementation:**
- Add gesture library (`react-use-gesture` or `use-gesture`)
- Implement swipe-up gesture in fullscreen modal to reveal action bar
- Implement swipe-down gesture to dismiss modal
- Add left/right swipe for next/previous image in library
- Include smooth spring animations for gesture transitions
- Add visual feedback during gesture (rubber band effect)

**Benefit:** Enhanced tactile UX, reduced UI chrome
**Risk:** Learning curve for users unfamiliar with gestures

---

### Haptic Feedback on Mobile Actions
**Value:** Enhanced tactile response on mobile browsers
**Trigger:** Pursuit of premium mobile experience
**Effort:** ~1-2 hours

**Implementation:**
- Feature detect Vibration API: `navigator.vibrate`
- Add haptic patterns:
  - Favorite: Short pulse (50ms)
  - Delete: Double pulse (50ms, pause, 50ms)
  - Share: Triple pulse (light, medium, light)
- Wrap in `useHaptic()` hook for reusability
- Add user preference toggle in settings to disable

**Browser Support:** Android Chrome (good), iOS Safari (no support - graceful no-op)
**Benefit:** Marginal UX improvement on supported devices

---

### Long-Press Context Menu on Tiles
**Value:** Cleaner UI, more actions available without permanent buttons
**Trigger:** Action bar getting crowded with features (tags, copy, etc.)
**Effort:** ~8-10 hours

**Implementation:**
- Detect long-press gesture (300ms threshold)
- Show context menu overlay at touch point
- Menu items: Share, Delete, Favorite, Copy URL, Download, View Details
- Custom component (not native context menu for styling control)
- Handle touch move during long-press (cancel if finger moves >10px)
- Dismiss on background tap or action selection

**Alternative to:** Always-visible buttons on mobile
**Trade-off:** Hidden affordance (users must discover), but cleaner aesthetic

---

## Nice-to-Have Improvements

### Share Analytics Tracking
**Value:** Data-driven UX decisions about share method preference
**Effort:** ~1 hour

**Implementation:**
- Add telemetry event when share button clicked
- Track: method used (native/clipboard), success/failure, device type
- Log to existing `/api/telemetry` endpoint
- Create analytics dashboard showing share method distribution
- Use data to prioritize further share UX improvements

**Example Insight:** If 90% use native share, could remove clipboard fallback UI complexity

---

### Clipboard Fallback Modal for iOS Non-HTTPS
**Value:** Better error recovery when clipboard API fails
**Trigger:** Users reporting share failures on iOS in non-HTTPS contexts
**Effort:** ~2 hours

**Implementation:**
- Detect clipboard write failure (iOS Safari blocks in some contexts)
- Show modal with shareable URL in input field
- Auto-select text for easy manual copy
- Add "Copy Link" button with alternative clipboard approach (document.execCommand)
- Dismiss modal after copy or cancel

**Context:** Rare edge case - most deployments use HTTPS where clipboard works

---

### Share URL Shortening Integration
**Value:** Marginally cleaner share links for social media
**Effort:** ~3-4 hours
**Assessment:** Low priority - current `/s/[slug]` already short (10 chars)

**Implementation:**
- Integrate bit.ly or similar API
- Generate short URL on share click
- Cache mapping in database (share_slug → short_url)
- Additional API call + external dependency

**Benefit:** Minimal - 10-char slug already quite short
**Recommendation:** Defer unless user feedback specifically requests shorter links

---

### Image Download Button in Fullscreen Modal
**Value:** Convenience for users who want local copy
**Effort:** ~1 hour

**Implementation:**
- Add download button to fullscreen modal action bar
- Fetch blob, create download link with `download` attribute
- Filename from asset metadata
- Handle cross-origin restrictions (fetch, create blob URL)

**Use Case:** Power users building local collections, meme creators saving source

---

### Keyboard Shortcuts in Fullscreen Modal
**Value:** Desktop power user efficiency
**Effort:** ~2 hours

**Implementation:**
- Add keyboard event listener in modal
- Shortcuts:
  - Arrow keys: Next/previous image in library
  - F: Toggle favorite
  - S: Share
  - D: Delete (with confirmation)
  - ESC: Close modal (already works)
- Show shortcut hints on hover or help overlay
- Use existing `useKeyboardShortcut` hook

**Benefit:** Faster navigation for desktop users browsing many images

---

## Technical Debt Opportunities

### Consolidate Hover Detection
**Current State:** Hover capability checked in multiple places (CSS media query, JS hook)
**Opportunity:** Create single source of truth for hover detection
**Effort:** ~1 hour

**Implementation:**
- Define CSS custom property: `--has-hover: 0|1`
- Set in root based on `@media (hover: hover)` query
- Read in JS: `getComputedStyle(document.documentElement).getPropertyValue('--has-hover')`
- All components use single detection method

**Benefit:** Easier maintenance, consistent behavior across components
**Risk:** Minimal - well-tested pattern

---

### Refactor ShareButton Component API
**Current State:** ShareButton takes `assetId`, internally fetches share URL
**Opportunity:** Accept pre-fetched `shareUrl` prop for flexibility
**Effort:** ~30 minutes

**Implementation:**
- Add optional `shareUrl?: string` prop
- If provided, skip API call and use directly
- If not provided, fetch as currently implemented (backwards compatible)
- Update prop types and JSDoc

**Benefit:** Reusable in more contexts (sharing external URLs, pre-fetched shares)
**Use Case:** Sharing from search results where we might batch-fetch share URLs

---

### Extract Action Hooks for Reusability
**Current State:** Favorite/delete logic duplicated between tiles and modal
**Opportunity:** Extract to custom hooks (`useFavoriteToggle`, `useAssetDelete`)
**Effort:** ~2 hours

**Implementation:**
- Create `hooks/use-favorite-toggle.ts`:
  - Takes asset ID and current favorite state
  - Returns `toggleFavorite` function
  - Handles API call, optimistic updates, error handling
  - Emits events for cache invalidation
- Create `hooks/use-asset-delete.ts`:
  - Takes asset ID
  - Returns `deleteAsset` function with confirmation
  - Handles API call, state cleanup, success toast
- Update ImageTile and fullscreen modal to use hooks

**Benefit:** DRY principle, easier testing, consistent behavior
**Testing:** Unit test hooks in isolation with mocked fetch

---

### Fullscreen Modal State Management
**Current State:** Modal state local to page component (`selectedAsset` state)
**Opportunity:** Extract to URL state for deep linking to specific images
**Effort:** ~3 hours

**Implementation:**
- Add `?image=[assetId]` query param when opening modal
- Read query param on mount to auto-open modal
- Update URL when navigating next/prev in modal
- Remove param when closing modal
- Enable shareable URLs like `/app?image=abc123`

**Benefit:** Shareable URLs to specific images, browser back button closes modal
**Use Case:** Sharing link to specific meme in your library (requires public share first)
