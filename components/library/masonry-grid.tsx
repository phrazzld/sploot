'use client';

import { ImageTile } from './image-tile';
import { cn } from '@/lib/utils';

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

interface MasonryGridProps {
  assets: Asset[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onAssetUpdate?: (id: string, updates: Partial<Asset>) => void;
  onAssetDelete?: (id: string) => void;
  onAssetSelect?: (asset: Asset) => void;
  className?: string;
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
}: MasonryGridProps) {
  // Empty state
  if (assets.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
        <div className="text-6xl mb-4">📷</div>
        <h3 className="text-xl font-semibold text-[#E6E8EB] mb-2">
          No images yet
        </h3>
        <p className="text-[#B3B7BE] text-center">
          Upload your first meme to get started
        </p>
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
            column-count: 2;
          }

          @media (min-width: 640px) {
            .masonry-grid {
              column-count: 3;
            }
          }

          @media (min-width: 1024px) {
            .masonry-grid {
              column-count: 4;
            }
          }

          @media (min-width: 1280px) {
            .masonry-grid {
              column-count: 5;
            }
          }

          @media (min-width: 1536px) {
            .masonry-grid {
              column-count: 6;
            }
          }

          .masonry-item {
            break-inside: avoid;
            margin-bottom: 16px;
          }
        `}</style>

        {assets.map((asset) => (
          <div key={asset.id} className="masonry-item">
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

      {/* Load more button */}
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