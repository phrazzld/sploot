'use client';

import { Suspense } from 'react';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Image from 'next/image';
import { useAssets, useSearchAssets } from '@/hooks/use-assets';
import { ImageGrid } from '@/components/library/image-grid';
import { ImageGridErrorBoundary } from '@/components/library/image-grid-error-boundary';
import { AssetIntegrityBanner } from '@/components/library/asset-integrity-banner';
import { SearchBar, SearchLoadingScreen, SimilarityScoreLegend, QuerySyntaxIndicator } from '@/components/search';
import { cn } from '@/lib/utils';
import { UploadZone } from '@/components/upload/upload-zone';
import { Heart } from 'lucide-react';
import { showToast } from '@/components/ui/toast';
import { getEmbeddingQueueManager } from '@/lib/embedding-queue';
import type { EmbeddingQueueItem } from '@/lib/embedding-queue';
import { useKeyboardShortcut, useSearchShortcut, useSlashSearchShortcut } from '@/hooks/use-keyboard-shortcut';
import { CommandPalette, useCommandPalette } from '@/components/chrome/command-palette';
import { KeyboardShortcutsHelp, useKeyboardShortcutsHelp } from '@/components/chrome/keyboard-shortcuts-help';
import { useSortPreferences } from '@/hooks/use-sort-preferences';
import { useFilter } from '@/contexts/filter-context';
import { UploadButton } from '@/components/chrome/upload-button';
import { FilterChips, type FilterType } from '@/components/chrome/filter-chips';
import { SortDropdown } from '@/components/chrome/sort-dropdown';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RotateCcw, X } from 'lucide-react';

