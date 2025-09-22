'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { cn } from '@/lib/utils';
import { HeartIcon } from '@/components/icons/heart-icon';
import { DeleteConfirmationModal, useDeleteConfirmation } from '@/components/ui/delete-confirmation-modal';
import { error as logError } from '@/lib/logger';
import type { Asset } from '@/lib/types';

interface ImageListProps {
  assets: Asset[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onAssetUpdate?: (id: string, updates: Partial<Asset>) => void;
  onAssetDelete?: (id: string) => void;
  onAssetSelect?: (asset: Asset) => void;
  onScrollContainerReady?: (node: HTMLDivElement | null) => void;
  onUploadClick?: () => void;
  containerClassName?: string;
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatTimestamp = (value: Date | string) => {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return 'unknown';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

function ListRow({
  asset,
  onAssetUpdate,
  onAssetDelete,
  onAssetSelect,
}: {
  asset: Asset;
  onAssetUpdate?: (id: string, updates: Partial<Asset>) => void;
  onAssetDelete?: (id: string) => void;
  onAssetSelect?: (asset: Asset) => void;
}) {
  const deleteConfirmation = useDeleteConfirmation();

  const handleFavoriteToggle = async (event: MouseEvent) => {
    event.stopPropagation();
    try {
      const response = await fetch(`/api/assets/${asset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorite: !asset.favorite }),
      });

      if (!response.ok) {
        throw new Error('failed to toggle favorite');
      }

      onAssetUpdate?.(asset.id, { favorite: !asset.favorite });
    } catch (error) {
      logError('Failed to toggle favorite from list view:', error);
    }
  };

  const handleDeleteClick = (event: MouseEvent) => {
    event.stopPropagation();
    if (!onAssetDelete) return;

    const shouldDeleteImmediately = deleteConfirmation.openConfirmation({
      id: asset.id,
      imageUrl: asset.thumbnailUrl || asset.blobUrl,
      imageName: asset.filename,
    });

    if (shouldDeleteImmediately) {
      void performDelete();
    }
  };

  const performDelete = async () => {
    if (!onAssetDelete) return;
    deleteConfirmation.setLoading(true);
    try {
      const response = await fetch(`/api/assets/${asset.id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('failed to delete asset');
      }
      onAssetDelete(asset.id);
      deleteConfirmation.closeConfirmation();
    } catch (error) {
      logError('Failed to delete asset from list view:', error);
    } finally {
      deleteConfirmation.setLoading(false);
    }
  };

  const handleRowClick = () => {
    onAssetSelect?.(asset);
  };

  const handleRowKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onAssetSelect?.(asset);
    }
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={handleRowClick}
        onKeyDown={handleRowKeyDown}
        className="group flex w-full items-center gap-4 rounded-2xl border border-transparent bg-[#14171A] px-4 py-3 text-left transition-colors hover:border-[#2A2F37] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C5CFF]"
      >
        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-[#0F1216]">
          <img
            src={asset.thumbnailUrl || asset.blobUrl}
            alt={asset.filename}
            className="h-full w-full object-cover"
          />
          {asset.favorite && (
            <span className="absolute -top-2 -right-2 inline-flex items-center justify-center rounded-full bg-[#FF64C5] px-1.5 py-0.5 text-[10px] font-semibold text-black">
              fav
            </span>
          )}
        </div>

        <div className="flex flex-1 items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[#E6E8EB]">{asset.filename}</p>
            <p className="mt-1 text-xs text-[#8E94A3]">{asset.mime.toUpperCase()}</p>
            {asset.tags && asset.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {asset.tags.slice(0, 3).map((tag) => (
                  <span key={tag.id} className="rounded-full bg-[#1B1F24] px-2 py-0.5 text-[10px] text-[#B3B7BE]">
                    #{tag.name}
                  </span>
                ))}
                {asset.tags.length > 3 && (
                  <span className="text-[10px] text-[#6E7381]">+{asset.tags.length - 3}</span>
                )}
              </div>
            )}
          </div>

          <div className="hidden min-w-[160px] flex-col text-xs text-[#8E94A3] md:flex">
            <span>
              {asset.width && asset.height ? `${asset.width}×${asset.height}` : 'unknown size'}
            </span>
            <span>{formatFileSize(asset.size || 0)}</span>
          </div>

          <div className="hidden min-w-[120px] text-xs text-[#8E94A3] xl:block">{formatTimestamp(asset.createdAt)}</div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFavoriteToggle}
              aria-pressed={asset.favorite}
              className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C5CFF]',
                asset.favorite
                  ? 'bg-[#FF64C5] text-black shadow-[0_8px_18px_-10px_rgba(255,100,197,0.9)]'
                  : 'bg-[#1B1F24] text-[#B3B7BE] hover:bg-[#262B32] hover:text-white'
              )}
              title={asset.favorite ? 'drop from bangers' : 'crown as banger'}
            >
              <HeartIcon className="h-4 w-4" filled={asset.favorite} />
            </button>

            <button
              type="button"
              onClick={handleDeleteClick}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#1B1F24] text-[#B3B7BE] transition-colors hover:bg-red-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4D4D]"
              title="rage delete"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {deleteConfirmation.targetAsset && (
        <DeleteConfirmationModal
          isOpen={deleteConfirmation.isOpen}
          onClose={deleteConfirmation.closeConfirmation}
          onConfirm={performDelete}
          imageUrl={deleteConfirmation.targetAsset.imageUrl}
          imageName={deleteConfirmation.targetAsset.imageName}
          loading={deleteConfirmation.loading}
        />
      )}
    </>
  );
}

