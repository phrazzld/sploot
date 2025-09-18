'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAssets } from '@/hooks/use-assets';
import { ImageGrid } from '@/components/library/image-grid';
import { ImageGridErrorBoundary } from '@/components/library/image-grid-error-boundary';
import { MasonryGrid } from '@/components/library/masonry-grid';
import { SearchBar } from '@/components/search';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function AppPage() {
  const router = useRouter();
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'masonry' | 'compact'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('viewMode') as 'grid' | 'masonry' | 'compact') || 'grid';
    }
    return 'grid';
  });
  const [sortBy, setSortBy] = useState<'createdAt' | 'favorite' | 'size' | 'filename'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('sortBy') as 'createdAt' | 'favorite' | 'size' | 'filename') || 'createdAt';
    }
    return 'createdAt';
  });
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('sortOrder') as 'asc' | 'desc') || 'desc';
    }
    return 'desc';
  });
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [isViewModeTransitioning, setIsViewModeTransitioning] = useState(false);
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollTopRef = useRef<number | null>(null);

  // Convert filename to createdAt for the actual sorting
  const actualSortBy = sortBy === 'filename' ? 'createdAt' : sortBy;

  const {
    assets,
    loading,
    hasMore,
    total,
    loadAssets,
    updateAsset,
    deleteAsset,
  } = useAssets({
    initialLimit: 50,
    sortBy: actualSortBy,
    sortOrder,
    autoLoad: true,
  });

  // Save preferences to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('viewMode', viewMode);
    }
  }, [viewMode]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sortBy', sortBy);
      localStorage.setItem('sortOrder', sortOrder);
    }
  }, [sortBy, sortOrder]);

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

  const handleSearch = (query: string) => {
    router.push(`/app/search?q=${encodeURIComponent(query)}`);
  };

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
    (mode: 'grid' | 'masonry' | 'compact') => {
      if (mode === viewMode) return;

      captureScrollPosition();
      setIsViewModeTransitioning(true);
      setViewMode(mode);
    },
    [captureScrollPosition, viewMode]
  );

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
        'h-full overflow-auto transition-all duration-300 ease-out transform-gpu',
        isViewModeTransitioning ? 'opacity-0 scale-[0.98]' : 'opacity-100 scale-100'
      ),
    [isViewModeTransitioning]
  );

  // Sort assets by filename if needed (since API doesn't support it)
  const sortedAssets = useMemo(() => {
    if (sortBy !== 'filename') return assets;

    const sorted = [...assets].sort((a, b) => {
      const nameA = a.filename.toLowerCase();
      const nameB = b.filename.toLowerCase();

      if (sortOrder === 'asc') {
        return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
      } else {
        return nameA > nameB ? -1 : nameA < nameB ? 1 : 0;
      }
    });

    return sorted;
  }, [assets, sortBy, sortOrder]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 md:p-8 pb-0">
        <header className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[#E6E8EB]">Your Library</h1>
              <p className="text-[#B3B7BE] mt-2">
                {stats.total > 0 ? (
                  <>
                    {stats.total} {stats.total === 1 ? 'meme' : 'memes'}
                    {stats.favorites > 0 && (
                      <>
                        <span className="mx-2">•</span>
                        {stats.favorites} {stats.favorites === 1 ? 'favorite' : 'favorites'}
                      </>
                    )}
                    <span className="mx-2">•</span>
                    {stats.sizeFormatted}
                  </>
                ) : (
                  'Start building your meme collection'
                )}
              </p>
            </div>
            {/* View Controls */}
            <div className="flex flex-col gap-2">
              {/* View Mode Toggle */}
              <div className="flex gap-1 p-1 bg-[#14171A] border border-[#2A2F37] rounded-lg">
              <button
                onClick={() => handleViewModeChange('grid')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-[#7C5CFF]/20 text-[#7C5CFF]'
                    : 'text-[#B3B7BE] hover:text-[#E6E8EB]'
                }`}
                title="Grid view"
              >
                {/* Grid Icon */}
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <rect x="3" y="3" width="7" height="7" strokeWidth="2" />
                  <rect x="14" y="3" width="7" height="7" strokeWidth="2" />
                  <rect x="3" y="14" width="7" height="7" strokeWidth="2" />
                  <rect x="14" y="14" width="7" height="7" strokeWidth="2" />
                </svg>
              </button>
              <button
                onClick={() => handleViewModeChange('masonry')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'masonry'
                    ? 'bg-[#7C5CFF]/20 text-[#7C5CFF]'
                    : 'text-[#B3B7BE] hover:text-[#E6E8EB]'
                }`}
                title="Masonry view"
              >
                {/* Masonry Icon */}
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <rect x="3" y="3" width="7" height="10" strokeWidth="2" />
                  <rect x="14" y="3" width="7" height="6" strokeWidth="2" />
                  <rect x="3" y="17" width="7" height="4" strokeWidth="2" />
                  <rect x="14" y="13" width="7" height="8" strokeWidth="2" />
                </svg>
              </button>
              <button
                onClick={() => handleViewModeChange('compact')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'compact'
                    ? 'bg-[#7C5CFF]/20 text-[#7C5CFF]'
                    : 'text-[#B3B7BE] hover:text-[#E6E8EB]'
                }`}
                title="Compact view"
              >
                {/* List/Compact Icon */}
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <line x1="3" y1="6" x2="21" y2="6" strokeWidth="2" strokeLinecap="round" />
                  <line x1="3" y1="12" x2="21" y2="12" strokeWidth="2" strokeLinecap="round" />
                  <line x1="3" y1="18" x2="21" y2="18" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              </div>

              {/* Sort Dropdown */}
              <div className="relative sort-dropdown-container">
                <button
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                  className="flex items-center gap-2 px-3 py-2 bg-[#14171A] border border-[#2A2F37] rounded-lg text-sm text-[#B3B7BE] hover:text-[#E6E8EB] hover:border-[#7C5CFF] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                  <span>
                    {sortBy === 'createdAt' ? 'Date' :
                     sortBy === 'favorite' ? 'Favorites' :
                     sortBy === 'size' ? 'Size' : 'Name'}
                    {sortOrder === 'desc' ? ' ↓' : ' ↑'}
                  </span>
                </button>

                {/* Dropdown Menu */}
                {showSortDropdown && (
                  <div className="absolute right-0 mt-1 w-48 bg-[#14171A] border border-[#2A2F37] rounded-lg shadow-xl z-10">
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setSortBy('createdAt');
                          setSortOrder(sortBy === 'createdAt' && sortOrder === 'desc' ? 'asc' : 'desc');
                          setShowSortDropdown(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-[#1B1F24] transition-colors ${
                          sortBy === 'createdAt' ? 'text-[#7C5CFF]' : 'text-[#B3B7BE]'
                        }`}
                      >
                        Date {sortBy === 'createdAt' && (sortOrder === 'desc' ? '(newest)' : '(oldest)')}
                      </button>
                      <button
                        onClick={() => {
                          setSortBy('favorite');
                          setSortOrder('desc');
                          setShowSortDropdown(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-[#1B1F24] transition-colors ${
                          sortBy === 'favorite' ? 'text-[#7C5CFF]' : 'text-[#B3B7BE]'
                        }`}
                      >
                        Favorites first
                      </button>
                      <button
                        onClick={() => {
                          setSortBy('size');
                          setSortOrder(sortBy === 'size' && sortOrder === 'desc' ? 'asc' : 'desc');
                          setShowSortDropdown(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-[#1B1F24] transition-colors ${
                          sortBy === 'size' ? 'text-[#7C5CFF]' : 'text-[#B3B7BE]'
                        }`}
                      >
                        Size {sortBy === 'size' && (sortOrder === 'desc' ? '(largest)' : '(smallest)')}
                      </button>
                      <button
                        onClick={() => {
                          setSortBy('filename');
                          setSortOrder(sortBy === 'filename' && sortOrder === 'asc' ? 'desc' : 'asc');
                          setShowSortDropdown(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-[#1B1F24] transition-colors ${
                          sortBy === 'filename' ? 'text-[#7C5CFF]' : 'text-[#B3B7BE]'
                        }`}
                      >
                        Name {sortBy === 'filename' && (sortOrder === 'asc' ? '(A-Z)' : '(Z-A)')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Search Bar */}
        <div className="mb-6">
          <SearchBar onSearch={handleSearch} />
        </div>

      </div>

      {/* Image Grid - Fills remaining height */}
      <div className="flex-1 px-6 md:px-8 pb-6 md:pb-8 min-h-0">
        <div className="bg-[#14171A] border border-[#2A2F37] rounded-2xl p-6 h-full">
          <div className="h-full" style={{ maxHeight: 'calc(100vh - 320px)' }}>
            {viewMode === 'masonry' ? (
              <div
                ref={handleScrollContainerReady}
                className={gridContainerClassName}
                style={{ scrollbarGutter: 'stable' }}
              >
                <MasonryGrid
                  assets={sortedAssets}
                  loading={loading}
                  hasMore={hasMore}
                  onLoadMore={() => loadAssets()}
                  onAssetUpdate={updateAsset}
                  onAssetDelete={deleteAsset}
                  onAssetSelect={setSelectedAsset}
                />
              </div>
            ) : (
              <ImageGridErrorBoundary onRetry={() => loadAssets()}>
                <ImageGrid
                  assets={sortedAssets}
                  loading={loading}
                  hasMore={hasMore}
                  onLoadMore={() => loadAssets()}
                  onAssetUpdate={updateAsset}
                  onAssetDelete={deleteAsset}
                  onAssetSelect={setSelectedAsset}
                  containerClassName={gridContainerClassName}
                  onScrollContainerReady={handleScrollContainerReady}
                />
              </ImageGridErrorBoundary>
            )}
          </div>
        </div>
      </div>

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
            <img
              src={selectedAsset.blobUrl}
              alt={selectedAsset.filename}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
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
    </div>
  );
}
