'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebounce } from './use-debounce';
import type { SortOption, SortDirection } from '@/components/chrome/sort-dropdown';

const STORAGE_KEY = 'sploot-sort-preferences';
const DEBOUNCE_DELAY = 100; // 100ms as specified

interface SortPreferences {
  sortBy: SortOption;
  direction: SortDirection;
  shuffleSeed?: number;
}

/**
 * Hook to manage sort preferences with localStorage persistence
 * Includes 100ms debounced writes to avoid excessive localStorage updates
 */
export function useSortPreferences() {
  // Initialize state with defaults
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [direction, setDirection] = useState<SortDirection>('desc');
  const [shuffleSeed, setShuffleSeed] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(false);

  // Debounce the preferences for localStorage writes
  const debouncedPreferences = useDebounce(
    { sortBy, direction, shuffleSeed },
    DEBOUNCE_DELAY
  );

  // Load preferences from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SortPreferences;
        // Validate the parsed data
        if (
          parsed.sortBy &&
          ['recent', 'date', 'size', 'name', 'shuffle'].includes(parsed.sortBy) &&
          parsed.direction &&
          ['asc', 'desc'].includes(parsed.direction)
        ) {
          setSortBy(parsed.sortBy);
          setDirection(parsed.direction);
          if (parsed.shuffleSeed !== undefined) {
            setShuffleSeed(parsed.shuffleSeed);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load sort preferences:', error);
      // Clear corrupted data
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
      isMountedRef.current = true;
    }
  }, []);

  // Save debounced preferences to localStorage
  useEffect(() => {
    // Skip saving on initial mount to avoid overwriting loaded preferences
    if (!isMountedRef.current || isLoading) return;

    if (typeof window === 'undefined') return;

    try {
      const preferences: SortPreferences = {
        sortBy: debouncedPreferences.sortBy,
        direction: debouncedPreferences.direction,
        shuffleSeed: debouncedPreferences.shuffleSeed,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('Failed to save sort preferences:', error);
    }
  }, [debouncedPreferences, isLoading]);

  // Handler for sort changes
  const handleSortChange = useCallback(
    (newSortBy: SortOption, newDirection: SortDirection) => {
      setSortBy(newSortBy);
      setDirection(newDirection);

      // Generate new seed when shuffle activated
      if (newSortBy === 'shuffle') {
        const newSeed = Math.floor(Math.random() * 1000000);
        setShuffleSeed(newSeed);
      } else {
        setShuffleSeed(undefined); // Clear seed for other sorts
      }
    },
    []
  );

  // Reset preferences to defaults
  const resetPreferences = useCallback(() => {
    setSortBy('recent');
    setDirection('desc');
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Map sort options to database column names for actual queries
  const getSortColumn = useCallback((option: SortOption): string => {
    switch (option) {
      case 'recent':
      case 'date':
        return 'createdAt';
      case 'size':
        return 'size';
      case 'name':
        return 'pathname';
      default:
        return 'createdAt';
    }
  }, []);

  return {
    sortBy,
    direction,
    shuffleSeed,
    isLoading,
    handleSortChange,
    resetPreferences,
    getSortColumn,
  };
}

/**
 * Type-safe sort preferences hook with default values
 * Use this when you need guaranteed non-null values
 */
export function useSortPreferencesWithDefaults() {
  const preferences = useSortPreferences();

  return {
    ...preferences,
    sortBy: preferences.sortBy || 'recent',
    direction: preferences.direction || 'desc',
  };
}