function AppPageClient() {
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
    toggleFavorites,
    clearTagFilter,
    setTagFilter,
  } = useFilter();

  const [isClient, setIsClient] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [showMetadata, setShowMetadata] = useState(false);

  // Command palette state
  const { isOpen: isCommandPaletteOpen, openPalette, closePalette } = useCommandPalette();

  // Keyboard shortcuts help state
  const { isOpen: isHelpOpen, openHelp, closeHelp } = useKeyboardShortcutsHelp();

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
  const actualSortBy = getSortColumn(sortBy);
  const actualSortOrder = sortOrder;

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
    integrityIssue,
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
        showToast(`[COMPLETE] Indexed: ${event.detail.filename}`, 'complete', 3000);
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
              `[COMPLETE] Retried ${completed} ${completed === 1 ? 'meme' : 'memes'}`,
              'complete',
              3000
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

  // ? for keyboard shortcuts help
  useKeyboardShortcut({
    key: '?',
    callback: openHelp,
    enabled: true,
  });

  const gridContainerClassName = 'h-full overflow-y-auto overflow-x-hidden';

  // Sort assets by filename or shuffle if needed (since API doesn't support these)
  const sortedAssets = useMemo(() => {
    // Shuffle: Fisher-Yates algorithm with persistent seed
    if (sortBy === 'shuffle') {
      // Use a seed based on assets length and first asset ID for consistency during session
      const seed = assets.length > 0 ? assets[0].id.charCodeAt(0) + assets.length : 0;

      // Seeded random number generator
      let s = seed;
      const seededRandom = () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
      };

      const shuffled = [...assets];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }

    // Name sorting: client-side since DB doesn't support it
    if (sortBy === 'name') {
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
    }

    // All other sorts handled by API
    return assets;
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

  // Reset metadata visibility when modal opens/closes
  useEffect(() => {
    setShowMetadata(false);
  }, [selectedAsset]);

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      {/* Container with ultra-wide support - max-width at 1920px+ */}
      <div className="px-6 pb-6 pt-6 md:px-10 2xl:px-12 border-b border-[#1B1F24]">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1920px]">
          <header className="flex flex-col gap-4">
            {/* Title bar with inline stats */}
            <div className="flex items-baseline gap-2 flex-wrap">
              <h1 className="font-mono text-2xl text-[#E6E8EB]">your library</h1>
              {stats.total > 0 && (
                <span className="text-sm text-[#888888] font-mono flex items-center gap-2">
                  <span>{stats.total} <span className="text-[#666666]">ASSETS</span></span>
                  {stats.favorites > 0 && (
                    <>
                      <span className="text-[#333333]">|</span>
                      <span>{stats.favorites} <span className="text-[#666666]">BANGERS</span></span>
                    </>
                  )}
                  <span className="text-[#333333]">|</span>
                  <span>{stats.sizeFormatted}</span>
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
                <UploadButton
                  onClick={() => setShowUploadPanel((prev) => !prev)}
                  isActive={showUploadPanel}
                  size="lg"
                  showLabel={true}
                />
                {failedEmbeddings.length > 0 && (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleBulkRetry}
                    className="gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    retry ({failedEmbeddings.length})
                  </Button>
                )}
                <FilterChips
                  activeFilter={favoritesOnly ? 'favorites' : 'all'}
                  onFilterChange={(filter) => {
                    if (filter === 'favorites') {
                      if (!favoritesOnly) toggleFavoritesOnly();
                    } else if (filter === 'all') {
                      if (favoritesOnly) toggleFavoritesOnly();
                    }
                  }}
                  size="lg"
                  showLabels={true}
                />
              </div>

              {/* Right group: View controls */}
              <div className="flex flex-wrap items-center gap-2">
                <SortDropdown
                  value={sortBy === 'recent' ? 'recent' : sortBy as any}
                  direction={sortOrder}
                  onChange={handleSortChange}
                />

                {tagIdParam && (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={clearTagFilter}
                    className="gap-1"
                  >
                    <X className="h-4 w-4" />
                    <span className="hidden sm:inline">clear</span>
                    <span>#{activeTagName ?? 'tag'}</span>
                  </Button>
                )}
              </div>

            </div>

            {(!isSearching && (favoritesOnly || tagIdParam)) && (
              <div className="flex flex-wrap items-center gap-2">
                {favoritesOnly && (
                  <Badge variant="outline" className="gap-1">
                    <Heart className="h-3.5 w-3.5" fill="currentColor" strokeWidth={2} />
                    bangers only
                  </Badge>
                )}
                {tagIdParam && (
                  <Badge variant="outline" className="gap-2">
                    filtering tag <span className="font-medium">#{activeTagName ?? tagIdParam.slice(0, 6)}</span>
                  </Badge>
                )}
              </div>
            )}

            {showUploadPanel && (
              <div className="border border-dashed border-[#2A2F37] bg-[#111419] p-5">
                <UploadZone
                  isOnDashboard={true}
                  onUploadComplete={(stats) => {
                    // Refresh the gallery
                    refresh();

                    // Show brief success toast
                    if (stats.uploaded > 0) {
                      showToast(
                        `✓ ${stats.uploaded} ${stats.uploaded === 1 ? 'file' : 'files'} uploaded`,
                        'success',
                        2000
                      );
                    }

                    // Auto-close upload panel after brief delay
                    setTimeout(() => setShowUploadPanel(false), 2000);
                  }}
                />
              </div>
            )}

            {isSearching && (
              <div className="space-y-3">
                {/* Query Syntax Indicator */}
                {!searchError && !searchLoading && (
                  <QuerySyntaxIndicator
                    query={trimmedLibraryQuery}
                    resultCount={searchHitCount}
                    filters={{
                      favorites: favoritesOnly || undefined,
                      tagName: activeTagName || undefined,
                    }}
                    latencyMs={searchMetadata?.latencyMs}
                  />
                )}

                {searchError && (
                  <Alert variant="destructive">
                    <AlertDescription>{searchError}</AlertDescription>
                  </Alert>
                )}

                {!searchError && !searchLoading && filteredSearchAssets.length > 0 && (
                  <>
                    <Alert>
                      <AlertDescription className="flex flex-col gap-1">
                        <span>
                          showing <span className="font-semibold">{searchHitCount}</span> matches for &quot;<span className="font-medium">{trimmedLibraryQuery}</span>&quot;
                        </span>
                        {searchMetadata?.thresholdFallback && (
                          <span className="text-xs text-muted-foreground">
                            pulled a few low-similarity results to avoid empty results.
                          </span>
                        )}
                      </AlertDescription>
                    </Alert>
                    <SimilarityScoreLegend />
                  </>
                )}

                {!searchError && !searchLoading && searchHitCount === 0 && (
                  <Alert>
                    <AlertDescription>
                      no matches yet for &quot;<span className="font-medium">{trimmedLibraryQuery}</span>&quot;. try adjusting your search.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </header>
        </div>
      </div>

      {/* Asset integrity warning banner */}
      {integrityIssue && !libraryQuery && (
        <AssetIntegrityBanner
          onAudit={() => {
            // Open audit endpoint in new tab
            window.open('/api/assets/audit', '_blank');
          }}
        />
      )}

      {/* Show loading screen when search is executing */}
      {searchLoading && libraryQuery ? (
        <SearchLoadingScreen query={libraryQuery} />
      ) : (
        <div className="flex-1 overflow-hidden">
          <div className="mx-auto flex h-full w-full flex-col overflow-hidden 2xl:max-w-[1920px]">
            <div className="h-full flex-1 overflow-hidden">
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
                  showSimilarityScores={isSearching}
                />
              </ImageGridErrorBoundary>
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
            onMouseMove={() => setShowMetadata(true)}
            onMouseLeave={() => setShowMetadata(false)}
          >
            <div className="relative w-full h-full">
              <Image
                src={selectedAsset.blobUrl}
                alt={selectedAsset.filename}
                width={1920}
                height={1080}
                className="max-w-full max-h-[90vh] object-contain"
                priority
              />
            </div>
            <button
              onClick={() => setSelectedAsset(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className={cn(
              "absolute bottom-4 left-4 right-4 bg-black/50 backdrop-blur-sm p-4 transition-opacity duration-300",
              showMetadata ? 'opacity-100' : 'opacity-0'
            )}>
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
          <div className="bg-[#14171A] border border-[#2A2F37] p-6 max-w-sm w-full shadow-2xl">
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
                <div className="w-full bg-[#1F2328] h-2 overflow-hidden">
                  <div
                    className="bg-[var(--color-terminal-green)] h-full transition-all duration-500 ease-out"
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

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp
        isOpen={isHelpOpen}
        onClose={closeHelp}
      />
    </div>
  );
}

export default function AppPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[calc(100vh-56px)] flex-col items-center justify-center">
        <div className="text-[#B3B7BE]">Loading...</div>
      </div>
    }>
      <AppPageClient />
    </Suspense>
  );
}
