'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Image from 'next/image';
import { useAssets, useSearchAssets } from '@/hooks/use-assets';
import { ImageGrid } from '@/components/library/image-grid';
import { ImageGridErrorBoundary } from '@/components/library/image-grid-error-boundary';
import { ImageList } from '@/components/library/image-list';
import { SearchBar, SearchLoadingScreen } from '@/components/search';
import { cn } from '@/lib/utils';
import { UploadZone } from '@/components/upload/upload-zone';
import { HeartIcon } from '@/components/icons/heart-icon';
import { showToast } from '@/components/ui/toast';
import { getEmbeddingQueueManager } from '@/lib/embedding-queue';
import type { EmbeddingQueueItem } from '@/lib/embedding-queue';
import { useKeyboardShortcut, useSearchShortcut, useSlashSearchShortcut } from '@/hooks/use-keyboard-shortcut';
import { CommandPalette, useCommandPalette } from '@/components/chrome/command-palette';
import { useSortPreferences } from '@/hooks/use-sort-preferences';
import { useFilter } from '@/contexts/filter-context';
import { ViewModeToggle, type ViewMode } from '@/components/chrome/view-mode-toggle';

export default function AppPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryParam = searchParams.get('q') ?? '';

  // Use filter context for centralized filter state
  const {
    filterType,
    tagId: tagIdParam,
    tagName: contextTagName,
    isFavoritesOnly: favoritesOnly,
    isRecentFilter,
    toggleFavorites,
    clearTagFilter,
    setTagFilter,
  } = useFilter();
  const viewModeParam = searchParams.get('view') as ViewMode | null;
  const viewMode = viewModeParam || 'grid'; // Default to grid if not specified

  const [isClient, setIsClient] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // Command palette state
  const { isOpen: isCommandPaletteOpen, openPalette, closePalette } = useCommandPalette();

  // Use sort preferences hook with localStorage persistence and debouncing
  const { sortBy, direction: sortOrder, handleSortChange, getSortColumn } = useSortPreferences();
  const [failedEmbeddings, setFailedEmbeddings] = useState<EmbeddingQueueItem[]>([]);
  const [showRetryModal, setShowRetryModal] = useState(false);
  const [retryProgress, setRetryProgress] = useState({ current: 0, total: 0, processing: false });

  // Local state for search query (separate from URL to prevent remounts)
  const [localSearchQuery, setLocalSearchQuery] = useState<string>(queryParam);
  const isTypingRef = useRef<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Use local state for search, URL for persistence/sharing
  const libraryQuery = localSearchQuery;
  const [isViewModeTransitioning, setIsViewModeTransitioning] = useState(false);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollTopRef = useRef<number | null>(null);
  const filtersRef = useRef<{
    tagId: string | null;
    favorites: boolean;
    sortBy: string;
    sortDirection: string;
  } | undefined>(undefined);
  const pendingRefreshRef = useRef<boolean>(false);

  // Get the actual database column for sorting
  // When recent filter is active, always sort by createdAt desc
  const actualSortBy = isRecentFilter ? 'createdAt' : getSortColumn(sortBy);
  const actualSortOrder = isRecentFilter ? 'desc' : sortOrder;

  // Sync URL parameter to local state (for browser navigation)
  // but NOT during typing to prevent sync loops
  useEffect(() => {
    if (!isTypingRef.current) {
      setLocalSearchQuery(queryParam);
    }
  }, [queryParam]);

  // Removed useEffect that was causing circular updates - URL params are now the single source of truth
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

  const uploadParam = searchParams.get('upload');

  useEffect(() => {
    if (uploadParam === '1') {
      setShowUploadPanel(true);
      updateUrlParams({ upload: null });
    }
  }, [uploadParam, updateUrlParams]);

  const {
    assets,
    loading,
    hasMore,
    total,
    loadAssets,
    updateAsset,
    deleteAsset,
    refresh,
  } = useAssets({
    initialLimit: 100,
    sortBy: actualSortBy as 'createdAt' | 'size' | 'favorite' | undefined,
    sortOrder: actualSortOrder as 'asc' | 'desc',
    autoLoad: true,
    filterFavorites: favoritesOnly ? true : undefined,
    tagId: tagIdParam ?? undefined,
  });

  // Listen for asset upload events and refresh the library
  useEffect(() => {
    const handleAssetUploaded = (event: CustomEvent) => {
      console.log('[Library] Asset uploaded, refreshing...', event.detail);

      // Refresh the asset list
      refresh();

      // Show a subtle notification that library was refreshed
      if (event.detail?.filename) {
        showToast(`${event.detail.filename} added to library`, 'success');
      }
    };

    // Listen for the custom event from upload zone
    window.addEventListener('assetUploaded', handleAssetUploaded as EventListener);

    return () => {
      window.removeEventListener('assetUploaded', handleAssetUploaded as EventListener);
    };
  }, [refresh]);

  const {
    assets: searchAssets,
    loading: searchLoading,
    error: searchError,
    updateAsset: updateSearchAsset,
    deleteAsset: deleteSearchAsset,
    search: runInlineSearch,
    metadata: searchMetadata,
  } = useSearchAssets(libraryQuery, { limit: 50, threshold: 0.2 });

  // Set isClient flag once mounted
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Global keyboard shortcut to focus search (Cmd+K / Ctrl+K)
  const focusSearchBar = useCallback(() => {
    // Focus the search input using a query selector since we can't easily pass refs through all components
    const searchInput = document.querySelector('[data-search-bar] input') as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
      searchInput.select(); // Select all text for quick replacement
    }
  }, []);

  // Replace search shortcut with command palette
  useSearchShortcut(openPalette);

  // Also add "/" key shortcut to focus search
  useSlashSearchShortcut(focusSearchBar);

  // Mark as client-side mounted
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.sort-dropdown-container')) {
        setShowSortDropdown(false);
      }
    };

    if (showSortDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSortDropdown]);

  // Monitor failed embeddings
  useEffect(() => {
    const checkFailedEmbeddings = () => {
      const manager = getEmbeddingQueueManager();
      const failed = manager.getFailedItems();
      setFailedEmbeddings(failed);
    };

    // Check immediately
    checkFailedEmbeddings();

    // Check periodically
    const interval = setInterval(checkFailedEmbeddings, 5000);

    // Subscribe to queue events
    const unsubscribe = getEmbeddingQueueManager().subscribe((event) => {
      if (event.type === 'failed' || event.type === 'completed') {
        checkFailedEmbeddings();
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  // Handle bulk retry
  const handleBulkRetry = useCallback(() => {
    const manager = getEmbeddingQueueManager();
    const failedItems = manager.getFailedItems();

    if (failedItems.length === 0) return;

    setShowRetryModal(true);
    setRetryProgress({ current: 0, total: failedItems.length, processing: true });

    // Track progress
    const unsubscribe = manager.subscribe((event) => {
      if (event.type === 'completed' || event.type === 'failed') {
        const failed = manager.getFailedItems();
        const completed = failedItems.length - failed.length;
        setRetryProgress((prev) => ({ ...prev, current: completed }));

        // Close modal when all done
        if (completed >= failedItems.length || failed.length === 0) {
          setTimeout(() => {
            setShowRetryModal(false);
            setRetryProgress({ current: 0, total: 0, processing: false });
            showToast(
              `✓ Retried ${completed} ${completed === 1 ? 'meme' : 'memes'}`,
              'success'
            );
          }, 1000);
        }
      }
    });

    // Trigger retry
    manager.retryFailed();

    // Cleanup after 30 seconds (safety timeout)
    const timeout = setTimeout(() => {
      unsubscribe();
      setShowRetryModal(false);
      setRetryProgress({ current: 0, total: 0, processing: false });
    }, 30000);

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  // Calculate stats
  const stats = useMemo(() => {
    const favoriteCount = assets.filter(a => a.favorite).length;
    const totalSize = assets.reduce((sum, asset) => sum + (asset.size || 0), 0);

    // Format file size
    const formatSize = (bytes: number) => {
      if (bytes === 0) return '0 B';
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    };

    return {
      total,
      favorites: favoriteCount,
      sizeFormatted: formatSize(totalSize)
    };
  }, [assets, total]);

  const filteredSearchAssets = useMemo(() => {
    let results = searchAssets;
    if (favoritesOnly) {
      results = results.filter((asset) => asset.favorite);
    }
    if (tagIdParam) {
      results = results.filter((asset) => asset.tags?.some((tag) => tag.id === tagIdParam));
    }
    return results;
  }, [searchAssets, favoritesOnly, tagIdParam]);

  const searchHitCount = filteredSearchAssets.length;

  // Update tag name when we have the asset data
  useEffect(() => {
    if (!tagIdParam || contextTagName) return;
    const fromAssets = [...assets, ...searchAssets].find((asset) =>
      asset.tags?.some((tag) => tag.id === tagIdParam)
    );
    const tagName = fromAssets?.tags?.find((tag) => tag.id === tagIdParam)?.name ?? null;
    if (tagName && tagName !== contextTagName) {
      setTagFilter(tagIdParam, tagName);
    }
  }, [assets, searchAssets, tagIdParam, contextTagName, setTagFilter]);

  const activeTagName = contextTagName;

  const handleInlineSearch = useCallback((searchCommand: { query: string; timestamp: number; updateUrl?: boolean }) => {
    const query = searchCommand.query;

    // Always update local state immediately for instant search
    setLocalSearchQuery(query);

    // Set typing flag and clear it after delay
    isTypingRef.current = true;
    setTimeout(() => {
      isTypingRef.current = false;
    }, 1000);

    // Update URL only when explicitly requested (on Enter key)
    if (searchCommand.updateUrl === true) {
      updateUrlParams({ q: query ? query : null });
    }
  }, [updateUrlParams]);

  // Use filter actions from context (they handle URL updates internally)
  const toggleFavoritesOnly = toggleFavorites;

  const handleScrollContainerReady = useCallback((node: HTMLDivElement | null) => {
    gridScrollRef.current = node;
  }, []);

  const captureScrollPosition = useCallback(() => {
    if (gridScrollRef.current) {
      pendingScrollTopRef.current = gridScrollRef.current.scrollTop;
      return;
    }

    if (typeof document !== 'undefined' && document.scrollingElement) {
      pendingScrollTopRef.current = (document.scrollingElement as HTMLElement).scrollTop;
      return;
    }

    if (typeof window !== 'undefined') {
      pendingScrollTopRef.current = window.scrollY;
    }
  }, []);

  const restoreScrollPosition = useCallback(() => {
    if (pendingScrollTopRef.current == null) return;

    const docScrollElement =
      typeof document !== 'undefined' ? (document.scrollingElement as HTMLElement | null) : null;
    const target = gridScrollRef.current || docScrollElement;

    const desiredTop = pendingScrollTopRef.current;
    pendingScrollTopRef.current = null;

    if (target) {
      target.scrollTo({ top: desiredTop });
      return;
    }

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: desiredTop });
    }
  }, []);

  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      if (mode === viewMode) return;

      captureScrollPosition();
      setIsViewModeTransitioning(true);

      // Update URL params to include view mode
      const params = new URLSearchParams(searchParams.toString());
      params.set('view', mode);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [captureScrollPosition, viewMode, searchParams, pathname, router]
  );

  // Number key shortcuts for view mode switching with debouncing
  const viewModeSwitchRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const handleViewModeShortcut = useCallback((mode: ViewMode) => {
    // Clear any existing timeout
    if (viewModeSwitchRef.current) {
      clearTimeout(viewModeSwitchRef.current);
    }

    // Debounce for 100ms to prevent rapid switching
    viewModeSwitchRef.current = setTimeout(() => {
      handleViewModeChange(mode);
    }, 100);
  }, [handleViewModeChange]);

  // Key 1 for grid view
  useKeyboardShortcut({
    key: '1',
    callback: () => handleViewModeShortcut('grid'),
    enabled: true,
  });

  // Key 2 for list view
  useKeyboardShortcut({
    key: '2',
    callback: () => handleViewModeShortcut('list'),
    enabled: true,
  });

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (viewModeSwitchRef.current) {
        clearTimeout(viewModeSwitchRef.current);
      }
    };
  }, []);

  useEffect(() => {
    restoreScrollPosition();
  }, [viewMode, restoreScrollPosition]);

  useEffect(() => {
    if (!isViewModeTransitioning) return;

    const frame = window.requestAnimationFrame(() => {
      setIsViewModeTransitioning(false);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isViewModeTransitioning]);

  const gridContainerClassName = useMemo(
    () =>
      cn(
        'h-full overflow-y-auto overflow-x-hidden transition-opacity duration-200 ease-in-out',
        isViewModeTransitioning ? 'opacity-0' : 'opacity-100'
      ),
    [isViewModeTransitioning]
  );

  // Sort assets by filename if needed (since API doesn't support it)
  const sortedAssets = useMemo(() => {
    // Only apply client-side sorting for filename since DB doesn't sort by it
    if (sortBy !== 'name') return assets;

    const sorted = [...assets].sort((a, b) => {
      const nameA = a.filename.toLowerCase();
      const nameB = b.filename.toLowerCase();

      if (actualSortOrder === 'asc') {
        return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
      } else {
        return nameA > nameB ? -1 : nameA < nameB ? 1 : 0;
      }
    });

    return sorted;
  }, [assets, sortBy, actualSortOrder]);

  const trimmedLibraryQuery = libraryQuery.trim();
  const isSearching = trimmedLibraryQuery.length > 0;

  const activeAssets = useMemo(() => {
    if (isSearching) {
      return filteredSearchAssets;
    }
    return sortedAssets;
  }, [isSearching, filteredSearchAssets, sortedAssets]);

  const activeLoading = isSearching ? searchLoading : loading;
  const activeHasMore = hasMore;

  const handleLoadMore = useCallback(() => {
    loadAssets();
  }, [loadAssets]);

  const handleAssetUpdate = useCallback(
    (id: string, updates: Partial<(typeof assets)[number]>) => {
      updateAsset(id, updates);
      updateSearchAsset(id, updates);
    },
    [updateAsset, updateSearchAsset]
  );

  const handleAssetDelete = useCallback(
    (id: string) => {
      deleteAsset(id);
      deleteSearchAsset(id);
    },
    [deleteAsset, deleteSearchAsset]
  );

  // Trigger refresh when filters or sort preferences change
  useEffect(() => {
    const prev = filtersRef.current;
    const current = {
      tagId: tagIdParam ?? null,
      favorites: favoritesOnly,
      sortBy: actualSortBy,
      sortDirection: actualSortOrder as 'asc' | 'desc',
    };

    if (!prev) {
      filtersRef.current = current;
      return;
    }

    const filtersChanged =
      prev.tagId !== current.tagId ||
      prev.favorites !== current.favorites ||
      prev.sortBy !== current.sortBy ||
      prev.sortDirection !== current.sortDirection;

    if (filtersChanged) {
      if (isSearching) {
        pendingRefreshRef.current = true;
      } else {
        refresh();
        pendingRefreshRef.current = false;
      }
    } else if (!isSearching && pendingRefreshRef.current) {
      refresh();
      pendingRefreshRef.current = false;
    }

    filtersRef.current = current;
  }, [tagIdParam, favoritesOnly, actualSortBy, actualSortOrder, isSearching, refresh]);

  useEffect(() => {
    if (!trimmedLibraryQuery) {
      return;
    }
    setSelectedAsset(null);
  }, [trimmedLibraryQuery]);

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      {/* Container with ultra-wide support - max-width at 1920px+ */}
      <div className="px-6 pb-6 pt-6 md:px-10 2xl:px-12 border-b border-[#1B1F24]">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1920px]">
          <header className="flex flex-col gap-4">
            {/* Title bar with inline stats */}
            <div className="flex items-baseline gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold text-[#E6E8EB]">your library</h1>
              {stats.total > 0 && (
                <span className="text-sm text-[#6A6E78]">
                  • {stats.total} {stats.total === 1 ? 'meme' : 'memes'}
                  {stats.favorites > 0 && (
                    <>
                      {' '}• {stats.favorites}{' '}
                      {stats.favorites === 1 ? 'banger' : 'bangers'}
                    </>
                  )}
                  {' '}• {stats.sizeFormatted}
                </span>
              )}
            </div>

            {/* Search bar - hero element */}
            <SearchBar
              onSearch={handleInlineSearch}
              inline
              initialQuery={queryParam}
              searchState={
                searchLoading ? 'loading' :
                  isTypingRef.current ? 'typing' :
                    libraryQuery && searchAssets.length > 0 ? 'success' :
                      libraryQuery && searchAssets.length === 0 ? 'no-results' :
                        searchError ? 'error' :
                          'idle'
              }
              resultCount={searchAssets.length}
              className="w-full"
              placeholder="search your memes..."
              autoFocus={false}
            />

            {/* Action toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Left group: Primary actions */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadPanel((prev) => !prev)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C5CFF]',
                    showUploadPanel
                      ? 'bg-[#7C5CFF]/20 text-[#CBB8FF] ring-1 ring-[#7C5CFF]/40'
                      : 'bg-[#7C5CFF] text-white hover:bg-[#6B4FE0]'
                  )}
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 4v12M4 10h12" />
                  </svg>
                  {showUploadPanel ? 'close' : 'upload'}
                </button>
                {failedEmbeddings.length > 0 && (
                  <button
                    type="button"
                    onClick={handleBulkRetry}
                    className="inline-flex items-center gap-2 rounded-full border border-[#FF4D4D]/40 bg-[#251014] px-4 py-2 text-sm font-medium text-[#FF8C9B] transition-colors hover:border-[#FF4D4D]/60 hover:bg-[#351419] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4D4D]"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    retry failed searches ({failedEmbeddings.length} {failedEmbeddings.length === 1 ? 'image' : 'images'})
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleFavoritesOnly}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C5CFF]',
                    favoritesOnly
                      ? 'border-[#FF8AD6]/50 bg-[#FF64C5]/15 text-[#FF8AD6]'
                      : 'border-[#2A2F37] bg-[#14171A] text-[#B3B7BE] hover:text-[#E6E8EB]'
                  )}
                >
                  <HeartIcon className="h-4 w-4" filled={favoritesOnly} />
                  {favoritesOnly ? 'bangers' : 'all'}
                </button>
              </div>

              {/* Right group: View controls */}
              <div className="flex flex-wrap items-center gap-2">
                <ViewModeToggle
                  value={viewMode}
                  onChange={handleViewModeChange}
                  size="md"
                  showLabels={false}
                />

                <div className="relative sort-dropdown-container">
                  <button
                    type="button"
                    onClick={() => setShowSortDropdown((prev) => !prev)}
                    className="flex items-center gap-2 rounded-full border border-[#2A2F37] bg-[#14171A] px-4 py-2 text-sm text-[#B3B7BE] transition-colors hover:border-[#464C55] hover:text-[#E6E8EB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C5CFF]"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h12M4 12h8m-8 6h4m6-6l4-4m0 0l4 4m-4-4v10" />
                    </svg>
                    <span className="hidden sm:inline">
                      {sortBy === 'recent' || sortBy === 'date' ? 'date' : sortBy === 'size' ? 'size' : sortBy === 'name' ? 'name' : 'date'}
                    </span>
                    <span>{sortOrder === 'desc' ? '↓' : '↑'}</span>
                  </button>

                  {showSortDropdown && (
                    <div className="absolute right-0 z-10 mt-2 w-48 overflow-hidden rounded-2xl border border-[#2A2F37] bg-[#0F1216] shadow-2xl">
                      <div className="py-1">
                        <button
                          onClick={() => {
                            handleSortChange('date', sortBy === 'date' && sortOrder === 'desc' ? 'asc' : 'desc');
                            setShowSortDropdown(false);
                          }}
                          className={cn(
                            'block w-full px-4 py-2 text-left text-sm transition-colors hover:bg-[#1B1F24]',
                            sortBy === 'date' || sortBy === 'recent' ? 'text-[#7C5CFF]' : 'text-[#B3B7BE]'
                          )}
                        >
                          date {(sortBy === 'date' || sortBy === 'recent') && (sortOrder === 'desc' ? '(newest)' : '(oldest)')}
                        </button>
                        <button
                          onClick={() => {
                            handleSortChange('size', sortBy === 'size' && sortOrder === 'desc' ? 'asc' : 'desc');
                            setShowSortDropdown(false);
                          }}
                          className={cn(
                            'block w-full px-4 py-2 text-left text-sm transition-colors hover:bg-[#1B1F24]',
                            sortBy === 'size' ? 'text-[#7C5CFF]' : 'text-[#B3B7BE]'
                          )}
                        >
                          size {sortBy === 'size' && (sortOrder === 'desc' ? '(largest)' : '(smallest)')}
                        </button>
                        <button
                          onClick={() => {
                            handleSortChange('name', sortBy === 'name' && sortOrder === 'asc' ? 'desc' : 'asc');
                            setShowSortDropdown(false);
                          }}
                          className={cn(
                            'block w-full px-4 py-2 text-left text-sm transition-colors hover:bg-[#1B1F24]',
                            sortBy === 'name' ? 'text-[#7C5CFF]' : 'text-[#B3B7BE]'
                          )}
                        >
                          name {sortBy === 'name' && (sortOrder === 'asc' ? '(a-z)' : '(z-a)')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {tagIdParam && (
                  <button
                    type="button"
                    onClick={clearTagFilter}
                    className="inline-flex items-center gap-1 rounded-full border border-[#2A2F37] bg-[#14171A] px-3 py-2 text-sm text-[#B3B7BE] transition-colors hover:border-[#464C55] hover:text-[#E6E8EB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C5CFF]"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="hidden sm:inline">clear</span>
                    <span className="text-[#7C5CFF]">#{activeTagName ?? 'tag'}</span>
                  </button>
                )}
              </div>

            </div>

            {(!isSearching && (favoritesOnly || tagIdParam)) && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#B3B7BE]">
                {favoritesOnly && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#14151C] px-3 py-1 text-[#FF8AD6]">
                    <HeartIcon className="h-3.5 w-3.5" filled />
                    banger hoard engaged
                  </span>
                )}
                {tagIdParam && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#14151C] px-3 py-1">
                    filtering tag <span className="font-medium text-[#E6E8EB]">#{activeTagName ?? tagIdParam.slice(0, 6)}</span>
                  </span>
                )}
              </div>
            )}

            {showUploadPanel && (
              <div className="rounded-3xl border border-dashed border-[#2A2F37] bg-[#111419] p-5">
                <UploadZone
                  isOnDashboard={true}
                  onUploadComplete={(stats) => {
                    // Refresh the gallery
                    refresh();

                    // Show success toast
                    if (stats.uploaded > 0 && stats.duplicates > 0) {
                      showToast(
                        `✓ ${stats.uploaded} ${stats.uploaded === 1 ? 'meme' : 'memes'} added, ${stats.duplicates} already existed`,
                        'success'
                      );
                    } else if (stats.uploaded > 0) {
                      showToast(
                        `✓ ${stats.uploaded} ${stats.uploaded === 1 ? 'meme' : 'memes'} added to your vault`,
                        'success'
                      );
                    } else if (stats.duplicates > 0) {
                      showToast(
                        `${stats.duplicates} ${stats.duplicates === 1 ? 'image' : 'images'} already in your vault`,
                        'info'
                      );
                    }

                    // Optionally close the upload panel after a delay
                    // setTimeout(() => setShowUploadPanel(false), 2000);
                  }}
                />
              </div>
            )}

            {isSearching && (
              <div className="space-y-3">
                {searchError && (
                  <div className="rounded-2xl border border-[#FF4D4D]/30 bg-[#251014] p-4 text-sm text-[#FF8C9B]">
                    {searchError}
                  </div>
                )}

                {!searchError && !searchLoading && filteredSearchAssets.length > 0 && (
                  <div className="rounded-2xl border border-[#2A2F37] bg-[#14171A] p-4 text-sm text-[#B3B7BE]">
                    <span className="flex flex-col gap-1">
                      <span>
                        showing <span className="font-semibold text-[#B6FF6E]">{searchHitCount}</span> matches for &quot;<span className="font-medium text-[#E6E8EB]">{trimmedLibraryQuery}</span>&quot;.
                      </span>
                      {searchMetadata?.thresholdFallback && (
                        <span className="text-xs text-[#FFAA5C]">
                          pulled a few low-sim homies so your vibes aren&apos;t empty.
                        </span>
                      )}
                    </span>
                  </div>
                )}

                {!searchError && !searchLoading && searchHitCount === 0 && (
                  <div className="rounded-2xl border border-[#2A2F37] bg-[#14171A] p-4 text-sm text-[#B3B7BE]">
                    no matches yet for &quot;<span className="font-medium text-[#E6E8EB]">{trimmedLibraryQuery}</span>&quot;. remix the prompt and try again.
                  </div>
                )}
              </div>
            )}
          </header>
        </div>
      </div>

      {/* Show loading screen when search is executing */}
      {searchLoading && libraryQuery ? (
        <SearchLoadingScreen query={libraryQuery} />
      ) : (
        <div className="flex-1 overflow-hidden">
          <div className="mx-auto flex h-full w-full flex-col overflow-hidden 2xl:max-w-[1920px]">
            <div className="h-full flex-1 overflow-hidden">
              {viewMode === 'list' ? (
                <ImageList
                  assets={activeAssets}
                  loading={activeLoading}
                  hasMore={activeHasMore}
                  onLoadMore={handleLoadMore}
                  onAssetUpdate={handleAssetUpdate}
                  onAssetDelete={handleAssetDelete}
                  onAssetSelect={setSelectedAsset}
                  onScrollContainerReady={handleScrollContainerReady}
                  containerClassName={cn(gridContainerClassName, 'w-full')}
                  onUploadClick={() => setShowUploadPanel(true)}
                />
              ) : (
                <ImageGridErrorBoundary
                  onRetry={isSearching ? () => runInlineSearch() : () => loadAssets()}
                >
                  <ImageGrid
                    assets={activeAssets}
                    loading={activeLoading}
                    hasMore={activeHasMore}
                    onLoadMore={handleLoadMore}
                    onAssetUpdate={handleAssetUpdate}
                    onAssetDelete={handleAssetDelete}
                    onAssetSelect={setSelectedAsset}
                    containerClassName={cn(gridContainerClassName, 'w-full')}
                    onScrollContainerReady={handleScrollContainerReady}
                    onUploadClick={() => setShowUploadPanel(true)}
                  />
                </ImageGridErrorBoundary>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {selectedAsset && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedAsset(null)}
        >
          <div
            className="max-w-4xl max-h-[90vh] relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full h-full">
              <Image
                src={selectedAsset.blobUrl}
                alt={selectedAsset.filename}
                width={1920}
                height={1080}
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
                priority
              />
            </div>
            <button
              onClick={() => setSelectedAsset(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="absolute bottom-4 left-4 right-4 bg-black/50 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white font-medium">{selectedAsset.filename}</p>
              <p className="text-white/80 text-sm mt-1">
                {selectedAsset.width}×{selectedAsset.height} • {selectedAsset.mime.split('/')[1].toUpperCase()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Retry Progress Modal */}
      {showRetryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#14171A] border border-[#2A2F37] rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-[#E6E8EB] mb-4">
              regenerating embeddings
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="36"
                      stroke="#2A2F37"
                      strokeWidth="8"
                      fill="none"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="36"
                      stroke="#7C5CFF"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={226}
                      strokeDashoffset={226 - (226 * retryProgress.current) / retryProgress.total}
                      className="transition-all duration-500 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-[#E6E8EB]">
                      {retryProgress.current}/{retryProgress.total}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#B3B7BE]">progress</span>
                  <span className="text-[#E6E8EB] font-medium">
                    {Math.round((retryProgress.current / retryProgress.total) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-[#1F2328] rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-[#7C5CFF] to-[#BAFF39] h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${(retryProgress.current / retryProgress.total) * 100}%` }}
                  />
                </div>
              </div>

              {retryProgress.processing && (
                <p className="text-sm text-[#B3B7BE] text-center animate-pulse">
                  processing embeddings...
                </p>
              )}

              {!retryProgress.processing && retryProgress.current === retryProgress.total && (
                <p className="text-sm text-[#B6FF6E] text-center font-medium">
                  ✓ all embeddings regenerated
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={closePalette}
        onUpload={() => router.push('/app/upload')}
        onSignOut={() => window.location.href = '/api/auth/signout'}
      />
    </div>
  );
}
