import { ICacheBackend, CacheStats, SearchFilters } from './types';
import { MemoryBackend } from './MemoryBackend';

/**
 * Generate a hash string from input for cache key generation.
 * Uses fast non-cryptographic hash for performance.
 * Copied from multi-layer-cache.ts (lines 362-372)
 */
function hashString(str: string): string {
  let hash = 0;
  if (str.length === 0) return hash.toString(36);

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return Math.abs(hash).toString(36);
}

/**
 * Cache key generators matching multi-layer-cache.ts exactly
 * Preserves existing key patterns for compatibility
 */
const CACHE_KEYS = {
  TEXT_EMBEDDING: (text: string) => `txt:${hashString(text)}`,
  IMAGE_EMBEDDING: (checksum: string) => `img:${checksum}`,
  SEARCH_RESULTS: (userId: string, query: string, filters: string) =>
    `search:${userId}:${hashString(query + filters)}`,
  ASSET_LIST: (userId: string, params: string) =>
    `assets:${userId}:${hashString(params)}`,
} as const;

/**
 * Unified cache service providing domain-specific interface
 * Deep module: simple interface hides complex key generation, namespacing, backend
 *
 * Interface: 6 domain methods (text/image embeddings, search results)
 * Hidden: Key generation, hash functions, namespace routing, backend strategy
 *
 * Future migration to Redis/Vercel KV: swap backend, zero business logic changes
 */
export class CacheService {
  private backend: ICacheBackend;
  private stats: CacheStats;

  constructor(backend?: ICacheBackend) {
    this.backend = backend ?? new MemoryBackend();
    this.stats = {
      hits: 0,
      misses: 0,
      totalRequests: 0,
      hitRate: 0,
      lastReset: new Date(),
    };
  }

  // Text Embedding Methods

  async getTextEmbedding(text: string): Promise<number[] | null> {
    const key = CACHE_KEYS.TEXT_EMBEDDING(text);
    this.stats.totalRequests++;

    const embedding = await this.backend.get<number[]>(key);
    if (embedding) {
      this.incrementHit();
      return embedding;
    }

    this.incrementMiss();
    return null;
  }

  async setTextEmbedding(text: string, embedding: number[]): Promise<void> {
    const key = CACHE_KEYS.TEXT_EMBEDDING(text);
    await this.backend.set(key, embedding);
  }

  // Image Embedding Methods

  async getImageEmbedding(checksum: string): Promise<number[] | null> {
    const key = CACHE_KEYS.IMAGE_EMBEDDING(checksum);
    this.stats.totalRequests++;

    const embedding = await this.backend.get<number[]>(key);
    if (embedding) {
      this.incrementHit();
      return embedding;
    }

    this.incrementMiss();
    return null;
  }

  async setImageEmbedding(checksum: string, embedding: number[]): Promise<void> {
    const key = CACHE_KEYS.IMAGE_EMBEDDING(checksum);
    await this.backend.set(key, embedding);
  }

  // Search Results Methods

  async getSearchResults(
    userId: string,
    query: string,
    filters: SearchFilters = {}
  ): Promise<any[] | null> {
    const filterKey = JSON.stringify(filters);
    const key = CACHE_KEYS.SEARCH_RESULTS(userId, query, filterKey);
    this.stats.totalRequests++;

    const results = await this.backend.get<any[]>(key);
    if (results) {
      this.incrementHit();
      return results;
    }

    this.incrementMiss();
    return null;
  }

  async setSearchResults(
    userId: string,
    query: string,
    filters: SearchFilters,
    results: any[]
  ): Promise<void> {
    const filterKey = JSON.stringify(filters);
    const key = CACHE_KEYS.SEARCH_RESULTS(userId, query, filterKey);
    await this.backend.set(key, results);
  }

  // Cache Management Methods

  async invalidate(key: string): Promise<void> {
    await this.backend.delete(key);
  }

  async clear(namespace?: string): Promise<void> {
    await this.backend.clear(namespace);
  }

  // Statistics Methods

  getStats(): CacheStats {
    return {
      ...this.stats,
      hitRate: this.stats.totalRequests > 0
        ? this.stats.hits / this.stats.totalRequests
        : 0,
    };
  }

  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      totalRequests: 0,
      hitRate: 0,
      lastReset: new Date(),
    };
  }

  // Private Statistics Tracking

  private incrementHit(): void {
    this.stats.hits++;
  }

  private incrementMiss(): void {
    this.stats.misses++;
  }
}
