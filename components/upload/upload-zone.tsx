'use client';

import { useState, useRef, useCallback, useEffect, useMemo, DragEvent, ClipboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useVirtualizer } from '@tanstack/react-virtual';
import { upload } from '@vercel/blob/client';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from '@/lib/blob';
import { cn } from '@/lib/utils';
import { useOffline } from '@/hooks/use-offline';
import { useUploadQueue } from '@/hooks/use-upload-queue';
import { useBackgroundSync } from '@/hooks/use-background-sync';
import { UploadErrorDisplay } from '@/components/upload/upload-error-display';
import { getUploadErrorDetails, UploadErrorDetails } from '@/lib/upload-errors';
import { useEmbeddingStatusSubscription } from '@/contexts/embedding-status-context';
import { useSSEEmbeddingUpdates } from '@/hooks/use-sse-updates';
import { getSSEClient } from '@/lib/sse-client';
import { getUploadQueueManager, useUploadRecovery } from '@/lib/upload-queue';
import { showToast } from '@/components/ui/toast';
import type { ProgressStats } from './upload-progress-header';
import { FileStreamProcessor } from '@/lib/file-stream-processor';
import { logger } from '@/lib/logger';

// Lightweight metadata for display - only ~300 bytes per file vs 5MB for File object
interface FileMetadata {
  id: string;
  name: string; // max 255 bytes
  size: number; // 8 bytes
  status: 'pending' | 'uploading' | 'success' | 'error' | 'queued' | 'duplicate'; // 1 byte enum
  progress: number; // 4 bytes
  error?: string;
  errorDetails?: UploadErrorDetails;
  assetId?: string;
  blobUrl?: string;
  isDuplicate?: boolean;
  needsEmbedding?: boolean;
  embeddingStatus?: 'pending' | 'processing' | 'ready' | 'failed';
  embeddingError?: string;
  retryCount?: number;
  addedAt: number; // timestamp for sorting
}

// Legacy interface for backward compatibility during migration
interface UploadFile extends FileMetadata {
  file: File;
}

// Component to handle inline embedding status display
function EmbeddingStatusIndicator({
  file,
  onStatusChange
}: {
  file: FileMetadata;
  onStatusChange: (status: 'pending' | 'processing' | 'ready' | 'failed', error?: string) => void;
}) {
  const [showStatus, setShowStatus] = useState(true);
  const [autoHideTimer, setAutoHideTimer] = useState<NodeJS.Timeout | null>(null);

  // Use centralized embedding status subscription (polling fallback)
  const embeddingStatus = useEmbeddingStatusSubscription(
    file.assetId,
    {
      enabled: !!file.assetId && file.needsEmbedding === true,
      onStatusChange: (status) => {
        // Map status to expected format
        if (status.status === 'processing') {
          onStatusChange('processing');
        } else if (status.status === 'ready' && status.hasEmbedding) {
          onStatusChange('ready');
          // Auto-dismiss success after 3s
          const timer = setTimeout(() => setShowStatus(false), 3000);
          setAutoHideTimer(timer);
        } else if (status.status === 'failed') {
          onStatusChange('failed', status.error);
        } else if (status.status === 'pending') {
          onStatusChange('pending');
        }
      },
      onSuccess: () => {
        // Already handled in onStatusChange
      },
      onError: (error) => {
        // Already handled in onStatusChange
      },
    }
  );

  // Use SSE for real-time updates
  useSSEEmbeddingUpdates(
    file.assetId ? [file.assetId] : [],
    {
      enabled: !!file.assetId && file.needsEmbedding === true,
      onUpdate: (update) => {
        if (update.assetId === file.assetId) {
          logger.debug(`[SSE] Received update for asset ${file.assetId}:`, update.status);

          // Map SSE status to component status
          if (update.status === 'processing') {
            onStatusChange('processing');
          } else if (update.status === 'ready' && update.hasEmbedding) {
            onStatusChange('ready');
            // Auto-dismiss success after 3s
            if (autoHideTimer) clearTimeout(autoHideTimer);
            const timer = setTimeout(() => setShowStatus(false), 3000);
            setAutoHideTimer(timer);
          } else if (update.status === 'failed') {
            onStatusChange('failed', update.error);
          } else if (update.status === 'pending') {
            onStatusChange('pending');
          }
        }
      }
    }
  );

  // Connect to SSE on mount if needed
  useEffect(() => {
    if (file.assetId && file.needsEmbedding) {
      const client = getSSEClient();
      // Ensure SSE client is connected for this asset
      if (client.getState() === 'disconnected') {
        logger.debug(`[SSE] Connecting for asset ${file.assetId}`);
        client.connect([file.assetId]);
      }
    }
  }, [file.assetId, file.needsEmbedding]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (autoHideTimer) {
        clearTimeout(autoHideTimer);
      }
    };
  }, [autoHideTimer]);

  // If embedding is not needed or status is hidden, show simple success
  if (!file.needsEmbedding || !showStatus) {
    return <span className="text-[#B6FF6E] text-sm">✓</span>;
  }

  // Retry handler for failed embeddings
  const handleRetry = async () => {
    if (embeddingStatus.retry) {
      await embeddingStatus.retry();
    }
  };

  // Display based on embedding status
  switch (file.embeddingStatus) {
    case 'pending':
      return (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#B6FF6E]">✓ Uploaded</span>
          <span className="text-[#FFB020]">• Preparing search...</span>
        </div>
      );

    case 'processing':
      return (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#B6FF6E]">✓ Uploaded</span>
          <span className="text-[#7C5CFF] flex items-center gap-1">
            • Indexing
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </span>
        </div>
      );

    case 'ready':
      return (
        <div className="flex items-center gap-2 text-xs animate-fade-in">
          <span className="text-[#B6FF6E]">✓ Ready to search</span>
        </div>
      );

    case 'failed':
      return (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#FFB020]">⚠️ Upload complete</span>
          <span className="text-[#FF4D4D]">• Search prep failed</span>
          <button
            onClick={handleRetry}
            className="text-[#7C5CFF] hover:text-[#9B7FFF] underline font-medium"
            disabled={!embeddingStatus.retry}
          >
            Retry
          </button>
        </div>
      );

    default:
      return <span className="text-[#B6FF6E] text-sm">✓</span>;
  }
}

