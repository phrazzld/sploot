'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { DeleteConfirmationModal, useDeleteConfirmation } from '@/components/ui/delete-confirmation-modal';
import { ImageGridSkeleton } from './image-skeleton';
import { EmptyState } from './empty-state';
import { error as logError } from '@/lib/logger';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Heart, Trash2, Loader2 } from 'lucide-react';
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
  // ISO 8601 format for terminal aesthetic: 2025-06-17T14:23:45Z
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
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
      imageName: asset.filename || asset.pathname?.split('/').pop() || 'Unnamed image',
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
      <Card
        role="button"
        tabIndex={0}
        onClick={handleRowClick}
        onKeyDown={handleRowKeyDown}
        className="group flex w-full cursor-pointer items-center gap-3 border-transparent px-3 py-2 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden border border-border bg-muted">
          <Image
            src={asset.thumbnailUrl || asset.blobUrl}
            alt={asset.filename || asset.pathname?.split('/').pop() || 'Uploaded image'}
            width={56}
            height={56}
            className="h-full w-full object-cover"
          />
          {asset.favorite && (
            <Badge variant="default" className="absolute -top-1 -right-1 bg-green-500 text-black">
              fav
            </Badge>
          )}
        </div>

        <div className="flex flex-1 items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {asset.filename || asset.pathname?.split('/').pop() || 'Unnamed image'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{asset.mime.toUpperCase()}</p>
            {asset.tags && asset.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {asset.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag.id} variant="outline" className="font-mono text-[10px]">
                    #{tag.name}
                  </Badge>
                ))}
                {asset.tags.length > 3 && (
                  <span className="font-mono text-[10px] text-muted-foreground">+{asset.tags.length - 3}</span>
                )}
              </div>
            )}
          </div>

          <div className="hidden min-w-[160px] font-mono text-xs text-muted-foreground md:block">
            {asset.width && asset.height ? `${asset.width}×${asset.height}` : 'unknown'} |{' '}
            {formatFileSize(asset.size || 0)}
          </div>

          <div className="hidden min-w-[120px] font-mono text-xs text-muted-foreground xl:block">
            {formatTimestamp(asset.createdAt)}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={asset.favorite ? 'default' : 'outline'}
              size="icon"
              onClick={handleFavoriteToggle}
              aria-pressed={asset.favorite}
              className={cn(asset.favorite && 'bg-green-500 hover:bg-green-600 border-green-500')}
              title={asset.favorite ? 'drop from bangers' : 'crown as banger'}
            >
              <Heart className={cn('h-4 w-4', asset.favorite && 'fill-current')} />
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={handleDeleteClick}
              className="hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
              title="rage delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

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
  const [showingTransition, setShowingTransition] = useState(false);

  useEffect(() => {
    onScrollContainerReady?.(containerRef.current);
  }, [onScrollContainerReady]);

  // Handle transition from skeleton to empty state
  useEffect(() => {
    if (!loading && assets.length === 0) {
      setShowingTransition(true);
      const timer = setTimeout(() => {
        setShowingTransition(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [loading, assets.length]);

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
      <div className="animate-fade-in">
        <EmptyState variant="first-use" showUploadButton={false} />
      </div>
    ),
    []
  );

  return (
    <ScrollArea
      ref={containerRef}
      className={cn('h-full', containerClassName)}
      style={{ scrollbarGutter: 'stable' } as React.CSSProperties}
    >
      {assets.length === 0 && loading ? (
        <ImageGridSkeleton count={12} variant="list" className="animate-fade-in" />
      ) : assets.length === 0 && !loading && showingTransition ? (
        <ImageGridSkeleton
          count={12}
          variant="list"
          className="animate-fade-out opacity-0 transition-opacity duration-300 ease-out"
        />
      ) : assets.length === 0 && !loading ? (
        emptyState
      ) : (
        <div className="space-y-1">
          {assets.map((asset, index) => (
            <div key={asset.id}>
              <ListRow
                asset={asset}
                onAssetUpdate={onAssetUpdate}
                onAssetDelete={onAssetDelete}
                onAssetSelect={onAssetSelect}
              />
              {index < assets.length - 1 && <Separator />}
            </div>
          ))}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="font-mono text-sm text-muted-foreground">loading more</span>
            </div>
          )}

          {hasMore && !loading && onLoadMore && (
            <div className="flex justify-center py-6">
              <Button variant="outline" size="sm" onClick={onLoadMore} className="font-mono">
                load more
              </Button>
            </div>
          )}
        </div>
      )}
    </ScrollArea>
  );
}
