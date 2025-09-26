/**
 * Search Result Cache with TTL support
 * Stores search results in memory with automatic expiration
 */

import type { Asset } from '@/lib/types';

interface CacheEntry {
  query: string;
  results: Asset[];
  total: number;
  timestamp: number;
  metadata?: any;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds (default: 5 minutes)
  maxSize?: number; // Maximum number of entries (default: 100)
}

class SearchCache {
  private cache: Map<string, CacheEntry>;
  private ttl: number;
  private maxSize: number;

  constructor(options: CacheOptions = {}) {
    this.cache = new Map();
    this.ttl = options.ttl ?? 5 * 60 * 1000; // 5 minutes default
    this.maxSize = options.maxSize ?? 100;
  }

  /**
   * Generate cache key from query and additional parameters
   */
  private generateKey(query: string, limit?: number, threshold?: number): string {
    const normalizedQuery = query.toLowerCase().trim();
    return `${normalizedQuery}_${limit ?? 'default'}_${threshold ?? 'default'}`;
  }

  /**
   * Check if a cache entry is still valid based on TTL
   */
  private isValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < this.ttl;
  }

  /**
   * Get cached results for a query
   */
  get(query: string, limit?: number, threshold?: number): CacheEntry | null {
    const key = this.generateKey(query, limit, threshold);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry is still valid
    if (!this.isValid(entry)) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (LRU behavior)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry;
  }

  /**
   * Store search results in cache
   */
  set(
    query: string,
    results: Asset[],
    total: number,
    metadata?: any,
    limit?: number,
    threshold?: number
  ): void {
    const key = this.generateKey(query, limit, threshold);

    // Enforce max size limit (remove oldest entries)
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      query,
      results,
      total,
      timestamp: Date.now(),
      metadata,
    });
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear expired entries
   */
  cleanExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= this.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    ttl: number;
    maxSize: number;
    entries: Array<{ query: string; age: number }>;
  } {
    const now = Date.now();
    return {
      size: this.cache.size,
      ttl: this.ttl,
      maxSize: this.maxSize,
      entries: Array.from(this.cache.values()).map((entry) => ({
        query: entry.query,
        age: now - entry.timestamp,
      })),
    };
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  invalidatePattern(pattern: string | RegExp): number {
    let deleted = 0;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    for (const [key, entry] of this.cache.entries()) {
      if (regex.test(entry.query)) {
        this.cache.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Update TTL for future entries
   */
  setTTL(ttl: number): void {
    this.ttl = ttl;
  }
}

// Create singleton instance
let searchCacheInstance: SearchCache | null = null;

/**
 * Get or create the search cache instance
 */
export function getSearchCache(options?: CacheOptions): SearchCache {
  if (!searchCacheInstance) {
    searchCacheInstance = new SearchCache(options);

    // Set up periodic cleanup of expired entries (every minute)
    if (typeof window !== 'undefined') {
      setInterval(() => {
        searchCacheInstance?.cleanExpired();
      }, 60 * 1000);
    }
  }

  return searchCacheInstance;
}

/**
 * Clear the search cache
 */
export function clearSearchCache(): void {
  searchCacheInstance?.clear();
}

/**
 * Get search cache statistics
 */
export function getSearchCacheStats() {
  return searchCacheInstance?.getStats() ?? {
    size: 0,
    ttl: 0,
    maxSize: 0,
    entries: [],
  };
}