'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { FilterType } from '@/components/chrome/filter-chips';

interface FilterContextType {
  // Core filter state
  filterType: FilterType;
  tagId: string | null;
  tagName: string | null;

  // Derived states
  isFavoritesOnly: boolean;
  isRecentFilter: boolean;
  hasActiveFilters: boolean;

  // Actions
  setFilterType: (type: FilterType) => void;
  setTagFilter: (tagId: string | null, tagName?: string | null) => void;
  toggleFavorites: () => void;
  clearAllFilters: () => void;
  clearTagFilter: () => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

interface FilterProviderProps {
  children: React.ReactNode;
}

/**
 * Filter Provider that manages all filter state and syncs with URL params
 * Provides centralized filter management for navbar, footer, and content components
 */
export function FilterProvider({ children }: FilterProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse initial state from URL params
  const urlFavorite = searchParams.get('favorite') === 'true';
  const urlFilter = searchParams.get('filter');
  const urlTagId = searchParams.get('tagId');

  // Determine initial filter type from URL params
  // Priority: favorite param > filter param > default 'all'
  const initialFilterType: FilterType = urlFavorite
    ? 'favorites'
    : urlFilter === 'recent'
    ? 'recent'
    : 'all';

  // Core state
  const [filterType, setFilterTypeState] = useState<FilterType>(initialFilterType);
  const [tagId, setTagIdState] = useState<string | null>(urlTagId);
  const [tagName, setTagName] = useState<string | null>(null);

  // Sync filter type with URL params when they change
  useEffect(() => {
    const newFavorite = searchParams.get('favorite') === 'true';
    const newFilter = searchParams.get('filter');
    const newTagId = searchParams.get('tagId');

    // Priority: favorite param > filter param > default 'all'
    const newFilterType: FilterType = newFavorite
      ? 'favorites'
      : newFilter === 'recent'
      ? 'recent'
      : 'all';
    setFilterTypeState(newFilterType);
    setTagIdState(newTagId);
  }, [searchParams]);

  // Helper to update URL params
  const updateUrlParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });

      const target = `${pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      router.replace(target, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Set filter type and sync with URL
  const setFilterType = useCallback(
    (type: FilterType) => {
      setFilterTypeState(type);

      // Update URL params based on filter type
      const updates: Record<string, string | null> = {};

      // Clear both params first
      updates.favorite = null;
      updates.filter = null;

      // Set appropriate param based on type
      if (type === 'favorites') {
        updates.favorite = 'true';
      } else if (type === 'recent') {
        updates.filter = 'recent';
      }
      // 'all' clears both params (already done above)

      updateUrlParams(updates);
    },
    [updateUrlParams]
  );

  // Set tag filter
  const setTagFilter = useCallback(
    (newTagId: string | null, newTagName?: string | null) => {
      setTagIdState(newTagId);
      setTagName(newTagName ?? null);
      updateUrlParams({ tagId: newTagId });
    },
    [updateUrlParams]
  );

  // Toggle favorites filter
  const toggleFavorites = useCallback(() => {
    setFilterType(filterType === 'favorites' ? 'all' : 'favorites');
  }, [filterType, setFilterType]);

  // Clear tag filter
  const clearTagFilter = useCallback(() => {
    setTagFilter(null, null);
  }, [setTagFilter]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setFilterType('all');
    setTagFilter(null, null);
  }, [setFilterType, setTagFilter]);

  // Derived states
  const isFavoritesOnly = filterType === 'favorites';
  const isRecentFilter = filterType === 'recent';
  const hasActiveFilters = filterType !== 'all' || tagId !== null;

  const value: FilterContextType = {
    // Core state
    filterType,
    tagId,
    tagName,

    // Derived states
    isFavoritesOnly,
    isRecentFilter,
    hasActiveFilters,

    // Actions
    setFilterType,
    setTagFilter,
    toggleFavorites,
    clearAllFilters,
    clearTagFilter,
  };

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

/**
 * Hook to access filter context
 * Must be used within FilterProvider
 */
export function useFilter() {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilter must be used within a FilterProvider');
  }
  return context;
}

/**
 * Hook to get just the filter state (read-only)
 * Useful for components that only need to read filter state
 */
export function useFilterState() {
  const { filterType, tagId, tagName, isFavoritesOnly, isRecentFilter, hasActiveFilters } = useFilter();
  return {
    filterType,
    tagId,
    tagName,
    isFavoritesOnly,
    isRecentFilter,
    hasActiveFilters,
  };
}

/**
 * Hook to get just the filter actions
 * Useful for components that only need to modify filters
 */
export function useFilterActions() {
  const { setFilterType, setTagFilter, toggleFavorites, clearAllFilters, clearTagFilter } = useFilter();
  return {
    setFilterType,
    setTagFilter,
    toggleFavorites,
    clearAllFilters,
    clearTagFilter,
  };
}