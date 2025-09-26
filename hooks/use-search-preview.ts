'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { getSearchCache } from '@/lib/search-cache';
import { error as logError } from '@/lib/logger';
import type { Asset } from '@/lib/types';

interface SearchPreviewOptions {
  limit?: number;
  threshold?: number;
  debounceMs?: number;
}

interface SearchPreviewResult {
  results: Asset[];
  loading: boolean;
  error: string | null;
  totalCount: number;
}

export function useSearchPreview(
  query: string,
  enabled: boolean = true,
  options: SearchPreviewOptions = {}
): SearchPreviewResult {
  const {
    limit = 5,
    threshold = 0.2,
    debounceMs = 300  // Faster than main search for quick feedback
  } = options;

  const [results, setResults] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // Use AbortController for cancelling in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounce the query with faster delay for preview
  const debouncedQuery = useDebounce(query, debounceMs);

  const fetchPreviewResults = useCallback(async (searchQuery: string) => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (!searchQuery || searchQuery.trim().length === 0) {
      setResults([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    // Check cache first
    const cache = getSearchCache();
    const cachedResult = cache.get(searchQuery, limit, threshold);

    if (cachedResult) {
      // Use cached results immediately
      setResults(cachedResult.results.slice(0, limit)); // Ensure we only show requested limit
      setTotalCount(cachedResult.total);
      setError(null);
      setLoading(false);
      return;
    }

    // Create new AbortController for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery.trim(),
          limit,
          threshold
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();

      // Only update state if this request wasn't aborted
      if (!controller.signal.aborted) {
        const results = data.results || [];
        const total = data.total || data.results?.length || 0;

        setResults(results);
        setTotalCount(total);
        setError(null);

        // Store in cache for future use
        cache.set(searchQuery, results, total, null, limit, threshold);
      }
    } catch (err: any) {
      // Ignore abort errors
      if (err.name === 'AbortError') {
        return;
      }

      logError('Search preview error:', err);

      if (!controller.signal.aborted) {
        setError(err.message || 'Failed to fetch preview results');
        setResults([]);
        setTotalCount(0);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [limit, threshold]);

  // Fetch preview results when debounced query changes
  useEffect(() => {
    if (!enabled) {
      setResults([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    if (debouncedQuery) {
      fetchPreviewResults(debouncedQuery);
    } else {
      setResults([]);
      setTotalCount(0);
      setLoading(false);
    }

    // Cleanup function to cancel request on unmount or query change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [debouncedQuery, enabled, fetchPreviewResults]);

  return {
    results,
    loading,
    error,
    totalCount
  };
}