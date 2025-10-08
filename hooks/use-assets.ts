'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { error as logError } from '@/lib/logger';
import { getSearchCache } from '@/lib/search-cache';
import type { Asset, UseAssetsOptions } from '@/lib/types';

export function useAssets(options: UseAssetsOptions = {}) {
  const {
    initialLimit = 50,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    filterFavorites,
    autoLoad = true,
    tagId,
  } = options;

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [integrityIssue, setIntegrityIssue] = useState(false);
  const integrityCheckDoneRef = useRef(false);

  // Use refs to avoid stale closures
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const hasLoadedRef = useRef(false); // Track if initial load has been attempted
  const abortControllerRef = useRef<AbortController | null>(null);

  // Keep hasMore ref in sync with state
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  const loadAssets = useCallback(
    async (reset = false) => {
      // Use refs to check current state without causing recreations
      if (loadingRef.current || (!hasMoreRef.current && !reset)) return;

      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      loadingRef.current = true;
      setLoading(true);
      setError(null);

      // Create new AbortController for this request
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const currentOffset = reset ? 0 : offset;
        const params = new URLSearchParams({
          limit: initialLimit.toString(),
          offset: currentOffset.toString(),
          sortBy,
          sortOrder,
        });

        // Debug logging in development
        if (process.env.NODE_ENV === 'development') {
          console.log('[useAssets] Loading assets:', {
            reset,
            offset: currentOffset,
            limit: initialLimit,
            sortBy,
            sortOrder,
            filterFavorites,
            tagId,
          });
        }

        if (filterFavorites !== undefined) {
          params.set('favorite', filterFavorites.toString());
        }

        if (tagId) {
          params.set('tagId', tagId);
        }

        const response = await fetch(`/api/assets?${params}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          // Extract error details from response for better debugging
          let errorMessage = 'Failed to fetch assets';
          let errorDetails = null;

          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
            errorDetails = errorData;
          } catch {
            // Response wasn't JSON, use generic message
          }

          // Log comprehensive error info (development only)
          if (process.env.NODE_ENV === 'development') {
            console.error('[useAssets] API error:', {
              status: response.status,
              statusText: response.statusText,
              message: errorMessage,
              details: errorDetails,
              url: response.url,
            });
          }

          // Throw with specific message based on status code
          const statusMessages: Record<number, string> = {
            401: 'Unauthorized - Please sign in',
            403: 'Forbidden - Access denied',
            404: 'API endpoint not found',
            500: 'Server error - Please try again',
            503: 'Service unavailable - Database may be offline',
          };

          const specificMessage = statusMessages[response.status]
            || `${errorMessage} (HTTP ${response.status})`;

          throw new Error(specificMessage);
        }

        const data = await response.json();

        // Debug logging in development
        if (process.env.NODE_ENV === 'development') {
          console.log('[useAssets] API response:', {
            assetCount: data.assets?.length || 0,
            total: data.pagination?.total,
            hasMore: data.pagination?.hasMore,
            reset,
          });
        }

        // Only update state if this request wasn't aborted
        if (controller.signal.aborted) return;

        if (reset) {
          setAssets(data.assets || []);
          setOffset(initialLimit);
        } else {
          setAssets((prev) => [...prev, ...(data.assets || [])]);
          setOffset((prev) => prev + initialLimit);
        }

        setTotal(data.pagination?.total || 0);
        setHasMore(data.pagination?.hasMore || false);
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        // Log error for debugging
        if (process.env.NODE_ENV === 'development') {
          console.error('[useAssets] Error loading assets:', err);
        }
        logError('Error loading assets:', err);

        // Only update error state if this request wasn't aborted
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to load assets');
        }
      } finally {
        // Only update loading state if this request wasn't aborted
        if (!controller.signal.aborted) {
          loadingRef.current = false;
          setLoading(false);
        }
      }
    },
    [offset, initialLimit, sortBy, sortOrder, filterFavorites, tagId] // Removed loading and hasMore from dependencies
  );

  const updateAsset = useCallback((id: string, updates: Partial<Asset>) => {
    setAssets((prev) =>
      prev.map((asset) => {
        if (asset.id !== id) return asset;

        // Check if any values actually changed to avoid creating new reference
        let hasChanges = false;
        for (const key in updates) {
          if (updates[key as keyof Asset] !== asset[key as keyof Asset]) {
            hasChanges = true;
            break;
          }
        }

        // Return same reference if nothing changed (prevents unnecessary re-renders)
        if (!hasChanges) return asset;

        // Only create new object if values actually changed
        return { ...asset, ...updates };
      })
    );
  }, []);

  const deleteAsset = useCallback((id: string) => {
    setAssets((prev) => prev.filter((asset) => asset.id !== id));
    setTotal((prev) => Math.max(0, prev - 1));
  }, []);

  const refresh = useCallback(() => {
    setOffset(0);
    setHasMore(true);
    return loadAssets(true);
  }, [loadAssets]);

  // Validate asset integrity on first load
  useEffect(() => {
    if (assets.length > 0 && !integrityCheckDoneRef.current) {
      integrityCheckDoneRef.current = true;

      // Sample first 10 assets
      const sample = assets.slice(0, 10);

      // Validate blob URLs
      const brokenCount = sample.filter(asset => {
        const url = asset.blobUrl;
        // Check if URL is properly formatted and not empty
        if (!url || typeof url !== 'string' || url.trim() === '') {
          return true; // Broken
        }
        // Check if URL looks like a valid blob URL
        try {
          new URL(url);
          // Vercel blob URLs typically contain 'vercel-storage' or 'blob.vercel-storage.com'
          if (!url.includes('blob') && !url.includes('vercel')) {
            return true; // Suspicious URL
          }
          return false; // Valid
        } catch {
          return true; // Invalid URL format
        }
      }).length;

      const brokenPercentage = (brokenCount / sample.length) * 100;

      if (brokenPercentage > 50) {
        console.warn(
          `[Asset Integrity] ${brokenCount}/${sample.length} assets have invalid blob URLs (${brokenPercentage.toFixed(1)}%)`
        );
        setIntegrityIssue(true);
      }
    }
  }, [assets]);

  // Auto-load on mount if enabled
  // Use hasLoadedRef to prevent infinite loop when library is empty
  useEffect(() => {
    if (autoLoad && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadAssets(true);
    }
  }, [autoLoad, loadAssets]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    assets,
    loading,
    hasMore,
    error,
    total,
    integrityIssue,
    loadAssets,
    updateAsset,
    deleteAsset,
    refresh,
  };
}

// Hook for searching assets
interface SearchMetadata {
  limit: number;
  requestedLimit: number;
  threshold: number;
  requestedThreshold: number;
  thresholdFallback: boolean;
  latencyMs?: number;
}

export function useSearchAssets(query: string, options: { limit?: number; threshold?: number; enabled?: boolean } = {}) {
  const { limit = 50, threshold = 0.2, enabled = true } = options;

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [metadata, setMetadata] = useState<SearchMetadata | null>(null);

  // Use AbortController for cancelling in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null);

  const search = useCallback(async () => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (!query.trim()) {
      setAssets([]);
      setTotal(0);
      setMetadata(null);
      return;
    }

    // Check cache first
    const cache = getSearchCache();
    const cachedResult = cache.get(query, limit, threshold);

    if (cachedResult) {
      // Use cached results immediately
      setAssets(cachedResult.results);
      setTotal(cachedResult.total);
      setMetadata(cachedResult.metadata);
      setError(null);
      setLoading(false);
      return;
    }

    // Create new AbortController for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    const startTime = performance.now();

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          limit,
          threshold,
        }),
        signal: controller.signal,
      });

      const data = await response.json();
      const endTime = performance.now();
      const latencyMs = Math.round(endTime - startTime);

      if (!response.ok) {
        // Only update state if this request wasn't aborted
        if (!controller.signal.aborted) {
          // Check if the error is related to embeddings/search service
          const errorMessage = data.error || 'Search failed';
          if (errorMessage.includes('embedding') || errorMessage.includes('Replicate')) {
            setError('Search is temporarily unavailable. Images may still be processing.');
          } else {
            setError(errorMessage);
          }
          setAssets([]);
          setTotal(0);
          setMetadata(null);
        }
        return;
      }

      // Only update state if this request wasn't aborted
      if (!controller.signal.aborted) {
        // Handle successful response
        const results = data.results || [];
        const total = data.total || 0;
        const searchMetadata = {
          limit: data.limit ?? limit,
          requestedLimit: data.requestedLimit ?? limit,
          threshold: data.threshold ?? threshold,
          requestedThreshold: data.requestedThreshold ?? threshold,
          thresholdFallback: Boolean(data.thresholdFallback),
          latencyMs,
        };

        setAssets(results);
        setTotal(total);
        setMetadata(searchMetadata);

        // Store in cache for future use
        cache.set(query, results, total, searchMetadata, limit, threshold);

        // Clear any previous errors on success
        setError(null);
      }
    } catch (err: any) {
      // Ignore abort errors
      if (err.name === 'AbortError') {
        return;
      }

      // Only update state if this request wasn't aborted
      if (!controller.signal.aborted) {
        logError('Search error:', err);
        setError('Unable to search. Please try again.');
        setAssets([]);
        setTotal(0);
        setMetadata(null);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [query, limit, threshold]);

  const updateAsset = useCallback((id: string, updates: Partial<Asset>) => {
    setAssets((prev) =>
      prev.map((asset) => {
        if (asset.id !== id) return asset;

        // Check if any values actually changed to avoid creating new reference
        let hasChanges = false;
        for (const key in updates) {
          if (updates[key as keyof Asset] !== asset[key as keyof Asset]) {
            hasChanges = true;
            break;
          }
        }

        // Return same reference if nothing changed (prevents unnecessary re-renders)
        if (!hasChanges) return asset;

        // Only create new object if values actually changed
        return { ...asset, ...updates };
      })
    );
  }, []);

  const deleteAsset = useCallback((id: string) => {
    setAssets((prev) => prev.filter((asset) => asset.id !== id));
    setTotal((prev) => Math.max(0, prev - 1));
  }, []);

  // Auto-search when query changes - no debouncing here as SearchBar handles it
  useEffect(() => {
    if (enabled && query) {
      search();
    } else if (!enabled || !query) {
      setAssets([]);
      setTotal(0);
      setError(null);
    }

    // Cleanup function to cancel request on unmount or query change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, enabled, search]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    assets,
    loading,
    error,
    total,
    search,
    updateAsset,
    deleteAsset,
    metadata,
  };
}
