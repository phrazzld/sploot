import { LRUCache } from 'lru-cache';

// Multi-layer cache configuration
export const CACHE_CONFIG = {
  // In-memory cache sizes
  MEMORY: {
    TEXT_EMBEDDINGS: 100,      // Store 100 most recent text embeddings
    IMAGE_EMBEDDINGS: 500,      // Store 500 most recent image embeddings
    SEARCH_RESULTS: 50,         // Store 50 most recent search results
    ASSET_METADATA: 200,        // Store 200 most recent asset metadata
  },

  // TTL in milliseconds
  TTL: {
    TEXT_EMBEDDING: 15 * 60 * 1000,         // 15 minutes
    IMAGE_EMBEDDING: 24 * 60 * 60 * 1000,   // 24 hours
    SEARCH_RESULTS: 5 * 60 * 1000,          // 5 minutes
    ASSET_METADATA: 30 * 60 * 1000,         // 30 minutes
    USER_PREFERENCES: 60 * 60 * 1000,       // 1 hour
    POPULAR_QUERIES: 60 * 60 * 1000,        // 1 hour
  },

  // Cache warming configuration
  WARMING: {
    POPULAR_QUERIES_COUNT: 20,       // Pre-warm top 20 queries
    RECENT_ASSETS_COUNT: 100,        // Pre-warm recent 100 assets
    REFRESH_INTERVAL: 15 * 60 * 1000, // Refresh every 15 minutes
  }
} as const;

// Cache statistics tracking
export interface CacheStats {
  hits: number;
  misses: number;
  totalRequests: number;
  hitRate: number;
  avgLatency: number;
  lastReset: Date;
}

// Cache key generators
const CACHE_KEYS = {
  TEXT_EMBEDDING: (text: string) => `txt:${hashString(text)}`,
  IMAGE_EMBEDDING: (checksum: string) => `img:${checksum}`,
  SEARCH_RESULTS: (userId: string, query: string, filters: string) =>
    `search:${userId}:${hashString(query + filters)}`,
  ASSET_LIST: (userId: string, params: string) => `assets:${userId}:${hashString(params)}`,
  USER_ASSETS_COUNT: (userId: string) => `count:${userId}`,
  POPULAR_QUERIES: () => 'popular:queries',
  RECENT_ASSETS: (userId: string) => `recent:${userId}`,
} as const;

/**
 * Simplified cache implementation for MVP.
 * Uses in-memory LRU cache only (removed Redis layer).
 * Can be extended with Redis or other backends later if needed.
 */
export class MultiLayerCache {
  // In-memory LRU caches
  private textEmbeddings: LRUCache<string, number[]>;
  private imageEmbeddings: LRUCache<string, number[]>;
  private searchResults: LRUCache<string, any[]>;
  private assetMetadata: LRUCache<string, any>;
  private popularQueries: LRUCache<string, number>;

