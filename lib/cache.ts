import { Redis } from '@upstash/redis';

// Cache configuration
const DEFAULT_TTL = {
  TEXT_EMBEDDING: 15 * 60, // 15 minutes - embeddings are expensive but queries may evolve
  IMAGE_EMBEDDING: 24 * 60 * 60, // 24 hours - image embeddings are static
  SEARCH_RESULTS: 5 * 60, // 5 minutes - search results can change with new uploads
  ASSET_METADATA: 30 * 60, // 30 minutes - asset data changes infrequently
  USER_PREFERENCES: 60 * 60, // 1 hour - user settings change rarely
} as const;

const CACHE_KEYS = {
  TEXT_EMBEDDING: (text: string) => `txt:${hashString(text)}`,
  IMAGE_EMBEDDING: (checksum: string) => `img:${checksum}`,
  SEARCH_RESULTS: (userId: string, query: string, filters: string) =>
    `search:${userId}:${hashString(query + filters)}`,
  ASSET_LIST: (userId: string, params: string) => `assets:${userId}:${hashString(params)}`,
  USER_ASSETS_COUNT: (userId: string) => `count:${userId}`,
} as const;

export class CacheError extends Error {
  constructor(
    message: string,
    public originalError?: Error,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'CacheError';
  }
}

export interface CacheConfig {
  url?: string;
  token?: string;
  timeout?: number;
}

export class CacheService {
  private redis: Redis | null = null;
  private enabled: boolean = false;

  constructor(config?: CacheConfig) {
    try {
      const url = config?.url || process.env.UPSTASH_REDIS_REST_URL;
      const token = config?.token || process.env.UPSTASH_REDIS_REST_TOKEN;

      if (!url || !token || url === 'your_redis_url' || token === 'your_redis_token') {
        console.warn('Cache service disabled: Upstash Redis credentials not configured');
        this.enabled = false;
        return;
      }

      this.redis = new Redis({
        url,
        token,
      });

      this.enabled = true;
      console.log('Cache service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize cache service:', error);
      this.enabled = false;
    }
  }

