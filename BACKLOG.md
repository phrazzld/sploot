# BACKLOG: Cache Consolidation Future Enhancements

**Context:** Cache consolidation completed with memory-only backend and strategy pattern. These items deferred for multi-user scale or specific performance needs.

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