  // Statistics tracking
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    totalRequests: 0,
    hitRate: 0,
    avgLatency: 0,
    lastReset: new Date(),
  };

  // Cache warming
  private warmingInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Initialize in-memory caches
    this.textEmbeddings = new LRUCache<string, number[]>({
      max: CACHE_CONFIG.MEMORY.TEXT_EMBEDDINGS,
      ttl: CACHE_CONFIG.TTL.TEXT_EMBEDDING,
    });

    this.imageEmbeddings = new LRUCache<string, number[]>({
      max: CACHE_CONFIG.MEMORY.IMAGE_EMBEDDINGS,
      ttl: CACHE_CONFIG.TTL.IMAGE_EMBEDDING,
    });

    this.searchResults = new LRUCache<string, any[]>({
      max: CACHE_CONFIG.MEMORY.SEARCH_RESULTS,
      ttl: CACHE_CONFIG.TTL.SEARCH_RESULTS,
    });

    this.assetMetadata = new LRUCache<string, any>({
      max: CACHE_CONFIG.MEMORY.ASSET_METADATA,
      ttl: CACHE_CONFIG.TTL.ASSET_METADATA,
    });

    this.popularQueries = new LRUCache<string, number>({
      max: CACHE_CONFIG.WARMING.POPULAR_QUERIES_COUNT,
      ttl: CACHE_CONFIG.TTL.POPULAR_QUERIES,
    });

    // In-memory cache initialized
  }

  // Text Embedding Methods
  async getTextEmbedding(text: string): Promise<number[] | null> {
    const startTime = Date.now();
    const key = CACHE_KEYS.TEXT_EMBEDDING(text);
    this.stats.totalRequests++;

    const result = this.textEmbeddings.get(key);
    if (result) {
      this.stats.hits++;
      this.updateStats(Date.now() - startTime);
      // Cache hit: text embedding
      return result;
    }

    this.stats.misses++;
    this.updateStats(Date.now() - startTime);
    return null;
  }

  async setTextEmbedding(text: string, embedding: number[]): Promise<void> {
    const key = CACHE_KEYS.TEXT_EMBEDDING(text);
    this.textEmbeddings.set(key, embedding);
  }

  // Image Embedding Methods
  async getImageEmbedding(checksum: string): Promise<number[] | null> {
    const startTime = Date.now();
    const key = CACHE_KEYS.IMAGE_EMBEDDING(checksum);
    this.stats.totalRequests++;

    const result = this.imageEmbeddings.get(key);
    if (result) {
      this.stats.hits++;
      this.updateStats(Date.now() - startTime);
      // Cache hit: image embedding
      return result;
    }

    this.stats.misses++;
    this.updateStats(Date.now() - startTime);
    return null;
  }

  async setImageEmbedding(checksum: string, embedding: number[]): Promise<void> {
    const key = CACHE_KEYS.IMAGE_EMBEDDING(checksum);
    this.imageEmbeddings.set(key, embedding);
  }

  // Search Results Methods
  async getSearchResults(
    userId: string,
    query: string,
    filters: Record<string, any> = {}
  ): Promise<any[] | null> {
    const startTime = Date.now();
    const filterKey = JSON.stringify(filters);
    const key = CACHE_KEYS.SEARCH_RESULTS(userId, query, filterKey);
    this.stats.totalRequests++;

    const result = this.searchResults.get(key);
    if (result) {
      this.stats.hits++;
      this.updateStats(Date.now() - startTime);
      // Cache hit: search results
      return result;
    }

    this.stats.misses++;
    this.updateStats(Date.now() - startTime);
    return null;
  }

  async setSearchResults(
    userId: string,
    query: string,
    results: any[],
    filters: Record<string, any> = {}
  ): Promise<void> {
    const filterKey = JSON.stringify(filters);
    const key = CACHE_KEYS.SEARCH_RESULTS(userId, query, filterKey);
    this.searchResults.set(key, results);

    // Track popular queries
    await this.trackPopularQuery(query);
  }

  // Popular Query Tracking
  private async trackPopularQuery(query: string): Promise<void> {
    const current = this.popularQueries.get(query) || 0;
    this.popularQueries.set(query, current + 1);
  }

  async getPopularQueries(): Promise<string[]> {
    const queries: Array<[string, number]> = [];
    for (const [query, count] of this.popularQueries) {
      queries.push([query, count]);
    }
    // Sort by count descending and return query strings
    return queries
      .sort(([, a], [, b]) => b - a)
      .slice(0, CACHE_CONFIG.WARMING.POPULAR_QUERIES_COUNT)
      .map(([query]) => query);
  }

  // Cache Warming
  async warmCache(userId: string): Promise<void> {
    // Starting cache warming
    const popularQueries = await this.getPopularQueries();
    // Note: Actual warming would require access to the embedding service
    // This is a placeholder for the warming logic
  }

  startAutoWarming(userId: string): void {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
    }

    // Initial warming
    this.warmCache(userId).catch(() => {});

    // Periodic warming
    this.warmingInterval = setInterval(
      () => this.warmCache(userId).catch(() => {}),
      CACHE_CONFIG.WARMING.REFRESH_INTERVAL
    );

    // Auto-warming started
  }

  stopAutoWarming(): void {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
      this.warmingInterval = null;
      // Auto-warming stopped
    }
  }

  // Cache Invalidation
  async invalidateUserData(userId: string): Promise<void> {
    const patterns = [
      `search:${userId}:`,
      `assets:${userId}:`,
      `count:${userId}`,
      `recent:${userId}`,
    ];

    // Clear from search results
    for (const [key] of this.searchResults) {
      if (patterns.some(p => key.startsWith(p))) {
        this.searchResults.delete(key);
      }
    }

    // Clear from asset metadata
    for (const [key] of this.assetMetadata) {
      if (patterns.some(p => key.startsWith(p))) {
        this.assetMetadata.delete(key);
      }
    }

    // Invalidated cache
  }

  // Statistics
  private updateStats(latency: number): void {
    const total = this.stats.totalRequests;
    this.stats.avgLatency = (this.stats.avgLatency * (total - 1) + latency) / total;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      totalRequests: 0,
      hitRate: 0,
      avgLatency: 0,
      lastReset: new Date(),
    };
  }

  // Cache Management
  clearL1Cache(): void {
    this.textEmbeddings.clear();
    this.imageEmbeddings.clear();
    this.searchResults.clear();
    this.assetMetadata.clear();
    this.popularQueries.clear();
    // Cache cleared
  }

  // For backward compatibility with existing code
  async clearL2Cache(): Promise<void> {
    // No-op: L2 (Redis) removed
  }

  async clearAllCaches(): Promise<void> {
    this.clearL1Cache();
    this.resetStats();
  }

  // Health Check
  async isHealthy(): Promise<{
    l1: boolean;
    l2: boolean;
    stats: CacheStats;
  }> {
    return {
      l1: true, // In-memory cache is always available
      l2: false, // L2 (Redis) removed
      stats: this.getStats(),
    };
  }

  // Backward compatibility: make stats available with original property names
  get l1Hits() { return this.stats.hits; }
  get l1Misses() { return this.stats.misses; }
  get l2Hits() { return 0; } // No L2 anymore
  get l2Misses() { return 0; } // No L2 anymore
  get totalRequests() { return this.stats.totalRequests; }
  get hitRate() { return this.stats.hitRate; }
  get avgLatency() { return this.stats.avgLatency; }
  get lastReset() { return this.stats.lastReset; }
}

// Singleton instance
let multiLayerCache: MultiLayerCache | null = null;

/**
 * Factory function to create or get singleton MultiLayerCache instance.
 */
export function createMultiLayerCache(): MultiLayerCache {
  if (!multiLayerCache) {
    multiLayerCache = new MultiLayerCache();
  }
  return multiLayerCache;
}

/**
 * Get the current MultiLayerCache instance if it exists.
 */
export function getMultiLayerCache(): MultiLayerCache | null {
  return multiLayerCache;
}

/**
 * Generate a hash string from input for cache key generation.
 * Uses fast non-cryptographic hash for performance.
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