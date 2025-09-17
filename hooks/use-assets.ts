'use client';

import { useState, useCallback, useEffect } from 'react';
import { error } from '@/lib/logger';

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
}

interface UseAssetsOptions {
  initialLimit?: number;
  sortBy?: 'createdAt' | 'favorite' | 'size';
  sortOrder?: 'asc' | 'desc';
  filterFavorites?: boolean;
  autoLoad?: boolean;
}

export function useAssets(options: UseAssetsOptions = {}) {
  const {
    initialLimit = 50,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    filterFavorites,
    autoLoad = true,
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
          ...(filterFavorites !== undefined && { favorite: filterFavorites.toString() }),
        });

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
        error('Error loading assets:', err);
        setError(err instanceof Error ? err.message : 'Failed to load assets');
      } finally {
        setLoading(false);
      }
    },
    [loading, hasMore, offset, initialLimit, sortBy, sortOrder, filterFavorites]
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
export function useSearchAssets(query: string, options: { limit?: number } = {}) {
  const { limit = 50 } = options;

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const search = useCallback(async () => {
    if (!query.trim()) {
      setAssets([]);
      setTotal(0);
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
          threshold: 0.5,
        }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setAssets(data.results || []);
      setTotal(data.total || 0);
    } catch (err) {
      error('Search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
      setAssets([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [query, limit]);

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

  // Auto-search when query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) {
        search();
      } else {
        setAssets([]);
        setTotal(0);
      }
    }, 300); // Debounce

    return () => clearTimeout(timer);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    assets,
    loading,
    error,
    total,
    search,
    updateAsset,
    deleteAsset,
  };
}