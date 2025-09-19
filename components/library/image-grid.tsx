'use client';

import { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ImageTile } from './image-tile';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface Asset {
  id: string;
  blobUrl: string;
  thumbnailUrl?: string | null;
  pathname: string;
  filename: string;
  mime: string;
  size: number;
  width?: number | null;
  height?: number | null;
  favorite: boolean;
  createdAt: Date | string;
  tags?: Array<{ id: string; name: string }>;
  embedding?: {
    assetId: string;
    modelName: string;
    modelVersion: string;
    createdAt: Date | string;
  } | null;
}

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
}: ImageGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      onScrollContainerReady?.(node);
    },
    [onScrollContainerReady]
  );

  // Use virtual scrolling only for large collections
  const USE_VIRTUAL_SCROLLING_THRESHOLD = 100;
  const useVirtualScrolling = assets.length > USE_VIRTUAL_SCROLLING_THRESHOLD;

  // Calculate columns based on container width
  const columnCount = useMemo(() => {
    if (!containerWidth) return 1;

    const ITEM_WIDTH = 260; // Slightly smaller than design for better fit
    const GAP = 16;
    const MIN_COLUMNS = 1;
    const MAX_COLUMNS = 6;

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
    estimateSize: () => 380, // Estimated row height
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

  // Empty state
  if (assets.length === 0 && !loading) {
    return (
      <div className="flex h-full items-center justify-center py-16">
        <div className="flex w-full max-w-lg flex-col items-center gap-6 rounded-3xl border border-dashed border-[#2A2F37] bg-[#14171A] p-10 text-center">
          <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-[#1B1F24]">
            <svg
              className="h-14 w-14 text-[#7C5CFF]"
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="8" y="12" width="48" height="40" rx="6" stroke="currentColor" strokeWidth="2.5" opacity="0.9" />
              <path
                d="M18 39l9.5-11a2 2 0 013 0l6 7.2a2 2 0 003.1.1L44 30"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.9"
              />
              <circle cx="42" cy="23" r="3.5" fill="currentColor" opacity="0.9" />
            </svg>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-[#E6E8EB]">Drop files here</h3>
            <p className="mt-2 text-sm text-[#B3B7BE]">
              Drag and drop images into your library or start an upload to see them appear instantly.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <span className="text-xs uppercase tracking-wide text-[#7C5CFF]">or</span>
            <Link
              href="/app/upload"
              className="inline-flex items-center gap-2 rounded-lg bg-[#7C5CFF] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#6B4FE0]"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M10 4v12M4 10h12"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Upload images
            </Link>
          </div>
        </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {assets.map((asset) => (
              <ImageTile
                key={asset.id}
                asset={asset}
                onFavorite={handleFavoriteToggle}
                onDelete={onAssetDelete}
                onSelect={onAssetSelect}
              />
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
                  className="grid gap-4"
                  style={{
                    gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
                  }}
                >
                  {row.map((asset) => (
                    <ImageTile
                      key={asset.id}
                      asset={asset}
                      onFavorite={handleFavoriteToggle}
                      onDelete={onAssetDelete}
                      onSelect={onAssetSelect}
                    />
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