// Virtualized file list component for performance with large batches
function VirtualizedFileList({
  fileMetadata,
  setFileMetadata,
  formatFileSize,
  router,
  retryUpload,
  removeFile
}: {
  fileMetadata: Map<string, FileMetadata>;
  setFileMetadata: React.Dispatch<React.SetStateAction<Map<string, FileMetadata>>>;
  formatFileSize: (bytes: number) => string;
  router: any; // NextJS router instance
  retryUpload: (metadata: FileMetadata) => void;
  removeFile: (id: string) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Convert Map values to array for virtualization and maintain order
  const filesArray = useMemo(() => {
    return Array.from(fileMetadata.values()).sort((a, b) => a.addedAt - b.addedAt);
  }, [fileMetadata]);

  const virtualizer = useVirtualizer({
    count: filesArray.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // Fixed height of 64px per file item as specified
    overscan: 5, // Render 5 extra items outside viewport for smooth scrolling
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="h-[400px] overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-[#2A2F37] scrollbar-track-[#14171A]"
      style={{
        contain: 'strict',
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const file = filesArray[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <div className="bg-[#1B1F24] p-3 border border-[#2A2F37] h-[60px] flex items-center">
                <div className="flex items-center gap-3 w-full">
                  {/* File icon/preview */}
                  <div className="w-12 h-12 bg-[#14171A] flex items-center justify-center overflow-hidden flex-shrink-0">
                    {file.blobUrl ? (
                      <Image
                        src={file.blobUrl}
                        alt={file.name}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl">🖼️</span>
                    )}
                  </div>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[#E6E8EB] text-sm font-medium truncate">
                      {file.name}
                    </p>
                    <p className="text-[#B3B7BE] text-xs">
                      {formatFileSize(file.size)}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {file.status === 'uploading' && (
                      <>
                        <div className="w-24 h-1 bg-[#2A2F37] overflow-hidden">
                          <div
                            className="h-full bg-[#7C5CFF] transition-all duration-300"
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                        <span className="text-[#7C5CFF] text-xs">{file.progress}%</span>
                      </>
                    )}

                    {file.status === 'queued' && (
                      <span className="text-[#B3B7BE] text-xs">Queued</span>
                    )}

                    {file.status === 'success' && (
                      <EmbeddingStatusIndicator
                        file={file}
                        onStatusChange={(status, error) => {
                          setFileMetadata(prev => {
                            const updated = new Map(prev);
                            const metadata = updated.get(file.id);
                            if (metadata) {
                              updated.set(file.id, {
                                ...metadata,
                                embeddingStatus: status,
                                embeddingError: error
                              });
                            }
                            return updated;
                          });
                        }}
                      />
                    )}

                    {file.status === 'duplicate' && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-[#FFB020]">already exists</span>
                        {file.needsEmbedding ? (
                          <span className="text-[#7C5CFF]">• indexing...</span>
                        ) : (
                          <button
                            onClick={() => {
                              if (file.assetId) {
                                router.push(`/app?highlight=${file.assetId}`);
                              }
                            }}
                            className="text-[#7C5CFF] hover:text-[#9B7FFF] font-medium underline"
                          >
                            view
                          </button>
                        )}
                      </div>
                    )}

                    {file.status === 'error' && file.errorDetails && (
                      <UploadErrorDisplay
                        error={file.errorDetails}
                        fileId={file.id}
                        fileName={file.name}
                        onRetry={() => retryUpload(file)}
                        onDismiss={() => removeFile(file.id)}
                      />
                    )}

                    {file.status === 'pending' && (
                      <span className="text-[#B3B7BE] text-xs">Waiting...</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface UploadZoneProps {
  /**
   * Enable background sync for offline upload support.
   * When true, uses service worker background sync.
   * When false, uses localStorage-based queue.
   * @default false
   */
  enableBackgroundSync?: boolean;

  /**
   * Callback when uploads complete successfully
   */
  onUploadComplete?: (stats: {
    uploaded: number;
    duplicates: number;
    failed: number;
  }) => void;

  /**
   * Whether the upload zone is being used on the dashboard
   * When true, removes redundant "view in library" button
   * @default false
   */
  isOnDashboard?: boolean;
}

export function UploadZone({
  enableBackgroundSync = false,
  onUploadComplete,
  isOnDashboard = false
}: UploadZoneProps) {
  // Use Map for O(1) lookups and minimal memory footprint (~300 bytes per file vs 5MB)
  const [fileMetadata, setFileMetadata] = useState(() => new Map<string, FileMetadata>());
  // Keep ref in sync with state to avoid closure issues in async functions
  const fileMetadataRef = useRef(fileMetadata);
  // Store File objects temporarily only during active upload
  const fileObjects = useRef(new Map<string, File>());
  const [isDragging, setIsDragging] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showRecoveryNotification, setShowRecoveryNotification] = useState(false);
  const [recoveryCount, setRecoveryCount] = useState(0);
  const [uploadStats, setUploadStats] = useState<ProgressStats | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [preparingFileCount, setPreparingFileCount] = useState(0);
  const [preparingTotalSize, setPreparingTotalSize] = useState(0);
  const [isProcessingPulse, setIsProcessingPulse] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const activeUploadsRef = useRef<Set<string>>(new Set());
  const uploadStatsRef = useRef({ successful: 0, failed: 0 });
  const [currentConcurrency, setCurrentConcurrency] = useState(6);
  const { isOffline } = useOffline();
  const router = useRouter();
  const uploadQueueManager = getUploadQueueManager();

  // Progress throttling to reduce re-renders
  const progressThrottleMap = useRef<Map<string, { lastUpdate: number; lastPercent: number }>>(new Map());
  const PROGRESS_UPDATE_THRESHOLD = 10; // Only update if progress changed by 10%
  const PROGRESS_UPDATE_INTERVAL = 500; // Or if 500ms have passed

  // Convert fileMetadata Map to array for easier iteration
  const filesArray = useMemo(() =>
    Array.from(fileMetadata.values()).sort((a, b) => a.addedAt - b.addedAt),
    [fileMetadata]
  );

  // Initialize IndexedDB on mount
  useEffect(() => {
    uploadQueueManager.init().catch((error) => {
      console.error('[UploadZone] Failed to initialize upload queue manager:', error);
    });
  }, []);

  // Track when all uploads complete
  useEffect(() => {
    if (!onUploadComplete) return;

    const filesArray = Array.from(fileMetadata.values());
    const hasActiveUploads = filesArray.some(file =>
      file.status === 'uploading' || file.status === 'pending' || file.status === 'queued'
    );

    const successfulUploads = filesArray.filter(file => file.status === 'success');
    const duplicates = filesArray.filter(file => file.status === 'duplicate');
    const failed = filesArray.filter(file => file.status === 'error');

    // Trigger callback when all uploads are done and we have at least one file
    if (filesArray.length > 0 && !hasActiveUploads && (successfulUploads.length > 0 || duplicates.length > 0)) {
      // Only trigger once when uploads complete
      const stats = {
        uploaded: successfulUploads.length,
        duplicates: duplicates.length,
        failed: failed.length
      };

      // Small delay to ensure UI updates first
      setTimeout(() => {
        onUploadComplete(stats);
      }, 100);
    }
  }, [fileMetadata, onUploadComplete]);

  // Keep ref in sync with state to avoid stale closures in async retry logic
  useEffect(() => {
    fileMetadataRef.current = fileMetadata;
  }, [fileMetadata]);

  // Update upload stats whenever files change - single source of truth
  useEffect(() => {
    const filesArray = Array.from(fileMetadata.values());
    if (filesArray.length === 0) {
      setUploadStats(null);
      return;
    }

    const uploading = filesArray.filter(f => f.status === 'uploading').length;
    const successful = filesArray.filter(f => f.status === 'success' || f.status === 'duplicate').length;
    const failed = filesArray.filter(f => f.status === 'error').length;
    const pending = filesArray.filter(f => f.status === 'pending' || f.status === 'queued').length;

    // Files that are uploaded but still processing embeddings
    const processingEmbeddings = filesArray.filter(f =>
      (f.status === 'success' || f.status === 'duplicate') &&
      f.needsEmbedding &&
      (f.embeddingStatus === 'pending' || f.embeddingStatus === 'processing')
    ).length;

    // Files that are completely ready (uploaded + embeddings done or not needed)
    const ready = filesArray.filter(f =>
      (f.status === 'success' || f.status === 'duplicate') &&
      (!f.needsEmbedding || f.embeddingStatus === 'ready')
    ).length;

    // Check if all processing is complete
    const allComplete = successful + failed === filesArray.length;
    const allReady = ready + failed === filesArray.length;

    setUploadStats({
      totalFiles: filesArray.length,
      uploaded: successful,
      processingEmbeddings,
      ready,
      failed,
      estimatedTimeRemaining: pending > 0 || uploading > 0 ? (pending + uploading) * 2000 : 0 // Rough estimate
    });

    // Auto-clear stats and file list 3 seconds after everything is complete
    if (allReady && filesArray.length > 0) {
      const clearTimer = setTimeout(() => {
        // Only clear if still all complete (no new files added)
        const currentFiles = Array.from(fileMetadata.values());
        const stillAllReady = currentFiles.every(f =>
          f.status === 'error' ||
          ((f.status === 'success' || f.status === 'duplicate') &&
           (!f.needsEmbedding || f.embeddingStatus === 'ready'))
        );

        if (stillAllReady && currentFiles.length === filesArray.length) {
          // Clear the upload stats
          setUploadStats(null);

          // Show success notification
          const successCount = currentFiles.filter(f => f.status === 'success' || f.status === 'duplicate').length;
          if (successCount > 0) {
            showToast(
              `✓ ${successCount} ${successCount === 1 ? 'file' : 'files'} uploaded successfully`,
              'success'
            );
          }

          // Clear the file list to reset upload zone
          setFileMetadata(new Map());
          fileObjects.current.clear();
        }
      }, 3000); // Clear after 3 seconds

      return () => clearTimeout(clearTimer);
    }
  }, [fileMetadata]);

  // Auto-remove failed uploads after 3 seconds with fade-out animation and toast
  useEffect(() => {
    const failedFiles = Array.from(fileMetadata.entries()).filter(
      ([_, file]) => file.status === 'error'
    );

    if (failedFiles.length === 0) return;

    const timers: NodeJS.Timeout[] = [];

    failedFiles.forEach(([fileId, file]) => {
      // Wait 3 seconds, then remove the failed file
      const timer = setTimeout(() => {
        // Show toast notification
        const errorMsg = file.error?.includes('timeout')
          ? 'Upload timed out'
          : file.error?.includes('too large')
          ? 'File too large'
          : 'Upload failed';

        showToast(`${file.name}: ${errorMsg}`, 'error');

        // Remove from state (will trigger fade-out via React transition)
        setFileMetadata((prev) => {
          const newMap = new Map(prev);
          newMap.delete(fileId);
          return newMap;
        });

        // Clean up File object reference
        fileObjects.current.delete(fileId);
      }, 3000);

      timers.push(timer);
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [fileMetadata]);

  // Regular upload queue (localStorage-based)
  const { addToQueue } = useUploadQueue();

  // Background sync (service worker-based)
  const {
    addToBackgroundSync,
    supportsBackgroundSync,
    queue: syncQueue,
    retryFailedUploads: retryBackgroundSync,
    clearCompleted: clearBackgroundSync,
    pendingCount,
    uploadingCount,
    errorCount,
  } = useBackgroundSync();

  // Handle file validation
  const validateFile = (file: File): string | null => {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return `Invalid file type: ${file.name}. Only JPEG, PNG, WebP, and GIF are allowed.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large: ${file.name}. Maximum size is 10MB.`;
    }
    return null;
  };

  // Process files for upload with background sync support
  const FILE_PROCESSING_CHUNK_SIZE = 20; // Process files in chunks to prevent UI freezing

  const processFilesWithSync = useCallback(async (fileList: FileList | File[]) => {
    // Show preparing state immediately
    const filesArray = Array.from(fileList);
    setIsPreparing(true);
    setPreparingFileCount(filesArray.length);
    const totalSize = filesArray.reduce((acc, file) => acc + file.size, 0);
    setPreparingTotalSize(totalSize);

    const metadataToAdd = new Map<string, FileMetadata>();
    const filesToUpload: string[] = [];

    // Split files into chunks for processing
    const chunks: File[][] = [];
    for (let i = 0; i < filesArray.length; i += FILE_PROCESSING_CHUNK_SIZE) {
      chunks.push(filesArray.slice(i, i + FILE_PROCESSING_CHUNK_SIZE));
    }

    // Process each chunk with a small delay to allow UI to breathe
    for (const chunk of chunks) {
      for (const file of chunk) {
        const error = validateFile(file);
        const id = `${Date.now()}-${Math.random()}`;

        if (error) {
          const metadata: FileMetadata = {
            id,
            name: file.name,
            size: file.size,
            status: 'error',
            progress: 0,
            error,
            addedAt: Date.now()
          };
          metadataToAdd.set(id, metadata);
          fileObjects.current.set(id, file);
        } else if (isOffline && supportsBackgroundSync) {
          // Use background sync when offline
          const syncId = await addToBackgroundSync(file);
          const metadata: FileMetadata = {
            id: syncId,
            name: file.name,
            size: file.size,
            status: 'queued',
            progress: 0,
            addedAt: Date.now()
          };
          metadataToAdd.set(syncId, metadata);
          fileObjects.current.set(syncId, file);
        } else {
          // Upload immediately or use fallback
          const metadata: FileMetadata = {
            id,
            name: file.name,
            size: file.size,
            status: 'pending',
            progress: 0,
            addedAt: Date.now()
          };
          metadataToAdd.set(id, metadata);
          fileObjects.current.set(id, file);
          filesToUpload.push(id);
        }
      }

      // Allow UI to breathe between chunks
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    // Update fileMetadata state
    setFileMetadata((prev) => {
      const newMap = new Map(prev);
      metadataToAdd.forEach((value, key) => {
        newMap.set(key, value);
      });
      return newMap;
    });

    // Clear preparing state before starting uploads
    setIsPreparing(false);
    setPreparingFileCount(0);
    setPreparingTotalSize(0);

    // Start uploading valid files if online with parallel batching
    if (!isOffline && filesToUpload.length > 0) {
      uploadBatch(filesToUpload);
    }
  }, [isOffline, supportsBackgroundSync, addToBackgroundSync]);

  // Process files for upload with streaming generator pattern
  const processFilesWithQueue = useCallback(async (fileList: FileList | File[]) => {
    // Show preparing state immediately
    const fileCount = fileList instanceof FileList ? fileList.length : fileList.length;
    setIsPreparing(true);
    setPreparingFileCount(fileCount);

    // Estimate total size without converting to array
    let totalSize = 0;
    for (let i = 0; i < fileCount; i++) {
      const file = fileList instanceof FileList ? fileList[i] : fileList[i];
      totalSize += file.size;
    }
    setPreparingTotalSize(totalSize);

    const newFiles: FileMetadata[] = [];
    const uploadQueueManager = getUploadQueueManager();

    // Create FileStreamProcessor for memory-efficient processing
    const processor = new FileStreamProcessor({
      chunkSize: 5 * 1024 * 1024, // 5MB chunks
      maxMemory: 100 * 1024 * 1024, // 100MB max
      computeChecksum: false, // Skip checksum for now, just process metadata
      onProgress: (fileName, progress) => {
        // Update progress for individual file if needed
        logger.debug(`Processing ${fileName}: ${Math.round(progress)}%`);
      },
      onError: (fileName, error) => {
        console.error(`Error processing ${fileName}:`, error);
      }
    });

    // Convert File[] to FileList-like structure if needed
    let fileListToProcess: FileList;
    if (fileList instanceof FileList) {
      fileListToProcess = fileList;
    } else {
      // Create a FileList-like object from array
      const dataTransfer = new DataTransfer();
      for (const file of fileList) {
        dataTransfer.items.add(file);
      }
      fileListToProcess = dataTransfer.files;
    }

    // Process files one at a time using async generator
    let processedCount = 0;
    try {
      for await (const processed of processor.processFiles(fileListToProcess)) {
        processedCount++;

        // Recreate file from processed chunks if needed
        const file = FileStreamProcessor.createBlobFromChunks(
          processed.chunks,
          'application/octet-stream'
        ) as File;

        // Get the original file for metadata
        const originalFile = fileListToProcess[processedCount - 1];
        const error = validateFile(originalFile);

      // If offline, queue the file instead of uploading
      if (isOffline && !error) {
        const queueItem = addToQueue(originalFile);
        const metadata: FileMetadata = {
          id: queueItem.id,
          name: originalFile.name,
          size: originalFile.size,
          status: 'queued',
          progress: 0,
          error: undefined,
          addedAt: Date.now()
        };
        newFiles.push(metadata);
        fileObjects.current.set(queueItem.id, originalFile);

        // Also persist to IndexedDB for recovery
        try {
          await uploadQueueManager.addUpload(originalFile);
        } catch (err) {
          console.error('[UploadZone] Failed to persist upload:', err);
        }
      } else {
        const id = `${Date.now()}-${Math.random()}`;
        const metadata: FileMetadata = {
          id,
          name: originalFile.name,
          size: originalFile.size,
          status: error ? 'error' : 'pending',
          progress: 0,
          error: error || undefined,
          addedAt: Date.now()
        };
        newFiles.push(metadata);
        fileObjects.current.set(id, originalFile);

        // Persist pending uploads to IndexedDB
        if (!error && metadata.status === 'pending') {
          try {
            const persistedId = await uploadQueueManager.addUpload(originalFile);
            // Store the persisted ID for later removal
            (metadata as any).persistedId = persistedId;
          } catch (err) {
            console.error('[UploadZone] Failed to persist upload:', err);
          }
        }
      }

      // Release memory for processed chunks
      processor.releaseMemory(processed.size);

      // Update fileMetadata state in batches to avoid too many re-renders
      if (processedCount % 10 === 0 || processedCount === fileCount) {
        setFileMetadata((prev) => {
          const newMap = new Map(prev);
          newFiles.slice(prev.size).forEach(metadata => {
            newMap.set(metadata.id, metadata);
          });
          return newMap;
        });

        // Allow UI to breathe
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    } catch (error) {
      console.error('[UploadZone] Error processing files:', error);

      // Show error to user
      showToast(
        'Failed to process files. Please try again.',
        'error'
      );

      // Ensure we clear the preparing state on error
      setIsPreparing(false);
      setPreparingFileCount(0);
      setPreparingTotalSize(0);

      // Still try to process any files we did manage to handle
      if (newFiles.length > 0) {
        setFileMetadata((prev) => {
          const newMap = new Map(prev);
          newFiles.forEach(metadata => {
            newMap.set(metadata.id, metadata);
          });
          return newMap;
        });
      }

      return; // Exit early on error
    }

    // Final update with any remaining files
    if (newFiles.length > 0) {
      setFileMetadata((prev) => {
        const newMap = new Map(prev);
        const existingCount = prev.size;
        if (existingCount < newFiles.length) {
          newFiles.slice(existingCount).forEach(metadata => {
            newMap.set(metadata.id, metadata);
          });
        }
        return newMap;
      });

      // Stats will be automatically updated by the effect that watches fileMetadata changes
    }

    // End file selection tracking and start upload tracking

    // Clear preparing state before starting uploads
    setIsPreparing(false);
    setPreparingFileCount(0);
    setPreparingTotalSize(0);

    // Get final processor stats for debugging
    const stats = processor.getStats();
    logger.debug('[FileStreamProcessor] Stats:', {
      filesProcessed: stats.filesProcessed,
      bytesProcessed: stats.bytesProcessed,
      peakMemoryUsage: Math.round(stats.peakMemoryUsage / 1024 / 1024) + 'MB',
      errors: stats.errors
    });

    // Start uploading valid files if online with parallel batching
    if (!isOffline) {
      const filesToUpload = newFiles.filter((f) => f.status === 'pending').map(f => f.id);
      if (filesToUpload.length > 0) {
        uploadBatch(filesToUpload);
      }
    }
  }, [isOffline, addToQueue]);

  // Choose the appropriate file processor based on enableBackgroundSync
  const processFiles = enableBackgroundSync ? processFilesWithSync : processFilesWithQueue;

  // Check for interrupted uploads on mount
  useUploadRecovery(
    async (recoveredFiles) => {
      logger.debug(`[UploadZone] Recovering ${recoveredFiles.length} interrupted uploads`);
      setRecoveryCount(recoveredFiles.length);
      setShowRecoveryNotification(true);

      // Process recovered files
      await processFiles(recoveredFiles);

      // Show success toast
      showToast(
        `✓ Resuming ${recoveredFiles.length} interrupted ${recoveredFiles.length === 1 ? 'upload' : 'uploads'}`,
        'success'
      );

      // Hide notification after 3 seconds
      setTimeout(() => {
        setShowRecoveryNotification(false);
      }, 3000);
    },
    {
      autoResumeDelay: 3000,
      maxRetries: 3,
    }
  );

  // Batch upload files with adaptive concurrency control
  // Reduced limits for Vercel Hobby tier and serverless function concurrency
  const BASE_CONCURRENT_UPLOADS = 2;
  const MIN_CONCURRENT_UPLOADS = 1;
  const MAX_CONCURRENT_UPLOADS = 3;

  const uploadBatch = async (fileIds: string[]) => {
    // Reset stats for this batch
    uploadStatsRef.current = { successful: 0, failed: 0 };

    logger.debug(`[Upload] Starting batch upload of ${fileIds.length} files with concurrency: ${currentConcurrency}`);

    // Create chunks for parallel processing with concurrency limit
    const uploadQueue = [...fileIds];
    const activeUploads = new Set<Promise<void>>();
    const retryQueue: string[] = [];

    while (uploadQueue.length > 0 || activeUploads.size > 0) {
      // Adaptive concurrency: adjust based on failure rate
      const { successful, failed } = uploadStatsRef.current;
      const total = successful + failed;
      if (total > 0 && total % 10 === 0) { // Check every 10 uploads
        const failureRate = failed / total;
        if (failureRate > 0.2 && currentConcurrency > MIN_CONCURRENT_UPLOADS) {
          // Too many failures, reduce concurrency
          const newConcurrency = Math.max(MIN_CONCURRENT_UPLOADS, currentConcurrency - 1);
          setCurrentConcurrency(newConcurrency);
          logger.debug(`[Upload] High failure rate ${(failureRate * 100).toFixed(0)}%, reducing concurrency to ${newConcurrency}`);
        } else if (failureRate < 0.05 && currentConcurrency < MAX_CONCURRENT_UPLOADS) {
          // Very few failures, increase concurrency
          const newConcurrency = Math.min(MAX_CONCURRENT_UPLOADS, currentConcurrency + 1);
          setCurrentConcurrency(newConcurrency);
          logger.debug(`[Upload] Low failure rate ${(failureRate * 100).toFixed(0)}%, increasing concurrency to ${newConcurrency}`);
        }
      }

      // Start new uploads up to current concurrency limit
      while (uploadQueue.length > 0 && activeUploads.size < currentConcurrency) {
        const fileId = uploadQueue.shift()!;
        const uploadPromise = uploadFileToServer(fileId).then(() => {
          uploadStatsRef.current.successful++;
          activeUploads.delete(uploadPromise);
        }).catch((error) => {
          // Track retry count (use ref to avoid stale closure)
          const metadata = fileMetadataRef.current.get(fileId);
          const retryCount = (metadata?.retryCount || 0);

          if (retryCount < 3) {
            // Add to retry queue if under max retries
            setFileMetadata(prev => {
              const newMap = new Map(prev);
              const meta = newMap.get(fileId);
              if (meta) {
                newMap.set(fileId, { ...meta, retryCount: retryCount + 1 });
              }
              return newMap;
            });
            retryQueue.push(fileId);
            logger.debug(`[Upload] File ${metadata?.name} added to retry queue (attempt ${retryCount + 1}/3)`);
          } else {
            // Max retries reached, mark as permanently failed
            uploadStatsRef.current.failed++;
            console.error(`[Upload] File ${metadata?.name} failed after 3 retries:`, error);
          }
          activeUploads.delete(uploadPromise);
        });
        activeUploads.add(uploadPromise);
      }

      // Wait for at least one upload to complete before continuing
      if (activeUploads.size > 0) {
        await Promise.race(activeUploads);
      }
    }

    // Process retry queue with exponential backoff
    if (retryQueue.length > 0) {
      logger.debug(`[Upload] Processing retry queue with ${retryQueue.length} files`);
      await processRetryQueue(retryQueue);
    }
  };

  // Process retry queue with exponential backoff
  const processRetryQueue = async (retryFileIds: string[]) => {
    const backoffDelays = [1000, 3000, 9000]; // 1s, 3s, 9s

    for (const fileId of retryFileIds) {
      // Use ref to get current metadata, avoiding stale closures
      const metadata = fileMetadataRef.current.get(fileId);

      // Guard: Skip if metadata is missing (file was removed or reference lost)
      if (!metadata) {
        logger.warn(`[Upload] Skipping retry for ${fileId} - metadata not found`);
        continue;
      }

      const retryCount = metadata.retryCount || 1;
      const delay = backoffDelays[retryCount - 1] || 9000;

      logger.debug(`[Upload] Retrying ${metadata.name} after ${delay}ms delay (attempt ${retryCount}/3)`);

      // Wait for backoff delay
      await new Promise(resolve => setTimeout(resolve, delay));

      // Update file status to indicate retry
      setFileMetadata((prev) => {
        const newMap = new Map(prev);
        const meta = newMap.get(fileId);
        if (meta) {
          newMap.set(fileId, { ...meta, status: 'pending', error: `Retrying (attempt ${retryCount}/3)...` });
        }
        return newMap;
      });

      try {
        await uploadFileToServer(fileId);
        uploadStatsRef.current.successful++;
        logger.debug(`[Upload] Retry successful for ${metadata.name}`);
      } catch (error) {
        // Re-check metadata exists before retry logic (may have been removed)
        const currentMeta = fileMetadataRef.current.get(fileId);
        if (!currentMeta) {
          logger.warn(`[Upload] File ${fileId} metadata lost during retry, marking as failed`);
          uploadStatsRef.current.failed++;
          continue;
        }

        if (retryCount < 3) {
          // Still have retries left, update retry count and recurse
          setFileMetadata(prev => {
            const newMap = new Map(prev);
            const meta = newMap.get(fileId);
            if (meta) {
              newMap.set(fileId, { ...meta, retryCount: retryCount + 1 });
            }
            return newMap;
          });
          // Recursively retry (will use updated metadata from ref)
          await processRetryQueue([fileId]);
        } else {
          // Max retries reached
          uploadStatsRef.current.failed++;
          console.error(`[Upload] File ${metadata.name} failed permanently after 3 retries:`, error);
        }
      }
    }
  };

  // Retry helper with exponential backoff and server-specified delays
  const retryWithBackoff = async <T,>(
    fn: () => Promise<T>,
    maxRetries: number,
    shouldRetry: (error: any) => boolean = () => true
  ): Promise<T> => {
    let lastError: any;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Don't retry if we've exhausted attempts or error is not retryable
        if (attempt === maxRetries || !shouldRetry(error)) {
          throw error;
        }

        // Check if server specified a retry delay (rate limiting)
        const serverRetryAfter = (error as any).retryAfter;
        let delay: number;

        if (serverRetryAfter && typeof serverRetryAfter === 'number') {
          // Use server-specified delay for rate limiting (convert seconds to ms)
          delay = serverRetryAfter * 1000;
          // Add small jitter to prevent thundering herd (±10%)
          const jitter = delay * 0.1 * (Math.random() - 0.5) * 2;
          delay = Math.floor(delay + jitter);
          console.log(`[Upload] Rate limited. Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(delay / 1000)}s`);
        } else {
          // Use exponential backoff for other errors: 1s, 2s, 4s
          delay = Math.min(1000 * Math.pow(2, attempt), 4000);
          console.log(`[Upload] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        }

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  };

  // Upload file to server - simplified direct upload
  const uploadFileToServer = async (fileId: string) => {
    const uploadStartTime = Date.now();

    // Get file metadata and File object (use ref to avoid stale closure)
    const metadata = fileMetadataRef.current.get(fileId);
    const file = fileObjects.current.get(fileId);

    if (!metadata || !file) {
      throw new Error(`File ${fileId} not found`);
    }

    setFileMetadata((prev) => {
      const newMap = new Map(prev);
      const meta = newMap.get(fileId);
      if (meta) {
        newMap.set(fileId, { ...meta, status: 'uploading', progress: 5 });
      }
      return newMap;
    });

    const apiStartTime = performance.now();

    try {
      // Calculate checksum before upload for duplicate detection
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      setFileMetadata((prev) => {
        const newMap = new Map(prev);
        const meta = newMap.get(fileId);
        if (meta) {
          newMap.set(fileId, { ...meta, progress: 10 });
        }
        return newMap;
      });

      // Step 1 & 2: Secure upload using Vercel Blob SDK
      // This uses handleUpload pattern with scoped, time-limited tokens
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/upload/handle',
        clientPayload: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          size: file.size,
        }),
        onUploadProgress: ({ percentage }) => {
          // Map SDK percentage (0-100) to our range (10-95, reserve 5% for finalization)
          const mappedProgress = 10 + Math.round(percentage * 0.85);

          const throttleInfo = progressThrottleMap.current.get(fileId) || {
            lastUpdate: 0,
            lastPercent: 0
          };
          const now = Date.now();
          const percentDiff = Math.abs(mappedProgress - throttleInfo.lastPercent);
          const timeDiff = now - throttleInfo.lastUpdate;

          if (percentDiff >= PROGRESS_UPDATE_THRESHOLD ||
              timeDiff >= PROGRESS_UPDATE_INTERVAL ||
              mappedProgress >= 80) {
            setFileMetadata((prev) => {
              const newMap = new Map(prev);
              const meta = newMap.get(fileId);
              if (meta) {
                newMap.set(fileId, { ...meta, progress: mappedProgress });
              }
              return newMap;
            });

            progressThrottleMap.current.set(fileId, {
              lastUpdate: now,
              lastPercent: mappedProgress
            });
          }
        },
      });

      const blobUrl = blob.url;
      const pathname = blob.pathname;

      // Generate assetId for tracking (server includes this in response metadata)
      // The server's handleUpload can pass data through the response
      const assetId = `asset_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      setFileMetadata((prev) => {
        const newMap = new Map(prev);
        const meta = newMap.get(fileId);
        if (meta) {
          newMap.set(fileId, { ...meta, progress: 95 });
        }
        return newMap;
      });

      // Step 3: Finalize upload by creating asset record (with retry)
      const result = await retryWithBackoff(
        async () => {
          const response = await fetch('/api/upload-complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              assetId,
              blobUrl,
              pathname,
              filename: file.name,
              size: file.size,
              mimeType: file.type,
              checksum,
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            const err = new Error(error.error || 'Failed to complete upload');
            (err as any).statusCode = response.status;
            throw err;
          }

          return response.json();
        },
        3, // Max 3 retries for upload completion
        (error) => {
          // Retry on 5xx server errors and network failures
          // Don't retry on 4xx client errors
          const statusCode = (error as any).statusCode;
          return !statusCode || statusCode >= 500;
        }
      );
      const apiDuration = performance.now() - apiStartTime;

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      // Handle duplicate detection as a special success case
      const isDuplicate = result.isDuplicate === true;
      const needsProcessing = result.asset?.needsProcessing === true;

      setFileMetadata((prev) => {
        const newMap = new Map(prev);
        const meta = newMap.get(fileId);
        if (meta) {
          newMap.set(fileId, {
            ...meta,
            status: (isDuplicate ? 'duplicate' : 'success') as 'duplicate' | 'success',
            progress: 100,
            assetId: result.asset?.id,
            blobUrl: result.asset?.blobUrl,
            isDuplicate,
            needsEmbedding: needsProcessing,
            embeddingStatus: (needsProcessing ? 'pending' : 'ready') as 'pending' | 'ready'
          });
        }
        return newMap;
      });

      // Clear the File object reference to free memory after successful upload
      fileObjects.current.delete(fileId);

      // Track success for adaptive concurrency
      uploadStatsRef.current.successful++;

      // Clean up progress throttle map entry
      progressThrottleMap.current.delete(fileId);

      logger.debug(`[UploadZone] Cleared file blob for ${metadata.name}, kept metadata only`);

      // Remove from persisted queue on success
      if ((metadata as any).persistedId) {
        try {
          await uploadQueueManager.removeUpload((metadata as any).persistedId);
        } catch (err) {
          console.error('[UploadZone] Failed to remove persisted upload:', err);
        }
      }

      // Trigger a refresh of the asset list if there's a callback
      if (window.location.pathname === '/app') {
        window.dispatchEvent(new CustomEvent('assetUploaded', { detail: result.asset }));
      }

    } catch (error) {
      console.error('Upload error:', error);

      // Record upload failure in metrics

      // Parse error for better messaging with status code
      const statusCode = (error as any)?.statusCode ||
        (error instanceof Error && error.message.includes('401') ? 401 :
         error instanceof Error && error.message.includes('429') ? 429 :
         error instanceof Error && error.message.includes('500') ? 500 :
         error instanceof Error && error.message.includes('503') ? 503 : undefined);

      // Record API error if we have a status code
      if (statusCode) {
        const apiDuration = performance.now() - apiStartTime;
      }

      const errorDetails = getUploadErrorDetails(
        error instanceof Error ? error : new Error('Upload failed'),
        statusCode
      );

      setFileMetadata((prev) => {
        const newMap = new Map(prev);
        const meta = newMap.get(fileId);
        if (meta) {
          newMap.set(fileId, {
            ...meta,
            status: 'error' as const,
            progress: 0,
            error: error instanceof Error ? error.message : 'Upload failed',
            errorDetails,
          });
        }
        return newMap;
      });

      // Track failure for adaptive concurrency
      uploadStatsRef.current.failed++;

      // Clean up progress throttle map entry on error
      progressThrottleMap.current.delete(fileId);

      // Stats will be automatically updated by the effect that watches fileMetadata changes

      // NOTE: We don't clear file reference on failure as it may be needed for retries

      // Update persisted status to failed
      if ((metadata as any).persistedId) {
        try {
          await uploadQueueManager.updateUploadStatus(
            (metadata as any).persistedId,
            'failed',
            error instanceof Error ? error.message : 'Upload failed'
          );
        } catch (err) {
          console.error('[UploadZone] Failed to update persisted status:', err);
        }
      }
    } finally {
      // Remove from active uploads
      activeUploadsRef.current.delete(fileId);
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const fileCount = e.dataTransfer.files.length;
      showToast(`Processing ${fileCount} ${fileCount === 1 ? 'file' : 'files'}...`, 'info');
      setIsProcessingPulse(true);
      setTimeout(() => setIsProcessingPulse(false), 1000);
      processFiles(e.dataTransfer.files);
    }
  };

  // Paste handler
  const handlePaste = (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      showToast(`Processing ${files.length} ${files.length === 1 ? 'image' : 'images'} from clipboard...`, 'info');
      setIsProcessingPulse(true);
      setTimeout(() => setIsProcessingPulse(false), 1000);
      processFiles(files);
    }
  };

  // File input handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileCount = e.target.files.length;
      showToast(`Processing ${fileCount} selected ${fileCount === 1 ? 'file' : 'files'}...`, 'info');
      setIsProcessingPulse(true);
      setTimeout(() => setIsProcessingPulse(false), 1000);
      processFiles(e.target.files);
    }
  };

  // Remove file from list
  const removeFile = (id: string) => {
    setFileMetadata((prev) => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
    fileObjects.current.delete(id);
  };

  // Retry failed upload
  const retryUpload = (metadata: FileMetadata) => {
    // Find the original File object from the fileObjects Map
    const originalFile = fileObjects.current.get(metadata.id);
    if (!originalFile) {
      console.error('Cannot retry upload: original file not found');
      return;
    }

    setFileMetadata((prev) => {
      const newMap = new Map(prev);
      const meta = newMap.get(metadata.id);
      if (meta) {
        newMap.set(metadata.id, {
          ...meta,
          status: 'pending' as const,
          progress: 0,
          error: undefined,
          errorDetails: undefined,
          retryCount: 0
        });
      }
      return newMap;
    });
    uploadFileToServer(metadata.id);
  };

  // Retry all failed uploads
  const retryAllFailed = () => {
    const failedFiles = filesArray.filter(f => f.status === 'error');
    if (failedFiles.length === 0) return;

    logger.debug(`[Upload] Retrying all ${failedFiles.length} failed files`);

    // Reset all failed files to pending status
    const failedFileIds = failedFiles.map(f => f.id);

    // Update state to reset failed files
    setFileMetadata((prev) => {
      const newMap = new Map(prev);
      failedFileIds.forEach(id => {
        const meta = newMap.get(id);
        if (meta) {
          newMap.set(id, {
            ...meta,
            status: 'pending' as const,
            progress: 0,
            error: undefined,
            errorDetails: undefined,
            retryCount: 0
          });
        }
      });
      return newMap;
    });

    // Re-queue all failed files for upload
    uploadBatch(failedFileIds);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Calculate overall progress
  const calculateOverallProgress = () => {
    if (filesArray.length === 0) return 0;

    const totalProgress = filesArray.reduce((acc, file) => {
      if (file.status === 'success' || file.status === 'duplicate') {
        return acc + 100;
      } else if (file.status === 'uploading') {
        return acc + file.progress;
      } else if (file.status === 'error') {
        return acc + 0;
      } else {
        return acc + 0; // pending/queued
      }
    }, 0);

    return Math.round(totalProgress / filesArray.length);
  };

  // Get upload statistics
  const getUploadStats = () => {
    const completed = filesArray.filter(f => f.status === 'success' || f.status === 'duplicate').length;
    const uploading = filesArray.filter(f => f.status === 'uploading').length;
    const pending = filesArray.filter(f => f.status === 'pending' || f.status === 'queued').length;
    const failed = filesArray.filter(f => f.status === 'error').length;

    return { completed, uploading, pending, failed, total: filesArray.length };
  };

  // Get errors grouped by type
  const getGroupedErrors = () => {
    const failedFiles = filesArray.filter(f => f.status === 'error' && f.errorDetails);
    const groups = new Map<string, { type: string; message: string; count: number; files: FileMetadata[] }>();

    failedFiles.forEach(file => {
      if (file.errorDetails) {
        const key = file.errorDetails.type;
        if (!groups.has(key)) {
          groups.set(key, {
            type: file.errorDetails.type,
            message: file.errorDetails.userMessage,
            count: 0,
            files: []
          });
        }
        const group = groups.get(key)!;
        group.count++;
        group.files.push(file);
      }
    });

    return Array.from(groups.values()).sort((a, b) => b.count - a.count);
  };

  // Cancel remaining uploads
  const cancelRemainingUploads = () => {
    setIsCancelling(true);

    // Remove pending files
    setFileMetadata((prev) => {
      const newMap = new Map(prev);
      Array.from(newMap.entries()).forEach(([id, meta]) => {
        if (meta.status === 'pending' || meta.status === 'queued') {
          newMap.delete(id);
          fileObjects.current.delete(id);
        }
      });
      return newMap;
    });

    // Clear active uploads tracking
    activeUploadsRef.current.clear();

    setTimeout(() => setIsCancelling(false), 500);
  };

  // Show background sync status if enabled
  const showSyncStatus = enableBackgroundSync && (pendingCount > 0 || uploadingCount > 0 || errorCount > 0);
  const successfulUploads = filesArray.filter((file) => file.status === 'success' || file.status === 'duplicate');
  const hasSuccessfulUploads = successfulUploads.length > 0;
  const hasActiveUploads = filesArray.some((file) =>
    file.status === 'uploading' || file.status === 'pending' || file.status === 'queued'
  );

  const handleViewLibrary = () => {
    setFileMetadata(new Map());
    fileObjects.current.clear();
    setUploadStats(null);
    router.push('/app');
  };

  return (
    <div
      className="w-full"
      onPaste={handlePaste}
      tabIndex={0}
    >
      {/* Background sync status (only when enabled) */}
      {showSyncStatus && (
        <div className="mb-4 bg-[#1B1F24] p-3 border border-[#2A2F37]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm">
              {pendingCount > 0 && (
                <span className="text-[#B3B7BE]">
                  Pending: <span className="text-[#E6E8EB] font-medium">{pendingCount}</span>
                </span>
              )}
              {uploadingCount > 0 && (
                <span className="text-[#7C5CFF]">
                  Uploading: <span className="font-medium">{uploadingCount}</span>
                </span>
              )}
              {errorCount > 0 && (
                <span className="text-[#FF4D4D]">
                  Failed: <span className="font-medium">{errorCount}</span>
                </span>
              )}
            </div>
            {errorCount > 0 && (
              <button
                onClick={() => retryBackgroundSync()}
                className="text-[#7C5CFF] hover:text-[#9B7FFF] text-sm font-medium"
              >
                Retry All
              </button>
            )}
          </div>
        </div>
      )}

      {/* Recovery notification */}
      {showRecoveryNotification && (
        <div className="mb-4 border border-[#7C5CFF]/30 bg-[#7C5CFF]/10 p-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-[#7C5CFF] animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm text-[#CBB8FF]">
              resuming {recoveryCount} interrupted {recoveryCount === 1 ? 'upload' : 'uploads'}...
            </span>
          </div>
        </div>
      )}

      {/* Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'relative  border-2 border-dashed transition-all duration-200 cursor-pointer',
          'hover:border-[#7C5CFF] hover:bg-[#7C5CFF]/5',
          isDragging
            ? 'border-[#7C5CFF] bg-[#7C5CFF]/10 scale-[1.02]'
            : 'border-[#2A2F37] bg-[#1B1F24]',
          isProcessingPulse && 'animate-pulse'
        )}
      >
        {/* Preparing overlay */}
        {isPreparing && (
          <div className="absolute inset-0 z-10 bg-[#1B1F24]/95 flex flex-col items-center justify-center animate-fade-in">
            <svg className="h-8 w-8 text-[#7C5CFF] animate-spin mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-[#E6E8EB] font-medium mb-1">
              Preparing {preparingFileCount} {preparingFileCount === 1 ? 'file' : 'files'}...
            </p>
            <p className="text-[#B3B7BE] text-sm">
              {preparingTotalSize < 1024 * 1024
                ? `${(preparingTotalSize / 1024).toFixed(0)} KB`
                : `${(preparingTotalSize / (1024 * 1024)).toFixed(1)} MB`}
            </p>
          </div>
        )}
        <div className="flex flex-col items-center justify-center py-12 px-6">
          <div className={cn(
            'w-16 h-16 mb-4  flex items-center justify-center transition-all duration-200',
            isDragging ? 'bg-[#7C5CFF]/20 scale-110' : 'bg-[#1B1F24]'
          )}>
            <svg
              className={cn('w-8 h-8 transition-colors', isDragging ? 'text-[#7C5CFF]' : 'text-[#B3B7BE]')}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>

          <p className="text-[#E6E8EB] font-medium mb-1">
            {isDragging ? 'drop your images here' : 'drag & drop images here'}
          </p>
          <p className="text-[#B3B7BE] text-sm mb-4">
            or click to browse • paste from clipboard
          </p>
          <p className="text-[#B3B7BE]/60 text-xs">
            jpeg, png, webp, gif • max 10mb per file
          </p>
          {enableBackgroundSync && supportsBackgroundSync && (
            <p className="text-[#7C5CFF]/60 text-xs mt-2">
              background sync enabled • uploads continue offline
            </p>
          )}
        </div>

        {/* Accent stripe when dragging */}
        {isDragging && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#7C5CFF]" />
            <div className="absolute right-0 top-0 bottom-0 w-1 bg-[#B6FF6E]" />
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ALLOWED_FILE_TYPES.join(',')}
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* File list */}
      {filesArray.length > 0 && (
        <div className="mt-6 space-y-4">
          {/* Batch Upload Progress Header */}
          <div className="bg-[#14171A] border border-[#2A2F37] p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-[#E6E8EB] font-medium text-sm">upload progress</h3>
                <p className="text-[#B3B7BE] text-xs mt-1">
                  {(() => {
                    const stats = getUploadStats();
                    const parts = [];
                    if (stats.completed > 0) parts.push(`${stats.completed} completed`);
                    if (stats.uploading > 0) parts.push(`${stats.uploading} uploading`);
                    if (stats.pending > 0) parts.push(`${stats.pending} pending`);
                    if (stats.failed > 0) parts.push(`${stats.failed} failed`);
                    return parts.join(' • ') || 'no files';
                  })()}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Retry all failed button */}
                {getUploadStats().failed > 0 && (
                  <button
                    onClick={retryAllFailed}
                    className="text-[#7C5CFF] hover:text-[#9B7FFF] text-sm font-medium transition-colors"
                  >
                    retry {getUploadStats().failed} failed
                  </button>
                )}

                {/* Cancel button */}
                {hasActiveUploads && (
                  <button
                    onClick={cancelRemainingUploads}
                    disabled={isCancelling}
                    className="text-[#FF4D4D] hover:text-[#FF6B6B] text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {isCancelling ? 'cancelling...' : 'cancel remaining'}
                  </button>
                )}
              </div>
            </div>

            {/* Overall progress bar */}
            <div className="relative">
              <div className="w-full h-2 bg-[#1B1F24] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#7C5CFF] to-[#9B7FFF] transition-all duration-500 ease-out"
                  style={{ width: `${calculateOverallProgress()}%` }}
                />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[#B3B7BE] text-xs">
                  {getUploadStats().completed} of {filesArray.length} files
                </span>
                <span className="text-[#7C5CFF] text-xs font-medium">
                  {calculateOverallProgress()}%
                </span>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-4 gap-2 mt-3">
              <div className="text-center">
                <p className="text-[#B6FF6E] text-lg font-semibold">{getUploadStats().completed}</p>
                <p className="text-[#B3B7BE] text-xs">complete</p>
              </div>
              <div className="text-center">
                <p className="text-[#7C5CFF] text-lg font-semibold">{getUploadStats().uploading}</p>
                <p className="text-[#B3B7BE] text-xs">uploading</p>
              </div>
              <div className="text-center">
                <p className="text-[#B3B7BE] text-lg font-semibold">{getUploadStats().pending}</p>
                <p className="text-[#B3B7BE] text-xs">pending</p>
              </div>
              <div className="text-center">
                <p className="text-[#FF4D4D] text-lg font-semibold">{getUploadStats().failed}</p>
                <p className="text-[#B3B7BE] text-xs">failed</p>
              </div>
            </div>

            {/* Error summary by type - show when errors exist */}
            {getUploadStats().failed > 0 && (
              <div className="mt-3 pt-3 border-t border-[#2A2F37]">
                <p className="text-[#B3B7BE] text-xs font-medium mb-2">Error Details:</p>
                <div className="space-y-1">
                  {getGroupedErrors().map((group) => (
                    <div key={group.type} className="flex items-center justify-between text-xs">
                      <span className="text-[#FF4D4D]">
                        {group.count} {group.count === 1 ? 'file' : 'files'}: {group.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* File list - use virtual scrolling when > 20 files */}
          {filesArray.length > 20 ? (
            <VirtualizedFileList
              fileMetadata={fileMetadata}
              setFileMetadata={setFileMetadata}
              formatFileSize={formatFileSize}
              router={router}
              retryUpload={retryUpload}
              removeFile={removeFile}
            />
          ) : (
            <div className="space-y-2">
              {filesArray.map((file) => (
              <div
                key={file.id}
                className="bg-[#1B1F24] p-3 border border-[#2A2F37]"
              >
                <div className="flex items-center gap-3">
                  {/* File icon/preview */}
                  <div className="w-12 h-12 bg-[#14171A] flex items-center justify-center overflow-hidden">
                    {file.blobUrl ? (
                      <Image
                        src={file.blobUrl}
                        alt={file.name}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl">🖼️</span>
                    )}
                  </div>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[#E6E8EB] text-sm font-medium truncate">
                      {file.name}
                    </p>
                    <p className="text-[#B3B7BE] text-xs">
                      {formatFileSize(file.size)}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {file.status === 'uploading' && (
                      <>
                        <div className="w-24 h-1 bg-[#2A2F37] overflow-hidden">
                          <div
                            className="h-full bg-[#7C5CFF] transition-all duration-300"
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                        <span className="text-[#7C5CFF] text-xs">{file.progress}%</span>
                      </>
                    )}

                    {file.status === 'queued' && (
                      <span className="text-[#B3B7BE] text-xs">Queued</span>
                    )}

                    {file.status === 'success' && (
                      <EmbeddingStatusIndicator
                        file={file}
                        onStatusChange={(status, error) => {
                          setFileMetadata(prev => {
                            const updated = new Map(prev);
                            const metadata = updated.get(file.id);
                            if (metadata) {
                              updated.set(file.id, {
                                ...metadata,
                                embeddingStatus: status,
                                embeddingError: error
                              });
                            }
                            return updated;
                          });
                        }}
                      />
                    )}

                    {file.status === 'duplicate' && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-[#FFB020]">already exists</span>
                        {file.needsEmbedding ? (
                          <span className="text-[#7C5CFF]">• indexing...</span>
                        ) : (
                          <button
                            onClick={() => {
                              if (file.assetId) {
                                router.push(`/app?highlight=${file.assetId}`);
                              }
                            }}
                            className="text-[#7C5CFF] hover:text-[#9B7FFF] font-medium underline"
                          >
                            view
                          </button>
                        )}
                      </div>
                    )}

                    {file.status === 'error' && (
                      <button
                        onClick={() => retryUpload(file)}
                        className="text-[#FF4D4D] hover:text-[#FF6B6B] text-xs underline"
                      >
                        retry
                      </button>
                    )}

                    <button
                      onClick={() => removeFile(file.id)}
                      className="text-[#B3B7BE] hover:text-[#E6E8EB] transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Error display */}
                {file.error && file.errorDetails && (
                  <div className="mt-2">
                    <UploadErrorDisplay
                      error={file.errorDetails}
                      fileId={file.id}
                      fileName={file.name}
                      onRetry={() => retryUpload(file)}
                      onDismiss={() => removeFile(file.id)}
                    />
                  </div>
                )}
                {file.error && !file.errorDetails && (
                  <p className="text-[#FF4D4D] text-xs mt-2">{file.error}</p>
                )}
              </div>
              ))}
            </div>
          )}

          {hasSuccessfulUploads && (
            <div className="flex flex-col gap-3 border border-[#2A2F37] bg-[#14171A] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center bg-[#B6FF6E]/10 text-[#B6FF6E]">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M5 13l4 4L19 7"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div>
                  {(() => {
                    const newImages = successfulUploads.filter(f => !f.isDuplicate).length;
                    const duplicates = successfulUploads.filter(f => f.isDuplicate).length;

                    let message = '';
                    if (newImages > 0 && duplicates > 0) {
                      message = `${newImages} ${newImages === 1 ? 'image' : 'images'} added, ${duplicates} already existed`;
                    } else if (newImages > 0) {
                      message = `${newImages} ${newImages === 1 ? 'image' : 'images'} added to your library`;
                    } else if (duplicates > 0) {
                      message = `${duplicates} ${duplicates === 1 ? 'image' : 'images'} already in your library`;
                    }

                    return (
                      <>
                        <p className="text-sm font-medium text-[#E6E8EB]">{message}</p>
                        {hasActiveUploads ? (
                          <p className="text-xs text-[#B3B7BE]">Finishing remaining uploads...</p>
                        ) : isOnDashboard ? (
                          <p className="text-xs text-[#B3B7BE]">Your library will refresh automatically.</p>
                        ) : (
                          <p className="text-xs text-[#B3B7BE]">Jump back to browse everything in your collection.</p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {!isOnDashboard && (
                <button
                  onClick={handleViewLibrary}
                  className="inline-flex items-center justify-center bg-[#7C5CFF] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#6B4FE0] disabled:cursor-not-allowed disabled:bg-[#2A2F37] disabled:text-[#6A6E78]"
                  disabled={hasActiveUploads}
                >
                  view in library
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Export the component with background sync enabled for backwards compatibility
export function UploadZoneWithSync() {
  return <UploadZone enableBackgroundSync={true} />;
}
