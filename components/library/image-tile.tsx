'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { error as logError } from '@/lib/logger';
import { DeleteConfirmationModal, useDeleteConfirmation } from '@/components/ui/delete-confirmation-modal';
import { useEmbeddingRetry } from '@/hooks/use-embedding-retry';

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
  similarity?: number;
  relevance?: number;
  belowThreshold?: boolean;
}

interface ImageTileProps {
  asset: Asset;
  onFavorite?: (id: string, favorite: boolean) => void;
  onDelete?: (id: string) => void;
  onSelect?: (asset: Asset) => void;
  onToggleFavorite?: () => void;
  preserveAspectRatio?: boolean;
  onClick?: () => void;
  onAssetUpdate?: (id: string, updates: Partial<Asset>) => void;
}

export function ImageTile({
  asset,
  onFavorite,
  onDelete,
  onSelect,
  onToggleFavorite,
  preserveAspectRatio = false,
  onClick,
  onAssetUpdate
}: ImageTileProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isGeneratingEmbedding, setIsGeneratingEmbedding] = useState(false);
  const [hasEmbedding, setHasEmbedding] = useState(!!asset.embedding);
  const deleteConfirmation = useDeleteConfirmation();

  const handleEmbeddingSuccess = (result?: { embedding?: { modelName: string; dimension: number; createdAt: string } }) => {
    setHasEmbedding(true);

    if (onAssetUpdate) {
      const embeddingInfo = result?.embedding;
      const modelName = embeddingInfo?.modelName ?? 'unknown/model';
      const createdAt = embeddingInfo?.createdAt ?? new Date().toISOString();

      onAssetUpdate(asset.id, {
        embedding: {
          assetId: asset.id,
          modelName,
          modelVersion: modelName,
          createdAt,
        },
      });
    }
  };

  // Auto-retry embedding generation for assets stuck in processing
  const { isRetrying, error: retryError } = useEmbeddingRetry({
    assetId: asset.id,
    hasEmbedding,
    onEmbeddingGenerated: handleEmbeddingSuccess,
    retryDelay: 5000, // Start retry after 5 seconds
    maxRetries: 3,
  });
  const aspectRatioStyle = useMemo<CSSProperties | undefined>(() => {
    if (!preserveAspectRatio) return undefined;
    if (!asset.width || !asset.height) return undefined;
    if (asset.width <= 0 || asset.height <= 0) return undefined;

    return { aspectRatio: `${asset.width} / ${asset.height}` };
  }, [preserveAspectRatio, asset.width, asset.height]);

  const handleFavoriteToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleFavorite) {
      onToggleFavorite();
      return;
    }
    if (!onFavorite || isLoading) return;

    setIsLoading(true);
    try {
      await fetch(`/api/assets/${asset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorite: !asset.favorite }),
      });
      onFavorite(asset.id, !asset.favorite);
    } catch (error) {
      logError('Failed to toggle favorite:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateEmbedding = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGeneratingEmbedding || hasEmbedding) return;

    setIsGeneratingEmbedding(true);
    try {
      const response = await fetch(`/api/assets/${asset.id}/generate-embedding`, {
        method: 'POST',
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Embedding generated successfully', result);
        handleEmbeddingSuccess(result);
      } else {
        console.error('Failed to generate embedding');
      }
    } catch (error) {
      logError('Failed to generate embedding:', error);
    } finally {
      setIsGeneratingEmbedding(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDelete || isLoading) return;

    // Check if we should skip confirmation
    const shouldDelete = deleteConfirmation.openConfirmation({
      id: asset.id,
      imageUrl: asset.thumbnailUrl || asset.blobUrl,
      imageName: asset.filename,
    });

    if (shouldDelete) {
      // User has chosen to skip confirmations, delete immediately
      performDelete();
    }
  };

  const performDelete = async () => {
    setIsLoading(true);
    deleteConfirmation.setLoading(true);
    try {
      await fetch(`/api/assets/${asset.id}`, {
        method: 'DELETE',
      });
      onDelete!(asset.id);
      deleteConfirmation.closeConfirmation();
    } catch (error) {
      logError('Failed to delete asset:', error);
    } finally {
      setIsLoading(false);
      deleteConfirmation.setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <>
      <div
      onClick={onClick || (() => onSelect?.(asset))}
      className={cn(
        'group bg-[#14171A] border border-[#2A2F37] rounded-2xl overflow-hidden',
        'hover:border-[#7C5CFF] hover:shadow-xs transition-all duration-200 cursor-pointer',
        'flex flex-col'
      )}
    >
      {/* Image container */}
      <div
        className={cn(
          'relative bg-[#1B1F24] overflow-hidden',
          !preserveAspectRatio && 'aspect-square'
        )}
        style={aspectRatioStyle}
      >
        {imageError ? (
          <div className="w-full h-full flex items-center justify-center text-[#B3B7BE]">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        ) : (
          <>
            {/* Skeleton placeholder shown while loading */}
            {!imageLoaded && (
              <div aria-hidden className="absolute inset-0 overflow-hidden rounded-2xl">
                <div className="h-full w-full bg-[#1B1F24] animate-pulse" />
              </div>
            )}
            <img
              src={asset.thumbnailUrl || asset.blobUrl}
              alt={asset.filename}
              className={cn(
                'h-full w-full',
                preserveAspectRatio ? 'object-contain' : 'object-cover',
                imageLoaded ? 'opacity-100 animate-fade-in' : 'opacity-0',
                'transition-opacity duration-300'
              )}
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
              onError={() => {
                setImageError(true);
                setImageLoaded(true);
              }}
            />
          </>
        )}

        {/* Hover overlay with actions */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="absolute top-2 right-2 flex gap-2">
            {/* Favorite button */}
            <button
              onClick={handleFavoriteToggle}
              disabled={isLoading}
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200',
                'backdrop-blur-sm',
                asset.favorite
                  ? 'bg-[#B6FF6E] text-black hover:bg-[#B6FF6E]/90'
                  : 'bg-black/50 text-white hover:bg-[#7C5CFF] hover:text-white'
              )}
            >
              <svg
                className="w-4 h-4"
                fill={asset.favorite ? 'currentColor' : 'none'}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
            </button>

            {/* Delete button */}
            <button
              onClick={handleDelete}
              disabled={isLoading}
              className="w-8 h-8 rounded-full bg-black/50 text-white hover:bg-red-500 hover:text-white flex items-center justify-center transition-all duration-200 backdrop-blur-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>

          {/* Bottom info on hover */}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <p className="text-white text-sm font-medium truncate">{asset.filename}</p>
            <div className="flex items-center justify-between text-white/80 text-xs">
              <span>
                {asset.width}×{asset.height} • {formatFileSize(asset.size || 0)}
              </span>
              {typeof asset.relevance === 'number' && (
                <span
                  className={cn(
                    'ml-2 font-semibold',
                    asset.belowThreshold ? 'text-[#FFAA5C]' : 'text-[#B6FF6E]'
                  )}
                >
                  {Math.round(asset.relevance)}% match
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Favorite indicator (always visible) */}
        {asset.favorite && (
          <div className="absolute top-2 left-2 pointer-events-none">
            <div className="w-6 h-6 bg-[#B6FF6E] rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
          </div>
        )}

        {/* Embedding readiness indicator */}
        <div className="absolute bottom-2 left-2">
          {!hasEmbedding ? (
            <button
              onClick={handleGenerateEmbedding}
              disabled={isGeneratingEmbedding}
              className="flex items-center gap-1.5 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-full hover:bg-black/80 transition-colors duration-200 cursor-pointer"
              title="Click to generate search embedding"
            >
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                (isGeneratingEmbedding || isRetrying) ? "bg-[#7C5CFF] animate-spin" : "bg-[#FFA500] animate-pulse"
              )} />
              <span className={cn(
                "text-[10px] font-medium uppercase tracking-wide",
                retryError ? "text-red-500" : "text-[#FFA500]"
              )}>
                {isGeneratingEmbedding || isRetrying ? "generating..." : retryError ? "retry failed" : "processing..."}
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
              <div className="w-1.5 h-1.5 bg-[#B6FF6E] rounded-full" />
              <span className="text-[10px] text-[#B6FF6E] font-medium uppercase tracking-wide">
                ready for search
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="p-3">
        <p className="text-[#E6E8EB] text-sm truncate">{asset.filename}</p>
        <p className="text-[#B3B7BE] text-xs mt-1">
          {asset.mime.split('/')[1].toUpperCase()}
        </p>

        {typeof asset.relevance === 'number' && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span
              className={cn(
                'font-semibold',
                asset.belowThreshold ? 'text-[#FFAA5C]' : 'text-[#B6FF6E]'
              )}
            >
              {Math.round(asset.relevance)}% match
            </span>
            {asset.belowThreshold && (
              <span className="text-[10px] uppercase tracking-wide text-[#FFAA5C]/80">
                Below threshold
              </span>
            )}
          </div>
        )}

        {/* Tags */}
        {asset.tags && asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {asset.tags.slice(0, 3).map((tag) => (
              <span
                key={tag.id}
                className="text-xs bg-[#1B1F24] text-[#B3B7BE] px-2 py-0.5 rounded"
              >
                {tag.name}
              </span>
            ))}
            {asset.tags.length > 3 && (
              <span className="text-xs text-[#B3B7BE]/60">+{asset.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>

      {/* Delete Confirmation Modal */}
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
