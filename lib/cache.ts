import { LRUCache } from 'lru-cache';

// Cache configuration
const DEFAULT_TTL = {
  TEXT_EMBEDDING: 15 * 60 * 1000, // 15 minutes in ms
  IMAGE_EMBEDDING: 24 * 60 * 60 * 1000, // 24 hours in ms
  SEARCH_RESULTS: 5 * 60 * 1000, // 5 minutes in ms
  ASSET_METADATA: 30 * 60 * 1000, // 30 minutes in ms
  USER_PREFERENCES: 60 * 60 * 1000, // 1 hour in ms
} as const;

const CACHE_SIZES = {
  TEXT_EMBEDDINGS: 100, // Store 100 most recent text embeddings
  IMAGE_EMBEDDINGS: 500, // Store 500 most recent image embeddings
  SEARCH_RESULTS: 50, // Store 50 most recent search results
  ASSET_METADATA: 200, // Store 200 most recent asset metadata
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

/**
 * Simple in-memory cache service using LRU eviction.
 * Provides caching for embeddings and search results to reduce API calls.
 * This is a simplified version for MVP - can be extended with Redis later.
 */
export class CacheService {
  private textEmbeddings: LRUCache<string, number[]>;
  private imageEmbeddings: LRUCache<string, number[]>;
  private searchResults: LRUCache<string, any[]>;
  private assetMetadata: LRUCache<string, any>;
  private enabled: boolean = true;

  constructor() {
    // Initialize in-memory LRU caches
    this.textEmbeddings = new LRUCache<string, number[]>({
      max: CACHE_SIZES.TEXT_EMBEDDINGS,
      ttl: DEFAULT_TTL.TEXT_EMBEDDING,
    });

    this.imageEmbeddings = new LRUCache<string, number[]>({
      max: CACHE_SIZES.IMAGE_EMBEDDINGS,
      ttl: DEFAULT_TTL.IMAGE_EMBEDDING,
    });

    this.searchResults = new LRUCache<string, any[]>({
      max: CACHE_SIZES.SEARCH_RESULTS,
      ttl: DEFAULT_TTL.SEARCH_RESULTS,
    });

    this.assetMetadata = new LRUCache<string, any>({
      max: CACHE_SIZES.ASSET_METADATA,
      ttl: DEFAULT_TTL.ASSET_METADATA,
    });

    // In-memory cache service initialized
  }

  async isHealthy(): Promise<boolean> {
    return this.enabled;
  }

  async getTextEmbedding(text: string): Promise<number[] | null> {
    if (!this.enabled) return null;

    const key = CACHE_KEYS.TEXT_EMBEDDING(text);
    const cached = this.textEmbeddings.get(key);

    if (cached) {
      // Cache hit: text embedding
      return cached;
    }

    return null;
  }

  async setTextEmbedding(text: string, embedding: number[]): Promise<void> {
    if (!this.enabled || !embedding?.length) return;

    const key = CACHE_KEYS.TEXT_EMBEDDING(text);
    this.textEmbeddings.set(key, embedding);
    // Cached text embedding
  }

  async getImageEmbedding(checksum: string): Promise<number[] | null> {
    if (!this.enabled) return null;

    const key = CACHE_KEYS.IMAGE_EMBEDDING(checksum);
    const cached = this.imageEmbeddings.get(key);

    if (cached) {
      // Cache hit: image embedding
      return cached;
    }

    return null;
  }

  async setImageEmbedding(checksum: string, embedding: number[]): Promise<void> {
    if (!this.enabled || !embedding?.length) return;

    const key = CACHE_KEYS.IMAGE_EMBEDDING(checksum);
    this.imageEmbeddings.set(key, embedding);
    // Cached image embedding
  }

  async getSearchResults(
    userId: string,
    query: string,
    filters: Record<string, any> = {}
  ): Promise<any[] | null> {
    if (!this.enabled) return null;

    const filterKey = JSON.stringify(filters);
    const key = CACHE_KEYS.SEARCH_RESULTS(userId, query, filterKey);
    const cached = this.searchResults.get(key);

    if (cached) {
      // Cache hit: search results
      return cached;
    }

    return null;
  }

  async setSearchResults(
    userId: string,
    query: string,
    results: any[],
    filters: Record<string, any> = {}
  ): Promise<void> {
    if (!this.enabled || !results?.length) return;

    const filterKey = JSON.stringify(filters);
    const key = CACHE_KEYS.SEARCH_RESULTS(userId, query, filterKey);
    this.searchResults.set(key, results);
    // Cached search results
  }

  async getUserAssetCount(userId: string): Promise<number | null> {
    if (!this.enabled) return null;

    const key = CACHE_KEYS.USER_ASSETS_COUNT(userId);
    const cached = this.assetMetadata.get(key);

    if (cached !== null && cached !== undefined) {
      // Cache hit: asset count
      return cached;
    }

    return null;
  }

  async setUserAssetCount(userId: string, count: number): Promise<void> {
    if (!this.enabled) return;

    const key = CACHE_KEYS.USER_ASSETS_COUNT(userId);
    this.assetMetadata.set(key, count);
    // Cached asset count
  }

  /**
   * Invalidate all cached data for a user (useful after uploads/deletes)
   */
  async invalidateUserData(userId: string): Promise<void> {
    if (!this.enabled) return;

    // Clear user-specific entries from caches
    const patterns = [
      `search:${userId}:`,
      `assets:${userId}:`,
      `count:${userId}`,
    ];

    // Clear from search results cache
    for (const [key] of this.searchResults) {
      if (patterns.some(p => key.startsWith(p))) {
        this.searchResults.delete(key);
      }
    }

    // Clear from asset metadata cache
    for (const [key] of this.assetMetadata) {
      if (patterns.some(p => key.startsWith(p))) {
        this.assetMetadata.delete(key);
      }
    }

    // Invalidated user cache entries
  }

  /**
   * Clear all cache entries
   */
  async clearAll(): Promise<void> {
    if (!this.enabled) return;

    this.textEmbeddings.clear();
    this.imageEmbeddings.clear();
    this.searchResults.clear();
    this.assetMetadata.clear();
    // Cleared all cache entries
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    enabled: boolean;
    healthy: boolean;
    textEmbeddings: { size: number; max: number };
    imageEmbeddings: { size: number; max: number };
    searchResults: { size: number; max: number };
    assetMetadata: { size: number; max: number };
  }> {
    return {
      enabled: this.enabled,
      healthy: this.enabled,
      textEmbeddings: {
        size: this.textEmbeddings.size,
        max: CACHE_SIZES.TEXT_EMBEDDINGS,
      },
      imageEmbeddings: {
        size: this.imageEmbeddings.size,
        max: CACHE_SIZES.IMAGE_EMBEDDINGS,
      },
      searchResults: {
        size: this.searchResults.size,
        max: CACHE_SIZES.SEARCH_RESULTS,
      },
      assetMetadata: {
        size: this.assetMetadata.size,
        max: CACHE_SIZES.ASSET_METADATA,
      },
    };
  }
}

// Singleton cache service instance
let cacheService: CacheService | null = null;

/**
 * Factory function to create or get singleton CacheService instance.
 * @returns CacheService instance
 */
export function createCacheService(): CacheService {
  if (!cacheService) {
    cacheService = new CacheService();
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