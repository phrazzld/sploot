'use client';

import { useState, useCallback, useEffect } from 'react';
import { error as logError } from '@/lib/logger';

interface Asset {
  id: string;
  blobUrl: string;
  pathname: string;
  filename: string;
  mime: string;
  size: number;
  width?: number | null;
  height?: number | null;
  favorite: boolean;
  createdAt: Date | string;
  tags?: Array<{ id: string; name: string }>;
  similarity?: number;
  relevance?: number;
  belowThreshold?: boolean;
}

interface UseAssetsOptions {
  initialLimit?: number;
  sortBy?: 'createdAt' | 'favorite' | 'size';
  sortOrder?: 'asc' | 'desc';
  filterFavorites?: boolean;
  autoLoad?: boolean;
  tagId?: string;
}

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

  const loadAssets = useCallback(
    async (reset = false) => {
      if (loading || (!hasMore && !reset)) return;

      setLoading(true);
      setError(null);

      try {
        const currentOffset = reset ? 0 : offset;
        const params = new URLSearchParams({
          limit: initialLimit.toString(),
          offset: currentOffset.toString(),
          sortBy,
          sortOrder,
        });

        if (filterFavorites !== undefined) {
          params.set('favorite', filterFavorites.toString());
        }

        if (tagId) {
          params.set('tagId', tagId);
        }

        const response = await fetch(`/api/assets?${params}`);

        if (!response.ok) {
          throw new Error('Failed to fetch assets');
        }

        const data = await response.json();

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
        logError('Error loading assets:', err);
        setError(err instanceof Error ? err.message : 'Failed to load assets');
      } finally {
        setLoading(false);
      }
    },
    [loading, hasMore, offset, initialLimit, sortBy, sortOrder, filterFavorites, tagId]
  );

  const updateAsset = useCallback((id: string, updates: Partial<Asset>) => {
    setAssets((prev) =>
      prev.map((asset) =>
        asset.id === id ? { ...asset, ...updates } : asset
      )
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

  // Auto-load on mount if enabled
  useEffect(() => {
    if (autoLoad && assets.length === 0 && !loading) {
      loadAssets(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    assets,
    loading,
    hasMore,
    error,
    total,
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
}

export function useSearchAssets(query: string, options: { limit?: number; threshold?: number } = {}) {
  const { limit = 50, threshold = 0.2 } = options;

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [metadata, setMetadata] = useState<SearchMetadata | null>(null);

  const search = useCallback(async () => {
    if (!query.trim()) {
      setAssets([]);
      setTotal(0);
      setMetadata(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          limit,
          threshold,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
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
        return;
      }

      // Handle successful response
      setAssets(data.results || []);
      setTotal(data.total || 0);
      setMetadata({
        limit: data.limit ?? limit,
        requestedLimit: data.requestedLimit ?? limit,
        threshold: data.threshold ?? threshold,
        requestedThreshold: data.requestedThreshold ?? threshold,
        thresholdFallback: Boolean(data.thresholdFallback),
      });

      // Clear any previous errors on success
      setError(null);
    } catch (err) {
      logError('Search error:', err);
      setError('Unable to search. Please try again.');
      setAssets([]);
      setTotal(0);
      setMetadata(null);
    } finally {
      setLoading(false);
    }
  }, [query, limit, threshold]);

  const updateAsset = useCallback((id: string, updates: Partial<Asset>) => {
    setAssets((prev) =>
      prev.map((asset) =>
        asset.id === id ? { ...asset, ...updates } : asset
      )
    );
  }, []);

  const deleteAsset = useCallback((id: string) => {
    setAssets((prev) => prev.filter((asset) => asset.id !== id));
    setTotal((prev) => Math.max(0, prev - 1));
  }, []);

  // Auto-search when query changes - no debouncing here as SearchBar handles it
  useEffect(() => {
    if (query) {
      search();
    } else {
      setAssets([]);
      setTotal(0);
      setError(null);
    }
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

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
