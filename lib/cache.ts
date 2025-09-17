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
        // Cache service disabled: Upstash Redis credentials not configured
        this.enabled = false;
        return;
      }

      this.redis = new Redis({
        url,
        token,
      });

      this.enabled = true;
      // Cache service initialized successfully
    } catch (error) {
      // Failed to initialize cache service
      this.enabled = false;
    }
  }

  async isHealthy(): Promise<boolean> {
    if (!this.enabled || !this.redis) return false;

    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      // Cache health check failed
      return false;
    }
  }

  async getTextEmbedding(text: string): Promise<number[] | null> {
    if (!this.enabled) return null;

    try {
      const key = CACHE_KEYS.TEXT_EMBEDDING(text);
      const cached = await this.redis!.get<number[]>(key);

      if (cached) {
        // Cache hit: text embedding
        return cached;
      }

      return null;
    } catch (error) {
      // Failed to get text embedding from cache
      return null;
    }
  }

  async setTextEmbedding(text: string, embedding: number[]): Promise<void> {
    if (!this.enabled || !embedding?.length) return;

    try {
      const key = CACHE_KEYS.TEXT_EMBEDDING(text);
      await this.redis!.setex(key, DEFAULT_TTL.TEXT_EMBEDDING, embedding);
      // Cached text embedding
    } catch (error) {
      // Failed to cache text embedding
    }
  }

  async getImageEmbedding(checksum: string): Promise<number[] | null> {
    if (!this.enabled) return null;

    try {
      const key = CACHE_KEYS.IMAGE_EMBEDDING(checksum);
      const cached = await this.redis!.get<number[]>(key);

      if (cached) {
        // Cache hit: image embedding
        return cached;
      }

      return null;
    } catch (error) {
      // Failed to get image embedding from cache
      return null;
    }
  }

  // Images are immutable, use longer TTL
  async setImageEmbedding(checksum: string, embedding: number[]): Promise<void> {
    if (!this.enabled || !embedding?.length) return;

    try {
      const key = CACHE_KEYS.IMAGE_EMBEDDING(checksum);
      await this.redis!.setex(key, DEFAULT_TTL.IMAGE_EMBEDDING, embedding);
      // Cached image embedding
    } catch (error) {
      // Failed to cache image embedding
    }
  }

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
        // Cache hit: search results
        return cached;
      }

      return null;
    } catch (error) {
      // Failed to get search results from cache
      return null;
    }
  }

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
      // Cached search results
    } catch (error) {
      // Failed to cache search results
    }
  }

  async getUserAssetCount(userId: string): Promise<number | null> {
    if (!this.enabled) return null;

    try {
      const key = CACHE_KEYS.USER_ASSETS_COUNT(userId);
      const cached = await this.redis!.get<number>(key);

      if (cached !== null) {
        // Cache hit: asset count
        return cached;
      }

      return null;
    } catch (error) {
      // Failed to get user asset count from cache
      return null;
    }
  }

  async setUserAssetCount(userId: string, count: number): Promise<void> {
    if (!this.enabled) return;

    try {
      const key = CACHE_KEYS.USER_ASSETS_COUNT(userId);
      await this.redis!.setex(key, DEFAULT_TTL.ASSET_METADATA, count);
      // Cached asset count
    } catch (error) {
      // Failed to cache user asset count
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
          // Invalidated cache entries
        }
      }
    } catch (error) {
      // Failed to invalidate user cache
    }
  }

  /**
   * Clear all cache entries (admin function)
   */
  async clearAll(): Promise<void> {
    if (!this.enabled) return;

    try {
      await this.redis!.flushall();
      // Cleared all cache entries
    } catch (error) {
      // Failed to clear cache
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
        // Failed to get cache stats
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