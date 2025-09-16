import { Redis } from '@upstash/redis';
import { LRUCache } from 'lru-cache';

// Multi-layer cache configuration
export const CACHE_CONFIG = {
  // Layer 1: In-memory cache sizes
  MEMORY: {
    TEXT_EMBEDDINGS: 100,      // Store 100 most recent text embeddings
    IMAGE_EMBEDDINGS: 500,      // Store 500 most recent image embeddings
    SEARCH_RESULTS: 50,         // Store 50 most recent search results
    ASSET_METADATA: 200,        // Store 200 most recent asset metadata
  },

  // Layer 2: Redis TTL (seconds)
  REDIS_TTL: {
    TEXT_EMBEDDING: 15 * 60,         // 15 minutes
    IMAGE_EMBEDDING: 24 * 60 * 60,   // 24 hours
    SEARCH_RESULTS: 5 * 60,          // 5 minutes
    ASSET_METADATA: 30 * 60,         // 30 minutes
    USER_PREFERENCES: 60 * 60,       // 1 hour
    POPULAR_QUERIES: 60 * 60,        // 1 hour
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
  l1Hits: number;
  l1Misses: number;
  l2Hits: number;
  l2Misses: number;
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
 * Multi-layer cache implementation for optimizing API calls and performance.
 * Uses L1 (in-memory LRU) and L2 (Redis) caching with automatic fallback.
 */
export class MultiLayerCache {
  // Layer 1: In-memory LRU caches
  private l1TextEmbeddings: LRUCache<string, number[]>;
  private l1ImageEmbeddings: LRUCache<string, number[]>;
  private l1SearchResults: LRUCache<string, any[]>;
  private l1AssetMetadata: LRUCache<string, any>;

  // Layer 2: Redis cache
  private redis: Redis | null = null;
  private enabled: boolean = false;

  // Statistics tracking
  private stats: CacheStats = {
    l1Hits: 0,
    l1Misses: 0,
    l2Hits: 0,
    l2Misses: 0,
    totalRequests: 0,
    hitRate: 0,
    avgLatency: 0,
    lastReset: new Date(),
  };

  // Cache warming
  private warmingInterval: NodeJS.Timeout | null = null;

  constructor(redisUrl?: string, redisToken?: string) {
    // Initialize Layer 1 (in-memory) caches
    this.l1TextEmbeddings = new LRUCache<string, number[]>({
      max: CACHE_CONFIG.MEMORY.TEXT_EMBEDDINGS,
      ttl: 5 * 60 * 1000, // 5 minutes in memory
    });

    this.l1ImageEmbeddings = new LRUCache<string, number[]>({
      max: CACHE_CONFIG.MEMORY.IMAGE_EMBEDDINGS,
      ttl: 60 * 60 * 1000, // 1 hour in memory
    });

    this.l1SearchResults = new LRUCache<string, any[]>({
      max: CACHE_CONFIG.MEMORY.SEARCH_RESULTS,
      ttl: 2 * 60 * 1000, // 2 minutes in memory
    });

    this.l1AssetMetadata = new LRUCache<string, any>({
      max: CACHE_CONFIG.MEMORY.ASSET_METADATA,
      ttl: 10 * 60 * 1000, // 10 minutes in memory
    });

    // Initialize Layer 2 (Redis) cache
    this.initializeRedis(redisUrl, redisToken);

    console.log('Multi-layer cache initialized');
  }

  private initializeRedis(url?: string, token?: string) {
    try {
      const redisUrl = url || process.env.UPSTASH_REDIS_REST_URL;
      const redisToken = token || process.env.UPSTASH_REDIS_REST_TOKEN;

      if (!redisUrl || !redisToken ||
          redisUrl === 'your_redis_url' ||
          redisToken === 'your_redis_token') {
        console.warn('Redis cache disabled: credentials not configured');
        this.enabled = false;
        return;
      }

      this.redis = new Redis({ url: redisUrl, token: redisToken });
      this.enabled = true;
      console.log('Redis cache layer initialized');
    } catch (error) {
      console.error('Failed to initialize Redis:', error);
      this.enabled = false;
    }
  }

  // Text Embedding Methods
  async getTextEmbedding(text: string): Promise<number[] | null> {
    const startTime = Date.now();
    const key = CACHE_KEYS.TEXT_EMBEDDING(text);
    this.stats.totalRequests++;

    // Check L1 (memory) cache
    const l1Result = this.l1TextEmbeddings.get(key);
    if (l1Result) {
      this.stats.l1Hits++;
      this.updateStats(Date.now() - startTime);
      console.log(`L1 cache hit: text embedding`);
      return l1Result;
    }
    this.stats.l1Misses++;

    // Check L2 (Redis) cache
    if (this.enabled && this.redis) {
      try {
        const l2Result = await this.redis.get<number[]>(key);
        if (l2Result) {
          this.stats.l2Hits++;
          // Promote to L1
          this.l1TextEmbeddings.set(key, l2Result);
          this.updateStats(Date.now() - startTime);
          console.log(`L2 cache hit: text embedding`);
          return l2Result;
        }
      } catch (error) {
        console.warn('L2 cache error:', error);
      }
    }
    this.stats.l2Misses++;

    this.updateStats(Date.now() - startTime);
    return null;
  }

  async setTextEmbedding(text: string, embedding: number[]): Promise<void> {
    const key = CACHE_KEYS.TEXT_EMBEDDING(text);

    // Set in L1
    this.l1TextEmbeddings.set(key, embedding);

    // Set in L2
    if (this.enabled && this.redis) {
      try {
        await this.redis.setex(
          key,
          CACHE_CONFIG.REDIS_TTL.TEXT_EMBEDDING,
          embedding
        );
      } catch (error) {
        console.warn('Failed to set L2 cache:', error);
      }
    }
  }

  // Image Embedding Methods
  async getImageEmbedding(checksum: string): Promise<number[] | null> {
    const startTime = Date.now();
    const key = CACHE_KEYS.IMAGE_EMBEDDING(checksum);
    this.stats.totalRequests++;

    // Check L1
    const l1Result = this.l1ImageEmbeddings.get(key);
    if (l1Result) {
      this.stats.l1Hits++;
      this.updateStats(Date.now() - startTime);
      console.log(`L1 cache hit: image embedding`);
      return l1Result;
    }
    this.stats.l1Misses++;

    // Check L2
    if (this.enabled && this.redis) {
      try {
        const l2Result = await this.redis.get<number[]>(key);
        if (l2Result) {
          this.stats.l2Hits++;
          // Promote to L1
          this.l1ImageEmbeddings.set(key, l2Result);
          this.updateStats(Date.now() - startTime);
          console.log(`L2 cache hit: image embedding`);
          return l2Result;
        }
      } catch (error) {
        console.warn('L2 cache error:', error);
      }
    }
    this.stats.l2Misses++;

    this.updateStats(Date.now() - startTime);
    return null;
  }

  async setImageEmbedding(checksum: string, embedding: number[]): Promise<void> {
    const key = CACHE_KEYS.IMAGE_EMBEDDING(checksum);

    // Set in L1
    this.l1ImageEmbeddings.set(key, embedding);

    // Set in L2
    if (this.enabled && this.redis) {
      try {
        await this.redis.setex(
          key,
          CACHE_CONFIG.REDIS_TTL.IMAGE_EMBEDDING,
          embedding
        );
      } catch (error) {
        console.warn('Failed to set L2 cache:', error);
      }
    }
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

    // Check L1
    const l1Result = this.l1SearchResults.get(key);
    if (l1Result) {
      this.stats.l1Hits++;
      this.updateStats(Date.now() - startTime);
      console.log(`L1 cache hit: search results for "${query}"`);
      return l1Result;
    }
    this.stats.l1Misses++;

    // Check L2
    if (this.enabled && this.redis) {
      try {
        const l2Result = await this.redis.get<any[]>(key);
        if (l2Result) {
          this.stats.l2Hits++;
          // Promote to L1
          this.l1SearchResults.set(key, l2Result);
          this.updateStats(Date.now() - startTime);
          console.log(`L2 cache hit: search results for "${query}"`);
          return l2Result;
        }
      } catch (error) {
        console.warn('L2 cache error:', error);
      }
    }
    this.stats.l2Misses++;

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

    // Set in L1
    this.l1SearchResults.set(key, results);

    // Set in L2
    if (this.enabled && this.redis) {
      try {
        await this.redis.setex(
          key,
          CACHE_CONFIG.REDIS_TTL.SEARCH_RESULTS,
          results
        );

        // Track popular queries
        await this.trackPopularQuery(query);
      } catch (error) {
        console.warn('Failed to set L2 cache:', error);
      }
    }
  }

  // Popular Query Tracking
  private async trackPopularQuery(query: string): Promise<void> {
    if (!this.enabled || !this.redis) return;

    try {
      const key = CACHE_KEYS.POPULAR_QUERIES();
      const popularQueries = await this.redis.get<Record<string, number>>(key) || {};

      popularQueries[query] = (popularQueries[query] || 0) + 1;

      // Keep only top queries
      const sorted = Object.entries(popularQueries)
        .sort(([, a], [, b]) => b - a)
        .slice(0, CACHE_CONFIG.WARMING.POPULAR_QUERIES_COUNT);

      await this.redis.setex(
        key,
        CACHE_CONFIG.REDIS_TTL.POPULAR_QUERIES,
        Object.fromEntries(sorted)
      );
    } catch (error) {
      console.warn('Failed to track popular query:', error);
    }
  }

  async getPopularQueries(): Promise<string[]> {
    if (!this.enabled || !this.redis) return [];

    try {
      const key = CACHE_KEYS.POPULAR_QUERIES();
      const popularQueries = await this.redis.get<Record<string, number>>(key) || {};
      return Object.keys(popularQueries);
    } catch (error) {
      console.warn('Failed to get popular queries:', error);
      return [];
    }
  }

  // Cache Warming
  async warmCache(userId: string): Promise<void> {
    console.log('Starting cache warming for user:', userId);

    // Warm popular queries
    const popularQueries = await this.getPopularQueries();
    console.log(`Warming ${popularQueries.length} popular queries`);

    // Note: Actual warming would require access to the embedding service
    // This is a placeholder for the warming logic
    for (const query of popularQueries) {
      // The actual search endpoint will populate the cache
      console.log(`Cache warm request for: "${query}"`);
    }
  }

  startAutoWarming(userId: string): void {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
    }

    // Initial warming
    this.warmCache(userId).catch(console.error);

    // Periodic warming
    this.warmingInterval = setInterval(
      () => this.warmCache(userId).catch(console.error),
      CACHE_CONFIG.WARMING.REFRESH_INTERVAL
    );

    console.log('Auto-warming started');
  }

  stopAutoWarming(): void {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
      this.warmingInterval = null;
      console.log('Auto-warming stopped');
    }
  }

  // Cache Invalidation
  async invalidateUserData(userId: string): Promise<void> {
    // Clear L1 caches for user
    const patterns = [
      `search:${userId}:`,
      `assets:${userId}:`,
      `count:${userId}`,
      `recent:${userId}`,
    ];

    // Clear from L1
    for (const [key] of this.l1SearchResults) {
      if (patterns.some(p => key.startsWith(p))) {
        this.l1SearchResults.delete(key);
      }
    }

    for (const [key] of this.l1AssetMetadata) {
      if (patterns.some(p => key.startsWith(p))) {
        this.l1AssetMetadata.delete(key);
      }
    }

    // Clear from L2
    if (this.enabled && this.redis) {
      try {
        for (const pattern of patterns) {
          const keys = await this.redis.keys(`${pattern}*`);
          if (keys.length > 0) {
            await this.redis.del(...keys);
          }
        }
        console.log(`Invalidated cache for user ${userId}`);
      } catch (error) {
        console.warn('Failed to invalidate L2 cache:', error);
      }
    }
  }

  // Statistics
  private updateStats(latency: number): void {
    const total = this.stats.totalRequests;
    this.stats.avgLatency = (this.stats.avgLatency * (total - 1) + latency) / total;

    const hits = this.stats.l1Hits + this.stats.l2Hits;
    this.stats.hitRate = total > 0 ? (hits / total) * 100 : 0;
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      l1Hits: 0,
      l1Misses: 0,
      l2Hits: 0,
      l2Misses: 0,
      totalRequests: 0,
      hitRate: 0,
      avgLatency: 0,
      lastReset: new Date(),
    };
  }

  // Cache Management
  clearL1Cache(): void {
    this.l1TextEmbeddings.clear();
    this.l1ImageEmbeddings.clear();
    this.l1SearchResults.clear();
    this.l1AssetMetadata.clear();
    console.log('L1 cache cleared');
  }

  async clearL2Cache(): Promise<void> {
    if (this.enabled && this.redis) {
      try {
        await this.redis.flushall();
        console.log('L2 cache cleared');
      } catch (error) {
        console.warn('Failed to clear L2 cache:', error);
      }
    }
  }

  async clearAllCaches(): Promise<void> {
    this.clearL1Cache();
    await this.clearL2Cache();
    this.resetStats();
  }

  // Health Check
  async isHealthy(): Promise<{
    l1: boolean;
    l2: boolean;
    stats: CacheStats;
  }> {
    let l2Healthy = false;

    if (this.enabled && this.redis) {
      try {
        const result = await this.redis.ping();
        l2Healthy = result === 'PONG';
      } catch {
        l2Healthy = false;
      }
    }

    return {
      l1: true, // In-memory cache is always available
      l2: l2Healthy,
      stats: this.getStats(),
    };
  }
}

// Singleton instance
let multiLayerCache: MultiLayerCache | null = null;

/**
 * Factory function to create or get singleton MultiLayerCache instance.
 * Initializes Redis connection if credentials provided.
 *
 * @param redisUrl - Optional Upstash Redis URL
 * @param redisToken - Optional Upstash Redis token
 * @returns MultiLayerCache instance
 */
export function createMultiLayerCache(
  redisUrl?: string,
  redisToken?: string
): MultiLayerCache {
  if (!multiLayerCache) {
    multiLayerCache = new MultiLayerCache(redisUrl, redisToken);
  }
  return multiLayerCache;
}

/**
 * Get the current MultiLayerCache instance if it exists.
 *
 * @returns MultiLayerCache instance or null if not initialized
 */
export function getMultiLayerCache(): MultiLayerCache | null {
  return multiLayerCache;
}

/**
 * Generate a hash string from input for cache key generation.
 * Uses fast non-cryptographic hash for performance.
 *
 * @param str - String to hash
 * @returns Base36 hash string
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