export function ImageList({
  assets,
  loading = false,
  hasMore = false,
  onLoadMore,
  onAssetUpdate,
  onAssetDelete,
  onAssetSelect,
  onScrollContainerReady,
  containerClassName,
}: ImageListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    onScrollContainerReady?.(containerRef.current);
  }, [onScrollContainerReady]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || !onLoadMore) return;

    const handleScroll = () => {
      if (!hasMore || loading) return;
      const { scrollTop, scrollHeight, clientHeight } = node;
      if (clientHeight === 0) return;
      if ((scrollTop + clientHeight) / scrollHeight > 0.92) {
        onLoadMore();
      }
    };

    node.addEventListener('scroll', handleScroll);
    return () => node.removeEventListener('scroll', handleScroll);
  }, [hasMore, loading, onLoadMore]);

  const emptyState = useMemo(
    () => (
      <div className="flex h-full min-h-[320px] items-center justify-center px-4">
        <div className="w-full max-w-lg rounded-3xl border border-dashed border-[#2A2F37] bg-[#14171A] p-10 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[#1B1F24]">
            <svg
              className="h-10 w-10 text-[#7C5CFF]"
              viewBox="0 0 48 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="6" y="8" width="36" height="28" rx="5" stroke="currentColor" strokeWidth="2" opacity="0.9" />
              <path
                d="M14 28l7.2-8.5a2 2 0 013 0l4.3 5.1a2 2 0 003 .1L34 22"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.9"
              />
              <circle cx="33" cy="17" r="2.5" fill="currentColor" opacity="0.9" />
            </svg>
          </div>
          <h3 className="mt-6 text-lg font-semibold text-[#E6E8EB]">no memes yet</h3>
          <p className="mt-2 text-sm text-[#B3B7BE]">drop something spicy to start your feed.</p>
        </div>
      </div>
    ),
    []
  );

  return (
    <div
      ref={containerRef}
      className={cn('h-full overflow-auto transition-all duration-300 ease-out', containerClassName)}
      style={{ scrollbarGutter: 'stable' }}
    >
      {assets.length === 0 && !loading ? (
        emptyState
      ) : (
        <div className="space-y-2">
          {assets.map((asset) => (
            <ListRow
              key={asset.id}
              asset={asset}
              onAssetUpdate={onAssetUpdate}
              onAssetDelete={onAssetDelete}
              onAssetSelect={onAssetSelect}
            />
          ))}

          {loading && (
            <div className="flex items-center justify-center py-6 text-sm text-[#B3B7BE]">
              <svg className="h-5 w-5 animate-spin text-[#7C5CFF]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="ml-2">loading more</span>
            </div>
          )}

          {hasMore && !loading && onLoadMore && (
            <div className="flex justify-center py-6">
              <button
                type="button"
                onClick={onLoadMore}
                className="rounded-full bg-[#1B1F24] px-4 py-2 text-sm text-[#B3B7BE] transition-colors hover:bg-[#242B33] hover:text-[#E6E8EB]"
              >
                load more
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