  /**
   * Check if cache is available and operational
   */
  async isHealthy(): Promise<boolean> {
    if (!this.enabled || !this.redis) return false;

    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      console.warn('Cache health check failed:', error);
      return false;
    }
  }

  /**
   * Get cached text embedding
   */
  async getTextEmbedding(text: string): Promise<number[] | null> {
    if (!this.enabled) return null;

    try {
      const key = CACHE_KEYS.TEXT_EMBEDDING(text);
      const cached = await this.redis!.get<number[]>(key);

      if (cached) {
        console.log(`Cache hit: text embedding for "${text.substring(0, 50)}..."`);
        return cached;
      }

      return null;
    } catch (error) {
      console.warn('Failed to get text embedding from cache:', error);
      return null;
    }
  }

  /**
   * Cache text embedding with TTL
   */
  async setTextEmbedding(text: string, embedding: number[]): Promise<void> {
    if (!this.enabled || !embedding?.length) return;

    try {
      const key = CACHE_KEYS.TEXT_EMBEDDING(text);
      await this.redis!.setex(key, DEFAULT_TTL.TEXT_EMBEDDING, embedding);
      console.log(`Cached text embedding for "${text.substring(0, 50)}..."`);
    } catch (error) {
      console.warn('Failed to cache text embedding:', error);
    }
  }

  /**
   * Get cached image embedding by checksum
   */
  async getImageEmbedding(checksum: string): Promise<number[] | null> {
    if (!this.enabled) return null;

    try {
      const key = CACHE_KEYS.IMAGE_EMBEDDING(checksum);
      const cached = await this.redis!.get<number[]>(key);

      if (cached) {
        console.log(`Cache hit: image embedding for checksum ${checksum}`);
        return cached;
      }

      return null;
    } catch (error) {
      console.warn('Failed to get image embedding from cache:', error);
      return null;
    }
  }

  /**
   * Cache image embedding by checksum (longer TTL since images are immutable)
   */
  async setImageEmbedding(checksum: string, embedding: number[]): Promise<void> {
    if (!this.enabled || !embedding?.length) return;

    try {
      const key = CACHE_KEYS.IMAGE_EMBEDDING(checksum);
      await this.redis!.setex(key, DEFAULT_TTL.IMAGE_EMBEDDING, embedding);
      console.log(`Cached image embedding for checksum ${checksum}`);
    } catch (error) {
      console.warn('Failed to cache image embedding:', error);
    }
  }

  /**
   * Get cached search results
   */
  async getSearchResults(
    userId: string,
    query: string,
    filters: Record<string, any> = {}
  ): Promise<any[] | null> {
    if (!this.enabled) return null;

    try {
      const filterKey = JSON.stringify(filters);
      const key = CACHE_KEYS.SEARCH_RESULTS(userId, query, filterKey);
      const cached = await this.redis!.get<any[]>(key);

      if (cached) {
        console.log(`Cache hit: search results for "${query}"`);
        return cached;
      }

      return null;
    } catch (error) {
      console.warn('Failed to get search results from cache:', error);
      return null;
    }
  }

  /**
   * Cache search results with TTL
   */
  async setSearchResults(
    userId: string,
    query: string,
    results: any[],
    filters: Record<string, any> = {}
  ): Promise<void> {
    if (!this.enabled || !results?.length) return;

    try {
      const filterKey = JSON.stringify(filters);
      const key = CACHE_KEYS.SEARCH_RESULTS(userId, query, filterKey);
      await this.redis!.setex(key, DEFAULT_TTL.SEARCH_RESULTS, results);
      console.log(`Cached ${results.length} search results for "${query}"`);
    } catch (error) {
      console.warn('Failed to cache search results:', error);
    }
  }

  /**
   * Get cached asset count for user
   */
  async getUserAssetCount(userId: string): Promise<number | null> {
    if (!this.enabled) return null;

    try {
      const key = CACHE_KEYS.USER_ASSETS_COUNT(userId);
      const cached = await this.redis!.get<number>(key);

      if (cached !== null) {
        console.log(`Cache hit: asset count for user ${userId}`);
        return cached;
      }

      return null;
    } catch (error) {
      console.warn('Failed to get user asset count from cache:', error);
      return null;
    }
  }

  /**
   * Cache user asset count
   */
  async setUserAssetCount(userId: string, count: number): Promise<void> {
    if (!this.enabled) return;

    try {
      const key = CACHE_KEYS.USER_ASSETS_COUNT(userId);
      await this.redis!.setex(key, DEFAULT_TTL.ASSET_METADATA, count);
      console.log(`Cached asset count (${count}) for user ${userId}`);
    } catch (error) {
      console.warn('Failed to cache user asset count:', error);
    }
  }

  /**
   * Invalidate all cached data for a user (useful after uploads/deletes)
   */
  async invalidateUserData(userId: string): Promise<void> {
    if (!this.enabled) return;

    try {
      // Get all keys that contain the user ID
      const patterns = [
        `search:${userId}:*`,
        `assets:${userId}:*`,
        `count:${userId}`,
      ];

      for (const pattern of patterns) {
        const keys = await this.redis!.keys(pattern);
        if (keys.length > 0) {
          await this.redis!.del(...keys);
          console.log(`Invalidated ${keys.length} cache entries for user ${userId}`);
        }
      }
    } catch (error) {
      console.warn('Failed to invalidate user cache:', error);
    }
  }

  /**
   * Clear all cache entries (admin function)
   */
  async clearAll(): Promise<void> {
    if (!this.enabled) return;

    try {
      await this.redis!.flushall();
      console.log('Cleared all cache entries');
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    enabled: boolean;
    healthy: boolean;
  }> {
    const stats = {
      enabled: this.enabled,
      healthy: false,
    };

    if (this.enabled && this.redis) {
      try {
        stats.healthy = await this.isHealthy();
      } catch (error) {
        console.warn('Failed to get cache stats:', error);
      }
    }

    return stats;
  }
}

// Singleton cache service instance
let cacheService: CacheService | null = null;

/**
 * Factory function to create or get singleton CacheService instance.
 * Initializes Redis connection for embedding caching if configured.
 *
 * @param config - Optional cache configuration
 * @returns CacheService instance
 */
export function createCacheService(config?: CacheConfig): CacheService {
  if (!cacheService) {
    cacheService = new CacheService(config);
  }
  return cacheService;
}

/**
 * Get existing cache service (returns null if not initialized)
 */
export function getCacheService(): CacheService | null {
  return cacheService;
}

/**
 * Simple string hash function for cache keys
 */
function hashString(str: string): string {
  let hash = 0;
  if (str.length === 0) return hash.toString(36);

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(36);
}