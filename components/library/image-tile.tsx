'use client';

import { useMemo, useState, useEffect, memo } from 'react';
import type { CSSProperties } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { error as logError } from '@/lib/logger';
import { DeleteConfirmationModal, useDeleteConfirmation } from '@/components/ui/delete-confirmation-modal';
import { useEmbeddingRetry } from '@/hooks/use-embedding-retry';
import { useBlobCircuitBreaker } from '@/contexts/blob-circuit-breaker-context';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Heart, Trash2, ImageOff, Loader2, AlertCircle, Clock } from 'lucide-react';
import type { Asset } from '@/lib/types';
import { ShareButton } from './share-button';

interface ImageTileProps {
  asset: Asset;
  onFavorite?: (id: string, favorite: boolean) => void;
  onDelete?: (id: string) => void;
  onSelect?: (asset: Asset) => void;
  onToggleFavorite?: () => void;
  preserveAspectRatio?: boolean;
  onClick?: () => void;
  onAssetUpdate?: (id: string, updates: Partial<Asset>) => void;
  showSimilarityScore?: boolean;
}

type EmbeddingStatusType = 'pending' | 'processing' | 'ready' | 'failed';

function ImageTileComponent({
  asset,
  onFavorite,
  onDelete,
  onSelect,
  onToggleFavorite,
  preserveAspectRatio = true,
  onClick,
  onAssetUpdate,
  showSimilarityScore = false,
}: ImageTileProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSrc, setImageSrc] = useState(asset.thumbnailUrl || asset.blobUrl);
  const [hasTriedFallback, setHasTriedFallback] = useState(false);
  const [isGeneratingEmbedding, setIsGeneratingEmbedding] = useState(false);
  const [hasEmbedding, setHasEmbedding] = useState(!!asset.embedding);
  const [embeddingStatus, setEmbeddingStatus] = useState<EmbeddingStatusType>(() => {
    if (asset.embedding) return 'ready';
    if (asset.embeddingStatus === 'failed') return 'failed';
    if (asset.embeddingStatus === 'processing') return 'processing';
    return 'pending';
  });
  const deleteConfirmation = useDeleteConfirmation();
  const { recordBlobError, recordBlobSuccess } = useBlobCircuitBreaker();

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

  // Reset image src when asset changes (e.g., component reused)
  useEffect(() => {
    setImageSrc(asset.thumbnailUrl || asset.blobUrl);
    setHasTriedFallback(false);
    setImageError(false);
    setImageLoaded(false);
  }, [asset.id, asset.blobUrl, asset.thumbnailUrl]);

  // Simulate queue position in debug mode
  useEffect(() => {
    if (isDebugMode && embeddingStatus === 'processing' && !debugInfo.queuePosition) {
      const simulatedPosition = Math.floor(Math.random() * 5) + 1;
      setDebugInfo((prev) => ({ ...prev, queuePosition: simulatedPosition }));
      console.log(`[debug_embeddings] Asset ${asset.id}: Simulated queue position - #${simulatedPosition}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDebugMode, embeddingStatus, asset.id]);

  const handleEmbeddingSuccess = (result?: {
    embedding?: { modelName: string; dimension: number; createdAt: string };
  }) => {
    if (isDebugMode) {
      console.log(`[debug_embeddings] Asset ${asset.id}: Embedding generation succeeded`);
      console.log('[debug_embeddings] Result:', result);
      setDebugInfo((prev) => ({ ...prev, lastTransition: 'processing → ready' }));
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
    retryDelay: 5000,
    maxRetries: 3,
  });

  // Update embedding status when retrying
  useEffect(() => {
    if (isRetrying && embeddingStatus !== 'processing') {
      if (isDebugMode) {
        console.log(`[debug_embeddings] Asset ${asset.id}: Auto-retry initiated`);
        console.log(`[debug_embeddings] Retry count: ${asset.embeddingRetryCount || 0}`);
        setDebugInfo((prev) => ({
          ...prev,
          lastTransition: `${embeddingStatus} → processing (auto-retry)`,
        }));
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
  }, [
    isDebugMode,
    asset.id,
    embeddingStatus,
    asset.embeddingError,
    asset.embeddingRetryCount,
    asset.embeddingLastAttempt,
  ]);

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
      setDebugInfo((prev) => ({ ...prev, lastTransition: `${embeddingStatus} → processing (manual)` }));
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
        setDebugInfo((prev) => ({ ...prev, apiResponseTime }));
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
          setDebugInfo((prev) => ({ ...prev, lastTransition: 'processing → failed' }));
        }
        setEmbeddingStatus('failed');
      }
    } catch (error) {
      if (isDebugMode) {
        console.error(`[debug_embeddings] Asset ${asset.id}: Exception during embedding generation:`, error);
        setDebugInfo((prev) => ({ ...prev, lastTransition: 'processing → failed (exception)' }));
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

    const shouldDelete = deleteConfirmation.openConfirmation({
      id: asset.id,
      imageUrl: asset.thumbnailUrl || asset.blobUrl,
      imageName: asset.filename || asset.pathname?.split('/').pop() || 'Unnamed image',
    });

    if (shouldDelete) {
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

  // Extract similarity score from search results
  const similarityScore = useMemo(() => {
    if (!showSimilarityScore) return null;
    const score = (asset as any).similarity;
    if (typeof score !== 'number') return null;
    return score.toFixed(2);
  }, [showSimilarityScore, asset]);

  // Determine border color based on similarity score
  const scoreBorderStyle = useMemo(() => {
    if (!showSimilarityScore) return null;
    const score = (asset as any).similarity;
    if (typeof score !== 'number') return null;

    if (score > 0.85) {
      return 'border-green-500 shadow-[0_0_0_2px_rgb(34_197_94),0_0_12px_rgba(34,197,94,0.3)]';
    } else if (score >= 0.7) {
      return 'border-yellow-500 shadow-[0_0_0_2px_rgb(234_179_8),0_0_12px_rgba(234,179,8,0.3)]';
    }
    return 'border-border shadow-[0_0_0_2px_hsl(var(--border))]';
  }, [showSimilarityScore, asset]);

  // Get embedding status icon and label
  const getEmbeddingStatusIcon = () => {
    switch (embeddingStatus) {
      case 'ready':
        return { icon: null, label: '[✓] EMBEDDED', color: 'text-green-500' };
      case 'processing':
        return { icon: Loader2, label: '[⏳] PROCESSING', color: 'text-yellow-500' };
      case 'pending':
        return { icon: Clock, label: '[⏳] QUEUED', color: 'text-yellow-500' };
      case 'failed':
        return { icon: AlertCircle, label: '[✗] FAILED', color: 'text-red-500' };
      default:
        return { icon: null, label: '', color: '' };
    }
  };

  const embeddingStatusInfo = getEmbeddingStatusIcon();

  return (
    <>
      <div
        onClick={onClick || (() => onSelect?.(asset))}
        className="group overflow-hidden cursor-pointer hover:opacity-90 transition-opacity border-2 rounded-md border-white/30 dark:border-white/30 shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
      >
        <div className="relative">
          {/* Image container */}
          <div
            className={cn('relative bg-muted overflow-hidden', !preserveAspectRatio && 'aspect-square')}
            style={aspectRatioStyle}
          >
            {imageError ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-4">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <ImageOff className="w-12 h-12" />
                  <p className="text-xs text-center">Image unavailable</p>
                </div>

                <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isLoading}>
                  <Trash2 className="w-3 h-3 mr-1.5" />
                  Delete
                </Button>
              </div>
            ) : (
              <>
                {/* Skeleton placeholder */}
                {!imageLoaded && (
                  <div aria-hidden className="absolute inset-0 overflow-hidden">
                    <div className="h-full w-full bg-muted animate-pulse" />
                  </div>
                )}
                <Image
                  key={imageSrc}
                  src={imageSrc}
                  alt={asset.filename || asset.pathname?.split('/').pop() || 'Uploaded image'}
                  fill
                  sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                  className={cn(
                    'h-full w-full',
                    preserveAspectRatio ? 'object-contain' : 'object-cover'
                  )}
                  loading="lazy"
                  onLoad={() => {
                    setImageLoaded(true);
                    recordBlobSuccess();
                  }}
                  onError={(e) => {
                    // If thumbnail failed and we haven't tried the main blob yet
                    if (imageSrc === asset.thumbnailUrl && asset.blobUrl && !hasTriedFallback) {
                      console.log(`[image-fallback] Thumbnail failed for ${asset.id}, falling back to main blob`);
                      setHasTriedFallback(true);
                      setImageSrc(asset.blobUrl);
                      // Don't set imageError yet - give the fallback a chance
                      return;
                    }

                    // Both failed (or only had one URL)
                    setImageError(true);
                    setImageLoaded(true);
                    recordBlobError(404);

                    // Send telemetry (fire-and-forget)
                    fetch('/api/telemetry', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        assetId: asset.id,
                        blobUrl: imageSrc,
                        errorType: 'blob_load_failure',
                        timestamp: Date.now(),
                        fallbackAttempted: hasTriedFallback,
                      }),
                    }).catch(() => {});
                  }}
                />
              </>
            )}


            {/* Similarity score overlay */}
            {similarityScore !== null && (
              <div className="absolute top-2 right-2 z-10">
                <div className="px-2 py-1 bg-black/80 backdrop-blur-sm border border-green-500 rounded">
                  <span className="font-mono text-xs text-green-500 tabular-nums">{similarityScore}</span>
                </div>
              </div>
            )}


            {/* Embedding status indicator */}
            {embeddingStatus !== 'ready' && (
              <div className="absolute bottom-1 left-1 z-10">
                <Button
                  variant="secondary"
                  size="icon"
                  className={cn(
                    'h-5 w-5 backdrop-blur-sm',
                    embeddingStatus === 'pending' && 'bg-yellow-500/70 hover:bg-yellow-500/90 cursor-default',
                    embeddingStatus === 'processing' && 'bg-blue-500/70 hover:bg-blue-500/90 cursor-wait',
                    embeddingStatus === 'failed' && 'bg-red-500/70 hover:bg-red-500/90 cursor-pointer'
                  )}
                  onClick={embeddingStatus === 'failed' ? handleGenerateEmbedding : undefined}
                  disabled={embeddingStatus === 'processing'}
                  title={
                    embeddingStatus === 'pending'
                      ? 'Embedding pending'
                      : embeddingStatus === 'processing'
                        ? 'Generating embedding...'
                        : embeddingStatus === 'failed'
                          ? 'Click to retry'
                          : ''
                  }
                >
                  {embeddingStatus === 'pending' && (
                    <div className="relative">
                      <div className="w-1.5 h-1.5 bg-yellow-200 animate-ping absolute inset-0" />
                      <div className="w-1.5 h-1.5 bg-yellow-300 relative" />
                    </div>
                  )}
                  {embeddingStatus === 'processing' && <Loader2 className="w-3 h-3 text-white animate-spin" />}
                  {embeddingStatus === 'failed' && <AlertCircle className="w-3 h-3 text-white" />}
                </Button>
              </div>
            )}
          </div>

          {/* Action bar below image */}
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-card dark:bg-muted border-t border-border dark:border-white/20">
            {/* Left: Actions */}
            <div className="flex items-center gap-1">
              {/* Banger button - always visible */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'h-7 w-7 transition-colors',
                        asset.favorite
                          ? 'text-green-500 hover:text-green-400'
                          : 'text-muted-foreground/80 hover:text-green-500'
                      )}
                      onClick={handleFavoriteToggle}
                      disabled={isLoading}
                      aria-pressed={asset.favorite}
                    >
                      <Heart className={cn('h-4 w-4', asset.favorite && 'fill-current')} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{asset.favorite ? 'drop from bangers' : 'crown as banger'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Share button - on hover */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ShareButton
                      assetId={asset.id}
                      blobUrl={asset.blobUrl}
                      filename={asset.filename}
                      mimeType={asset.mime}
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-all text-muted-foreground/80 hover:text-primary"
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>share</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Delete button - on hover */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-all text-muted-foreground/80 hover:text-red-500"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(e);
                }}
                disabled={isLoading}
                title="rage delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Right: Metadata */}
            <div className="flex flex-col items-end gap-0.5 min-w-0 flex-1">
              <div className="flex items-center gap-2 w-full justify-end">
                <span className="font-mono text-xs text-muted-foreground/90 truncate">
                  {asset.filename}
                </span>
                {/* Embedding status indicator */}
                {embeddingStatus !== 'ready' && (
                  <span className={cn('text-xs font-mono shrink-0', embeddingStatusInfo.color)}>
                    {embeddingStatusInfo.label}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground/70 whitespace-nowrap">
                  {asset.width}×{asset.height} | {formatFileSize(asset.size || 0)}
                </span>
                {typeof asset.relevance === 'number' && (
                  <span
                    className={cn(
                      'font-mono text-xs font-semibold tabular-nums',
                      asset.belowThreshold ? 'text-orange-400' : 'text-green-400'
                    )}
                  >
                    {Math.round(asset.relevance)}%
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Debug info overlay */}
          {isDebugMode && (embeddingStatus !== 'ready' || debugInfo.apiResponseTime) && (
            <div className="px-2 py-1 bg-black/80 text-[9px] font-mono text-muted-foreground border-t border-border">
              <div className="flex items-center gap-2">
                <span className="text-primary">Debug:</span>
                <span>{embeddingStatus}</span>
                {asset.embeddingRetryCount !== undefined && <span>R{asset.embeddingRetryCount}</span>}
                {debugInfo.apiResponseTime && <span>{debugInfo.apiResponseTime}ms</span>}
              </div>
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

/**
 * Custom comparison function for React.memo optimization.
 *
 * IMPORTANT: This function intentionally skips comparison of function props (onClick, onToggleFavorite, etc.)
 * because it assumes parent components wrap these callbacks in useCallback with stable dependencies.
 *
 * **Parent Component Requirements:**
 * ```tsx
 * // ✅ CORRECT - Callbacks wrapped in useCallback
 * const handleClick = useCallback((assetId: string) => {
 *   navigateToAsset(assetId);
 * }, []); // Empty deps if truly stable
 *
 * const handleToggleFavorite = useCallback(async (assetId: string) => {
 *   await updateFavorite(assetId);
 * }, []); // Or include necessary deps
 *
 * <ImageTile onClick={handleClick} onToggleFavorite={handleToggleFavorite} />
 * ```
 *
 * ```tsx
 * // ❌ WRONG - Inline functions recreated on every render
 * <ImageTile
 *   onClick={(id) => navigateToAsset(id)}
 *   onToggleFavorite={async (id) => await updateFavorite(id)}
 * />
 * // This causes ALL tiles to re-render on parent state changes!
 * ```
 *
 * **Consequences of violating this assumption:**
 * - Every parent re-render triggers re-render of ALL ImageTile instances
 * - Defeats the purpose of React.memo optimization
 * - Significant performance degradation with 100+ images in grid
 * - May cause frame drops during scroll on lower-end devices
 *
 * **Why we skip function comparison:**
 * - Comparing functions by reference is unreliable (new function !== new function)
 * - If parent follows useCallback pattern, functions are stable by reference
 * - This allows grid to skip re-renders when parent state changes unrelated to tiles
 *
 * Only re-renders if visual props change (asset data, favorite status, embedding status, etc.)
 */
function arePropsEqual(prevProps: ImageTileProps, nextProps: ImageTileProps) {
  // Always re-render if asset ID changed (different image)
  if (prevProps.asset.id !== nextProps.asset.id) return false;

  // Re-render if URLs changed
  if (prevProps.asset.blobUrl !== nextProps.asset.blobUrl) return false;
  if (prevProps.asset.thumbnailUrl !== nextProps.asset.thumbnailUrl) return false;

  // Re-render if favorite status changed
  if (prevProps.asset.favorite !== nextProps.asset.favorite) return false;

  // Re-render if embedding status changed
  if (prevProps.asset.embeddingStatus !== nextProps.asset.embeddingStatus) return false;
  if (!!prevProps.asset.embedding !== !!nextProps.asset.embedding) return false;

  // Re-render if relevance score changed (for search results)
  if (prevProps.asset.relevance !== nextProps.asset.relevance) return false;

  // Re-render if preserveAspectRatio prop changed
  if (prevProps.preserveAspectRatio !== nextProps.preserveAspectRatio) return false;

  // Re-render if showSimilarityScore prop changed
  if (prevProps.showSimilarityScore !== nextProps.showSimilarityScore) return false;

  // Re-render if similarity score changed (for search results)
  const prevSimilarity = (prevProps.asset as any).similarity;
  const nextSimilarity = (nextProps.asset as any).similarity;
  if (prevSimilarity !== nextSimilarity) return false;

  // Ignore function prop changes - they're stable via useCallback (see JSDoc above)
  // This prevents unnecessary re-renders when parent re-renders

  // All relevant props are equal, skip re-render
  return true;
}

// Export memoized version to prevent unnecessary re-renders
export const ImageTile = memo(ImageTileComponent, arePropsEqual);
