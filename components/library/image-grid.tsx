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
  showSimilarityScores?: boolean;
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
  showSimilarityScores = false,
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

  // Calculate grid row span for each asset based on aspect ratio
  const getRowSpan = useCallback((asset: Asset) => {
    // Action bar adds ~43px height (py-1.5 padding + h-7 button + border)
    // With gridAutoRows: 10px, this equals ~5 rows
    const ACTION_BAR_ROWS = 5;

    if (!asset.width || !asset.height || asset.width <= 0 || asset.height <= 0) {
      return 35; // Default for missing dimensions (~300px image + ~50px action bar)
    }

    const aspectRatio = asset.height / asset.width;
    // Base row count is 30 (for ~300px tall at 1:1 aspect)
    // Multiply by aspect ratio to get appropriate image height
    const imageRows = Math.ceil(aspectRatio * 30);

    // Add action bar height to prevent overlapping tiles
    const totalRows = imageRows + ACTION_BAR_ROWS;

    // Clamp to reasonable bounds (min 20 for very wide, max 65 for very tall)
    return Math.max(20, Math.min(totalRows, 65));
  }, []);

  // Masonry grid styles
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fill, minmax(280px, 1fr))`,
    gridAutoRows: '10px', // Fine-grained row unit for precise height control
    gap: '2px', // 2px spacing for ultra-dense Pinterest-style layout
  };

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

  // Render masonry grid layout
  return (
    <div className="h-full">
      <div
        ref={setContainerRef}
        className={cn('h-full overflow-auto p-4', containerClassName)}
        style={{ scrollbarGutter: 'stable' }}
      >
        <div style={gridStyle}>
          {assets.map((asset, index) => {
            const rowSpan = getRowSpan(asset);

            return (
              <div
                key={asset.id}
                className="transition-skeleton"
                style={{
                  gridRowEnd: `span ${rowSpan}`,
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
                    showSimilarityScore={showSimilarityScores}
                    preserveAspectRatio
                  />
                </ImageTileErrorBoundary>
              </div>
            );
          })}
        </div>

        {/* Loading indicator */}
        {loading && (
          <div className="py-8 text-center">
            <div className="inline-flex items-center gap-2 text-green-600">
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
              <span className="font-mono text-sm">loading more...</span>
            </div>
          </div>
        )}

        {/* End of list indicator */}
        {!hasMore && assets.length > 0 && (
          <div className="py-6 text-center font-mono text-xs tracking-wide text-muted-foreground/60">
            no more memes in this view
          </div>
        )}
      </div>
    </div>
  );
}
