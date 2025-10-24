/**
 * Cache types and interfaces for unified caching system
 * Supports memory, Redis, and Vercel KV backends via strategy pattern
 */

/**
 * Backend strategy interface for cache implementations
 * Allows swapping between memory, Redis, Vercel KV without changing business logic
 */
export interface ICacheBackend {
  /**
   * Retrieve a value from the cache
   * @param key - Cache key to lookup
   * @returns Cached value or null if not found/expired
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Store a value in the cache
   * @param key - Cache key to store under
   * @param value - Value to cache
   * @param ttl - Optional TTL in milliseconds (overrides backend default)
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * Remove a value from the cache
   * @param key - Cache key to delete
   * @returns True if key existed and was deleted
   */
  delete(key: string): Promise<boolean>;

  /**
   * Clear cache entries
   * @param namespace - Optional namespace prefix to clear (e.g., 'txt:', 'img:')
   *                    If undefined, clears all cache entries
   */
  clear(namespace?: string): Promise<void>;
}

/**
 * Cache performance statistics
 * Used for monitoring cache effectiveness and debugging
 */
export interface CacheStats {
  /** Number of cache hits (successful retrievals) */
  hits: number;

  /** Number of cache misses (lookups that returned null) */
  misses: number;

  /** Total cache requests (hits + misses) */
  totalRequests: number;

  /** Hit rate as decimal (hits / totalRequests) */
  hitRate: number;

  /** Timestamp when stats were last reset */
  lastReset: Date;
}

/**
 * Search filters for cache key generation
 * Uses Record<string, any> to match existing multi-layer-cache.ts implementation
 * Filters are serialized to JSON for cache key generation
 */
export type SearchFilters = Record<string, any>;
