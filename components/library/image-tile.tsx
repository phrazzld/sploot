'use client';

import { useMemo, useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { error as logError } from '@/lib/logger';
import { DeleteConfirmationModal, useDeleteConfirmation } from '@/components/ui/delete-confirmation-modal';
import { useEmbeddingRetry } from '@/hooks/use-embedding-retry';
import { HeartIcon } from '@/components/icons/heart-icon';
import type { Asset } from '@/lib/types';

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

type EmbeddingStatusType = 'pending' | 'processing' | 'ready' | 'failed';

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
  const [embeddingStatus, setEmbeddingStatus] = useState<EmbeddingStatusType>(() => {
    if (asset.embedding) return 'ready';
    if (asset.embeddingStatus === 'failed') return 'failed';
    if (asset.embeddingStatus === 'processing') return 'processing';
    return 'pending';
  });
  const deleteConfirmation = useDeleteConfirmation();

  // Debug mode tracking
  const [debugInfo, setDebugInfo] = useState<{
    queuePosition?: number;
    apiResponseTime?: number;
    lastTransition?: string;
  }>({});
  const [isDebugMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('debug_embeddings') === 'true';
    }
    return false;
  });

  // Simulate queue position in debug mode
  useEffect(() => {
    if (isDebugMode && embeddingStatus === 'processing' && !debugInfo.queuePosition) {
      // Simulate a queue position for debugging
      const simulatedPosition = Math.floor(Math.random() * 5) + 1;
      setDebugInfo(prev => ({ ...prev, queuePosition: simulatedPosition }));
      console.log(`[debug_embeddings] Asset ${asset.id}: Simulated queue position - #${simulatedPosition}`);
    }
  }, [isDebugMode, embeddingStatus, debugInfo.queuePosition, asset.id]);

  const handleEmbeddingSuccess = (result?: { embedding?: { modelName: string; dimension: number; createdAt: string } }) => {
    if (isDebugMode) {
      console.log(`[debug_embeddings] Asset ${asset.id}: Embedding generation succeeded`);
      console.log('[debug_embeddings] Result:', result);
      setDebugInfo(prev => ({ ...prev, lastTransition: 'processing → ready' }));
    }
    setHasEmbedding(true);
    setEmbeddingStatus('ready');

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

  // Update embedding status when retrying
  useEffect(() => {
    if (isRetrying && embeddingStatus !== 'processing') {
      if (isDebugMode) {
        console.log(`[debug_embeddings] Asset ${asset.id}: Auto-retry initiated`);
        console.log(`[debug_embeddings] Retry count: ${asset.embeddingRetryCount || 0}`);
        setDebugInfo(prev => ({ ...prev, lastTransition: `${embeddingStatus} → processing (auto-retry)` }));
      }
      setEmbeddingStatus('processing');
    }
  }, [isRetrying, embeddingStatus, isDebugMode, asset.id, asset.embeddingRetryCount]);

  // Log initial status and transitions in debug mode
  useEffect(() => {
    if (isDebugMode) {
      console.log(`[debug_embeddings] Asset ${asset.id}: Initial status - ${embeddingStatus}`);
      if (asset.embeddingError) {
        console.log(`[debug_embeddings] Asset ${asset.id}: Error - ${asset.embeddingError}`);
      }
      if (asset.embeddingRetryCount) {
        console.log(`[debug_embeddings] Asset ${asset.id}: Retry count - ${asset.embeddingRetryCount}`);
      }
      if (asset.embeddingLastAttempt) {
        console.log(`[debug_embeddings] Asset ${asset.id}: Last attempt - ${asset.embeddingLastAttempt}`);
      }
    }
  }, [isDebugMode, asset.id, embeddingStatus, asset.embeddingError, asset.embeddingRetryCount, asset.embeddingLastAttempt]);

  // Log status changes in debug mode
  useEffect(() => {
    if (isDebugMode) {
      console.log(`[debug_embeddings] Asset ${asset.id}: Status changed to ${embeddingStatus}`);
    }
  }, [embeddingStatus, isDebugMode, asset.id]);
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

    const startTime = Date.now();
    if (isDebugMode) {
      console.log(`[debug_embeddings] Asset ${asset.id}: Manual embedding generation triggered`);
      setDebugInfo(prev => ({ ...prev, lastTransition: `${embeddingStatus} → processing (manual)` }));
    }

    setIsGeneratingEmbedding(true);
    setEmbeddingStatus('processing');
    try {
      const response = await fetch(`/api/assets/${asset.id}/generate-embedding`, {
        method: 'POST',
      });

      const apiResponseTime = Date.now() - startTime;
      if (isDebugMode) {
        console.log(`[debug_embeddings] Asset ${asset.id}: API response time - ${apiResponseTime}ms`);
        setDebugInfo(prev => ({ ...prev, apiResponseTime }));
      }

      if (response.ok) {
        const result = await response.json();
        if (isDebugMode) {
          console.log(`[debug_embeddings] Asset ${asset.id}: Embedding generated successfully`, result);
        }
        handleEmbeddingSuccess(result);
      } else {
        const errorText = await response.text();
        if (isDebugMode) {
          console.error(`[debug_embeddings] Asset ${asset.id}: Failed to generate embedding - ${response.status}`);
          console.error('[debug_embeddings] Error response:', errorText);
          setDebugInfo(prev => ({ ...prev, lastTransition: 'processing → failed' }));
        }
        setEmbeddingStatus('failed');
      }
    } catch (error) {
      if (isDebugMode) {
        console.error(`[debug_embeddings] Asset ${asset.id}: Exception during embedding generation:`, error);
        setDebugInfo(prev => ({ ...prev, lastTransition: 'processing → failed (exception)' }));
      }
      logError('Failed to generate embedding:', error);
      setEmbeddingStatus('failed');
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
        'group bg-[#14171A] border border-[#2A2F37] rounded-2xl overflow-hidden w-full',
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

        {/* Floating actions */}
        <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
          <button
            type="button"
            onClick={handleFavoriteToggle}
            disabled={isLoading}
            aria-pressed={asset.favorite}
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 backdrop-blur-sm border border-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C5CFF]',
              asset.favorite
                ? 'bg-[#FF64C5] text-black shadow-[0_8px_24px_-10px_rgba(255,100,197,0.85)] ring-1 ring-[#FF8AD6]/60'
                : 'bg-black/60 text-white border border-[#2A2F37] hover:border-transparent hover:bg-[#FF64C5] hover:text-black hover:shadow-[0_6px_20px_-10px_rgba(255,100,197,0.9)]',
              isLoading && 'opacity-70 cursor-wait'
            )}
            title={asset.favorite ? 'drop from bangers' : 'crown as banger'}
          >
            <HeartIcon className="w-4 h-4" filled={asset.favorite} />
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={isLoading}
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 backdrop-blur-sm bg-black/60 text-white',
              'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 focus-visible:opacity-100 focus-visible:translate-x-0',
              'hover:bg-red-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4D4D]',
              isLoading && 'pointer-events-none cursor-wait group-hover:opacity-60'
            )}
            title="rage delete"
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

        {/* Hover overlay with metadata */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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

        {/* Embedding status badge */}
        {embeddingStatus !== 'ready' && (
          <div className="absolute bottom-2 left-2 z-10">
            <button
              onClick={embeddingStatus === 'failed' ? handleGenerateEmbedding : undefined}
              disabled={embeddingStatus === 'processing'}
              className={cn(
                'flex items-center justify-center',
                isDebugMode ? 'min-w-[24px] h-6 px-1 rounded-md' : 'w-6 h-6 rounded-full',
                'backdrop-blur-sm transition-all duration-200',
                embeddingStatus === 'pending' && 'bg-yellow-500/80 hover:bg-yellow-500 cursor-default',
                embeddingStatus === 'processing' && 'bg-blue-500/80 cursor-wait',
                embeddingStatus === 'failed' && 'bg-red-500/80 hover:bg-red-500 cursor-pointer',
                'shadow-sm'
              )}
              title={
                isDebugMode ? (
                  `Status: ${embeddingStatus}\n` +
                  `Retry count: ${asset.embeddingRetryCount || 0}\n` +
                  (asset.embeddingError ? `Error: ${asset.embeddingError}\n` : '') +
                  (debugInfo.apiResponseTime ? `Last API time: ${debugInfo.apiResponseTime}ms\n` : '') +
                  (debugInfo.lastTransition ? `Last transition: ${debugInfo.lastTransition}` : '')
                ) : (
                  embeddingStatus === 'pending' ? 'Embedding pending' :
                  embeddingStatus === 'processing' ? 'Generating embedding...' :
                  embeddingStatus === 'failed' ? 'Click to retry' : ''
                )
              }
            >
              {isDebugMode ? (
                <div className="flex items-center gap-1 text-white">
                  {embeddingStatus === 'pending' && (
                    <div className="flex items-center gap-1">
                      <div className="relative">
                        <div className="w-2 h-2 bg-yellow-200 rounded-full animate-ping absolute inset-0" />
                        <div className="w-2 h-2 bg-yellow-300 rounded-full relative" />
                      </div>
                      <span className="text-[10px] font-mono">P</span>
                    </div>
                  )}
                  {embeddingStatus === 'processing' && (
                    <div className="flex items-center gap-1">
                      <svg className="w-3 h-3 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span className="text-[10px] font-mono">#{debugInfo.queuePosition || '?'}</span>
                      {asset.embeddingRetryCount && asset.embeddingRetryCount > 0 && (
                        <span className="text-[10px] font-mono">R{asset.embeddingRetryCount}</span>
                      )}
                    </div>
                  )}
                  {embeddingStatus === 'failed' && (
                    <div className="flex items-center gap-1">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      {asset.embeddingRetryCount !== undefined && (
                        <span className="text-[10px] font-mono">R{asset.embeddingRetryCount}</span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {embeddingStatus === 'pending' && (
                    <div className="relative">
                      <div className="w-2 h-2 bg-yellow-200 rounded-full animate-ping absolute inset-0" />
                      <div className="w-2 h-2 bg-yellow-300 rounded-full relative" />
                    </div>
                  )}
                  {embeddingStatus === 'processing' && (
                    <svg className="w-3.5 h-3.5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  )}
                  {embeddingStatus === 'failed' && (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </>
              )}
            </button>
          </div>
        )}

        {/* Success checkmark - only show briefly when ready */}
        {embeddingStatus === 'ready' && hasEmbedding && (
          <div className="absolute bottom-2 left-2 z-10 pointer-events-none">
            <div className={cn(
              'flex items-center justify-center rounded-full bg-green-500/80 backdrop-blur-sm animate-fade-in-scale',
              isDebugMode ? 'min-w-[24px] h-6 px-1 rounded-md gap-1' : 'w-6 h-6'
            )}>
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              {isDebugMode && debugInfo.apiResponseTime && (
                <span className="text-[10px] font-mono text-white">{debugInfo.apiResponseTime}ms</span>
              )}
            </div>
          </div>
        )}
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

        {/* Debug info when in debug mode */}
        {isDebugMode && (embeddingStatus !== 'ready' || debugInfo.apiResponseTime) && (
          <div className="mt-2 p-2 bg-[#0F1012] rounded border border-[#2A2F37] text-[10px] font-mono text-[#B3B7BE]">
            <div className="font-semibold text-[#7C5CFF] mb-1">🐛 Embedding Debug</div>
            <div>Status: {embeddingStatus}</div>
            {asset.embeddingRetryCount !== undefined && (
              <div>Retries: {asset.embeddingRetryCount}</div>
            )}
            {debugInfo.apiResponseTime && (
              <div>API Time: {debugInfo.apiResponseTime}ms</div>
            )}
            {debugInfo.lastTransition && (
              <div>Transition: {debugInfo.lastTransition}</div>
            )}
            {asset.embeddingError && (
              <div className="text-red-400 mt-1">Error: {asset.embeddingError}</div>
            )}
            {asset.embeddingLastAttempt && (
              <div>Last Try: {new Date(asset.embeddingLastAttempt).toLocaleTimeString()}</div>
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
