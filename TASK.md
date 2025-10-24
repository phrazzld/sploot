
### [CRITICAL COMPLEXITY] Four Duplicate Cache Implementations
**Files**: `lib/cache.ts` (291 lines), `lib/multi-layer-cache.ts` (373 lines), `lib/search-cache.ts` (211 lines), `lib/slug-cache.ts` (94 lines)
**Perspectives**: complexity-archaeologist, architecture-guardian (cross-validated)
**Severity**: Development velocity blocker

**Issue**: 4 separate cache services with 80% overlapping functionality
- All use LRUCache with identical hash functions
- Different interfaces, different status types
- Duplication: 969 lines where 300-400 would suffice
- Change amplification: Adding Redis backend requires 4 separate implementations

**Evidence**:
```typescript
// cache.ts - shallow module (13 methods, 254 lines)
async getTextEmbedding(text: string): Promise<number[] | null>

// multi-layer-cache.ts - DUPLICATE (18 methods, 336 lines)
async getTextEmbedding(text: string): Promise<number[] | null>
// Both use identical LRUCache, identical TTLs, identical key patterns
```

**Strategic Impact**:
- Adding Redis migration: 4 files to change
- Cache invalidation logic duplicated
- 4x testing burden
- Developers confused which cache to use

**Fix**: Consolidate to single CacheService
```typescript
// lib/cache/CacheService.ts (350 lines)
export class CacheService {
  // Internal: Multiple storage backends (memory, KV, Redis)
  // Interface: 6 methods total (get, set, invalidate, stats, health, clear)
  // Strategy pattern for different cache types (text, image, search, slug)
}
```

**Effort**: 12h (consolidation + migration + testing) | **Impact**: HIGH - 969 → 350 lines (64% reduction), single source of truth
**Acceptance**: Single cache implementation, all consumers migrated, tests pass

---
