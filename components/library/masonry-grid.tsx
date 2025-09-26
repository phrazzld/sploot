'use client';

import { useEffect, useRef } from 'react';
import { ImageTile } from './image-tile';
import { ImageGridSkeleton } from './image-skeleton';
import { cn } from '@/lib/utils';

import type { Asset } from '@/lib/types';

interface MasonryGridProps {
  assets: Asset[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onAssetUpdate?: (id: string, updates: Partial<Asset>) => void;
  onAssetDelete?: (id: string) => void;
  onAssetSelect?: (asset: Asset) => void;
  className?: string;
  onUploadClick?: () => void;
}

export function MasonryGrid({
  assets,
  loading = false,
  hasMore = false,
  onLoadMore,
  onAssetUpdate,
  onAssetDelete,
  onAssetSelect,
  className,
  onUploadClick,
}: MasonryGridProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Infinite scroll using IntersectionObserver with debounce
  useEffect(() => {
    if (!onLoadMore || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          // Debounce the load more call to prevent rapid firing
          clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => {
            onLoadMore();
          }, 100);
        }
      },
      {
        root: null,
        rootMargin: '200px',
        threshold: 0.1,
      }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => {
      clearTimeout(timeoutRef.current);
      if (sentinelRef.current) {
        observer.unobserve(sentinelRef.current);
      }
      observer.disconnect();
    };
  }, [hasMore, loading, onLoadMore]);

  // Show skeleton loaders during initial load
  if (assets.length === 0 && loading) {
    return (
      <div className={cn("w-full", className)}>
        <ImageGridSkeleton count={15} variant="masonry" className="animate-fade-in" />
      </div>
    );
  }

  // Empty state
  if (assets.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-3 text-center">
        <div className="text-6xl">📷</div>
        <h3 className="text-xl font-semibold text-[#E6E8EB]">
          No memes yet
        </h3>
        <p className="text-[#B3B7BE] max-w-sm">
          Hit the upload button and seed this feed with your favorite reaction pics.
        </p>
        <button
          onClick={() => onUploadClick?.()}
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
        </button>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Masonry container using CSS columns */}
      <div className="masonry-grid">
        <style jsx>{`
          .masonry-grid {
            column-gap: 16px;
            column-width: 260px;
            max-width: 100%;
          }

          @media (max-width: 640px) {
            .masonry-grid {
              column-width: 220px;
            }
          }

          .masonry-item {
            break-inside: avoid;
            margin-bottom: 16px;
            width: 100%;
          }
        `}</style>

        {assets.map((asset, index) => (
          <div
            key={asset.id}
            className="masonry-item transition-skeleton"
            style={{
              animation: `fadeInScale 300ms ease-out ${index * 30}ms forwards`,
              opacity: 0,
            }}
          >
            <ImageTile
              asset={asset}
              onToggleFavorite={
                onAssetUpdate
                  ? () => onAssetUpdate(asset.id, { favorite: !asset.favorite })
                  : undefined
              }
              onDelete={onAssetDelete ? () => onAssetDelete(asset.id) : undefined}
              onClick={onAssetSelect ? () => onAssetSelect(asset) : undefined}
              preserveAspectRatio={true}
              onAssetUpdate={onAssetUpdate}
            />
          </div>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7C5CFF]"></div>
        </div>
      )}

      {/* Sentinel element for infinite scroll */}
      {hasMore && !loading && onLoadMore && (
        <div ref={sentinelRef} className="h-4" />
      )}

      {/* Load more button (fallback) */}
      {hasMore && !loading && onLoadMore && (
        <div className="flex justify-center py-8">
          <button
            onClick={onLoadMore}
            className="px-6 py-2 bg-[#7C5CFF] text-white rounded-lg hover:bg-[#6B4FE0] transition-colors"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
