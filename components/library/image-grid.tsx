'use client';

import { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ImageTile } from './image-tile';
import { ImageTileErrorBoundary } from './image-tile-error-boundary';
import { ImageGridSkeleton } from './image-skeleton';
import { EmptyState } from './empty-state';
import { cn } from '@/lib/utils';
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
  const USE_VIRTUAL_SCROLLING_THRESHOLD = 100;
  const useVirtualScrolling = assets.length > USE_VIRTUAL_SCROLLING_THRESHOLD;

  // Calculate columns based on container width
  const columnCount = useMemo(() => {
    if (!containerWidth) return 1;

    const ITEM_WIDTH = 280;
    const GAP = 4;
    const MIN_COLUMNS = 1;
    const MAX_COLUMNS = 5;

    const availableWidth = containerWidth;
    const columns = Math.floor((availableWidth + GAP) / (ITEM_WIDTH + GAP));

    return Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, columns));
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
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5">
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
                <div
                  className="grid gap-1"
                  style={{
                    gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
                  }}
                >
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
                  {/* Empty cells for last row */}
                  {virtualRow.index === rows.length - 1 &&
                    row.length < columnCount &&
                    Array.from({ length: columnCount - row.length }).map((_, i) => (
                      <div key={`empty-${i}`} />
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
