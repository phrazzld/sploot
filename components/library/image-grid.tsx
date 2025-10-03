'use client';

import { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ImageTile } from './image-tile';
import { ImageTileErrorBoundary } from './image-tile-error-boundary';
import { ImageGridSkeleton } from './image-skeleton';
import { EmptyState } from './empty-state';
import { cn } from '@/lib/utils';
import { trackBrokenImageRatio, setupCLSTracking } from '@/lib/performance-metrics';
import type { Asset } from '@/lib/types';

interface ImageGridProps {
  assets: Asset[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onAssetUpdate?: (id: string, updates: Partial<Asset>) => void;
  onAssetDelete?: (id: string) => void;
  onAssetSelect?: (asset: Asset) => void;
  containerClassName?: string;
  onScrollContainerReady?: (node: HTMLDivElement | null) => void;
  onUploadClick?: () => void;
}

export function ImageGrid({
  assets,
  loading = false,
  hasMore = false,
  onLoadMore,
  onAssetUpdate,
  onAssetDelete,
  onAssetSelect,
  containerClassName,
  onScrollContainerReady,
  onUploadClick,
}: ImageGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [showingTransition, setShowingTransition] = useState(false);
  const [brokenImageCount, setBrokenImageCount] = useState(0);
  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      onScrollContainerReady?.(node);
    },
    [onScrollContainerReady]
  );

  // Handle transition from skeleton to empty state
  useEffect(() => {
    if (!loading && assets.length === 0) {
      // Start transition: show skeleton fading out
      setShowingTransition(true);
      const timer = setTimeout(() => {
        setShowingTransition(false);
      }, 300); // Match the fade-out duration
      return () => clearTimeout(timer);
    }
  }, [loading, assets.length]);

  // Use virtual scrolling only for large collections
  // Threshold set high to avoid layout issues during normal usage
  // Virtual scrolling mainly benefits collections with 500+ items
  const USE_VIRTUAL_SCROLLING_THRESHOLD = 500;
  const useVirtualScrolling = assets.length > USE_VIRTUAL_SCROLLING_THRESHOLD;

  // Calculate columns based on container width with terminal aesthetic density
  // Dense grid for Bloomberg-style information density
  const columnCount = useMemo(() => {
    if (!containerWidth) return 1;

    // Terminal aesthetic: denser grid for more information on screen
    // Desktop (1440px+): 6 columns, Tablet (768px+): 4 columns, Mobile: 2 columns
    if (containerWidth >= 1440) return 6;
    if (containerWidth >= 1024) return 5;
    if (containerWidth >= 768) return 4;
    if (containerWidth >= 640) return 3;
    if (containerWidth >= 480) return 2;
    return 1;
  }, [containerWidth]);

  // Calculate rows based on items and columns
  const rows = useMemo(() => {
    const rowCount = Math.ceil(assets.length / columnCount);
    return Array.from({ length: rowCount }, (_, i) => {
      const start = i * columnCount;
      return assets.slice(start, start + columnCount);
    });
  }, [assets, columnCount]);

  // Virtual scrolling setup - hook must always be called
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 320, // Estimated row height (reduced since no metadata)
    overscan: 2, // Render 2 rows outside viewport
  });

  // Only use virtualizer when needed
  const activeVirtualizer = useVirtualScrolling ? virtualizer : null;

  // Update container width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Setup CLS (Cumulative Layout Shift) tracking
  // Monitors layout stability of image grid (target: CLS < 0.1)
  useEffect(() => {
    if (assets.length > 0) {
      setupCLSTracking(containerRef.current || undefined);
    }
  }, [assets.length]);

  // Track broken image ratio
  // Count images that fail to load and report metric
  useEffect(() => {
    if (assets.length === 0) return;

    // Listen for image load errors via event delegation
    const container = containerRef.current;
    if (!container) return;

    let brokenCount = 0;

    const handleImageError = (e: Event) => {
      if ((e.target as HTMLElement).tagName === 'IMG') {
        brokenCount++;
        setBrokenImageCount(brokenCount);
      }
    };

    container.addEventListener('error', handleImageError, true);

    // Report metric after initial render (throttled)
    const metricsTimer = setTimeout(() => {
      if (assets.length > 0) {
        trackBrokenImageRatio(brokenCount, assets.length);
      }
    }, 5000); // Wait 5s for images to load/fail

    return () => {
      container.removeEventListener('error', handleImageError, true);
      clearTimeout(metricsTimer);
    };
  }, [assets.length]);

  // Load more when scrolling near bottom
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !onLoadMore || !hasMore || loading) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

      if (scrollPercentage > 0.8) {
        onLoadMore();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [onLoadMore, hasMore, loading]);

  const handleFavoriteToggle = useCallback(
    (id: string, favorite: boolean) => {
      onAssetUpdate?.(id, { favorite });
    },
    [onAssetUpdate]
  );

  // Show skeleton loaders during initial load
  if (assets.length === 0 && loading) {
    return (
      <div className="h-full">
        <div
          ref={setContainerRef}
          className={cn('h-full overflow-auto p-4', containerClassName)}
          style={{ scrollbarGutter: 'stable' }}
        >
          <ImageGridSkeleton count={20} variant="tile" className="animate-fade-in" />
        </div>
      </div>
    );
  }

  // Transitioning from skeleton to empty state
  // Show skeleton fading out for smooth transition
  if (assets.length === 0 && !loading && showingTransition) {
    return (
      <div className="h-full">
        <div
          ref={setContainerRef}
          className={cn('h-full overflow-auto p-4', containerClassName)}
          style={{ scrollbarGutter: 'stable' }}
        >
          <ImageGridSkeleton
            count={20}
            variant="tile"
            className="animate-fade-out opacity-0 transition-opacity duration-300 ease-out"
          />
        </div>
      </div>
    );
  }

  // Empty state
  // Hide upload button since the main page toolbar already has a prominent one
  // Fade in after skeleton transition completes
  if (assets.length === 0 && !loading) {
    return (
      <div className="animate-fade-in">
        <EmptyState variant="first-use" onUploadClick={onUploadClick} showUploadButton={false} />
      </div>
    );
  }

  // Render simple grid for small collections
  if (!useVirtualScrolling) {
    return (
      <div className="h-full">
        <div
          ref={setContainerRef}
          className={cn('h-full overflow-auto', containerClassName)}
          style={{ scrollbarGutter: 'stable' }}
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {assets.map((asset, index) => (
              <div
                key={asset.id}
                className="transition-skeleton"
                style={{
                  animation: `fadeInScale 300ms ease-out ${index * 30}ms forwards`,
                  opacity: 0,
                }}
              >
                <ImageTileErrorBoundary asset={asset} onDelete={onAssetDelete}>
                  <ImageTile
                    asset={asset}
                    onFavorite={handleFavoriteToggle}
                    onDelete={onAssetDelete}
                    onSelect={onAssetSelect}
                    onAssetUpdate={onAssetUpdate}
                  />
                </ImageTileErrorBoundary>
              </div>
            ))}
          </div>

          {/* Loading indicator */}
          {loading && (
            <div className="py-8 text-center">
              <div className="inline-flex items-center gap-2 text-[#7C5CFF]">
                <svg
                  className="animate-spin h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span className="text-sm font-medium">Loading more...</span>
              </div>
            </div>
          )}

          {/* End of list indicator */}
          {!hasMore && assets.length > 0 && (
            <div className="py-6 text-center text-xs uppercase tracking-wide text-[#474C58]">
              no more memes in this view
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render virtualized grid for large collections
  return (
    <div className="h-full">
      <div
        ref={setContainerRef}
        className={cn('h-full overflow-auto', containerClassName)}
        style={{ scrollbarGutter: 'stable' }}
      >
        <div
          style={{
            height: activeVirtualizer!.getTotalSize(),
            width: '100%',
            position: 'relative',
          }}
        >
          {activeVirtualizer!.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) return null;

            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {row.map((asset) => (
                    <ImageTileErrorBoundary key={asset.id} asset={asset} onDelete={onAssetDelete}>
                      <ImageTile
                        asset={asset}
                        onFavorite={handleFavoriteToggle}
                        onDelete={onAssetDelete}
                        onSelect={onAssetSelect}
                        onAssetUpdate={onAssetUpdate}
                      />
                    </ImageTileErrorBoundary>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Loading indicator */}
        {loading && (
          <div className="py-8 text-center">
            <div className="inline-flex items-center gap-2 text-[#7C5CFF]">
              <svg
                className="animate-spin h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-sm font-medium">Loading more...</span>
            </div>
          </div>
        )}

        {/* End of list indicator */}
        {!hasMore && assets.length > 0 && (
          <div className="py-8 text-center">
            <p className="text-[#B3B7BE] text-sm">
              That&apos;s all your memes • {assets.length} total
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
