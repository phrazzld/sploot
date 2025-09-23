'use client';

import { useState, useRef, useCallback, useEffect, DragEvent, ClipboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from '@/lib/blob';
import { cn } from '@/lib/utils';
import { useOffline } from '@/hooks/use-offline';
import { useUploadQueue } from '@/hooks/use-upload-queue';
import { useBackgroundSync } from '@/hooks/use-background-sync';
import { TagInput } from '@/components/tags/tag-input';
import { UploadErrorDisplay } from '@/components/upload/upload-error-display';
import { getUploadErrorDetails, UploadErrorDetails } from '@/lib/upload-errors';
import { useEmbeddingStatus } from '@/hooks/use-embedding-status';
import { getGlobalPerformanceTracker, PERF_OPERATIONS } from '@/lib/performance';
import { getUploadQueueManager, useUploadRecovery } from '@/lib/upload-queue';
import { showToast } from '@/components/ui/toast';
import { UploadProgressHeader, ProgressStats } from './upload-progress-header';

interface UploadFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'queued' | 'duplicate';
  progress: number;
  error?: string;
  errorDetails?: UploadErrorDetails;
  assetId?: string;
  blobUrl?: string;
  isDuplicate?: boolean;
  needsEmbedding?: boolean;
  embeddingStatus?: 'pending' | 'processing' | 'ready' | 'failed';
  embeddingError?: string;
}

// Component to handle inline embedding status display
function EmbeddingStatusIndicator({
  file,
  onStatusChange
}: {
  file: UploadFile;
  onStatusChange: (status: 'pending' | 'processing' | 'ready' | 'failed', error?: string) => void;
}) {
  const [showStatus, setShowStatus] = useState(true);
  const [autoHideTimer, setAutoHideTimer] = useState<NodeJS.Timeout | null>(null);

  // Monitor embedding status if needed
  const embeddingStatus = useEmbeddingStatus({
    assetId: file.assetId || '',
    enabled: !!file.assetId && file.needsEmbedding === true,
    pollInterval: 1500,
    maxRetries: 5,
    onSuccess: () => {
      onStatusChange('ready');
      // Auto-dismiss success after 3s
      const timer = setTimeout(() => setShowStatus(false), 3000);
      setAutoHideTimer(timer);
    },
    onError: (error) => {
      onStatusChange('failed', error.message);
      // Keep failures visible
    },
  });

  // Update status based on embedding monitor
  useEffect(() => {
    if (embeddingStatus.isGenerating) {
      onStatusChange('processing');
    }
  }, [embeddingStatus.isGenerating, onStatusChange]);

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
    if (embeddingStatus.canRetry) {
      embeddingStatus.retry();
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
            disabled={!embeddingStatus.canRetry}
          >
            Retry
          </button>
        </div>
      );

    default:
      return <span className="text-[#B6FF6E] text-sm">✓</span>;
  }
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
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [showRecoveryNotification, setShowRecoveryNotification] = useState(false);
  const [recoveryCount, setRecoveryCount] = useState(0);
  const [uploadStats, setUploadStats] = useState<ProgressStats | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const activeUploadsRef = useRef<Set<string>>(new Set());
  const { isOffline, isSlowConnection } = useOffline();
  const router = useRouter();
  const uploadQueueManager = getUploadQueueManager();

  // Initialize IndexedDB on mount
  useEffect(() => {
    uploadQueueManager.init().catch((error) => {
      console.error('[UploadZone] Failed to initialize upload queue manager:', error);
    });
  }, []);

  // Track when all uploads complete
  useEffect(() => {
    if (!onUploadComplete) return;

    const hasActiveUploads = files.some(file =>
      file.status === 'uploading' || file.status === 'pending' || file.status === 'queued'
    );

    const successfulUploads = files.filter(file => file.status === 'success');
    const duplicates = files.filter(file => file.status === 'duplicate');
    const failed = files.filter(file => file.status === 'error');

    // Trigger callback when all uploads are done and we have at least one file
    if (files.length > 0 && !hasActiveUploads && (successfulUploads.length > 0 || duplicates.length > 0)) {
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
  }, [files, onUploadComplete]);

  // Update upload stats whenever files change
  useEffect(() => {
    if (files.length === 0) {
      setUploadStats(null);
      return;
    }

    const uploading = files.filter(f => f.status === 'uploading').length;
    const successful = files.filter(f => f.status === 'success' || f.status === 'duplicate').length;
    const failed = files.filter(f => f.status === 'error').length;
    const pending = files.filter(f => f.status === 'pending' || f.status === 'queued').length;
    const processingEmbeddings = files.filter(f =>
      f.embeddingStatus === 'pending' || f.embeddingStatus === 'processing'
    ).length;
    const ready = files.filter(f =>
      f.embeddingStatus === 'ready' || (!f.needsEmbedding && (f.status === 'success' || f.status === 'duplicate'))
    ).length;

    setUploadStats({
      totalFiles: files.length,
      uploaded: successful,
      processingEmbeddings,
      ready,
      failed,
      estimatedTimeRemaining: pending > 0 || uploading > 0 ? (pending + uploading) * 2000 : 0 // Rough estimate
    });
  }, [files]);

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
  const processFilesWithSync = useCallback(async (fileList: FileList | File[]) => {
    const newFiles: UploadFile[] = [];

    for (const file of Array.from(fileList)) {
      const error = validateFile(file);

      if (error) {
        newFiles.push({
          id: `${Date.now()}-${Math.random()}`,
          file,
          status: 'error',
          progress: 0,
          error,
        });
      } else if (isOffline && supportsBackgroundSync) {
        // Use background sync when offline
        const id = await addToBackgroundSync(file);
        newFiles.push({
          id,
          file,
          status: 'queued',
          progress: 0,
        });
      } else {
        // Upload immediately or use fallback
        newFiles.push({
          id: `${Date.now()}-${Math.random()}`,
          file,
          status: 'pending',
          progress: 0,
        });
      }
    }

    setFiles((prev) => [...prev, ...newFiles]);

    // Start uploading valid files if online with parallel batching
    if (!isOffline) {
      const filesToUpload = newFiles.filter((f) => f.status === 'pending');
      if (filesToUpload.length > 0) {
        uploadBatch(filesToUpload);
      }
    }
  }, [isOffline, supportsBackgroundSync, addToBackgroundSync]);

  // Process files for upload with regular queue
  const processFilesWithQueue = useCallback(async (fileList: FileList | File[]) => {
    const tracker = getGlobalPerformanceTracker();
    tracker.start(PERF_OPERATIONS.CLIENT_FILE_SELECT);
    const newFiles: UploadFile[] = [];

    for (const file of Array.from(fileList)) {
      const error = validateFile(file);

      // If offline, queue the file instead of uploading
      if (isOffline && !error) {
        const queueItem = addToQueue(file);
        newFiles.push({
          id: queueItem.id,
          file,
          status: 'queued',
          progress: 0,
          error: undefined,
        });

        // Also persist to IndexedDB for recovery
        try {
          await uploadQueueManager.addUpload(file);
        } catch (err) {
          console.error('[UploadZone] Failed to persist upload:', err);
        }
      } else {
        const uploadFile: UploadFile = {
          id: `${Date.now()}-${Math.random()}`,
          file,
          status: error ? 'error' : 'pending',
          progress: 0,
          error: error || undefined,
        };
        newFiles.push(uploadFile);

        // Persist pending uploads to IndexedDB
        if (!error && uploadFile.status === 'pending') {
          try {
            const persistedId = await uploadQueueManager.addUpload(file);
            // Store the persisted ID for later removal
            (uploadFile as any).persistedId = persistedId;
          } catch (err) {
            console.error('[UploadZone] Failed to persist upload:', err);
          }
        }
      }
    }

    setFiles((prev) => [...prev, ...newFiles]);

    // Initialize upload stats for immediate feedback
    if (newFiles.length > 0) {
      const errorCount = newFiles.filter(f => f.status === 'error').length;
      setUploadStats({
        totalFiles: newFiles.length,
        uploaded: 0,
        processingEmbeddings: 0,
        ready: 0,
        failed: errorCount,
        estimatedTimeRemaining: 0
      });
    }

    // End file selection tracking and start upload tracking
    tracker.end(PERF_OPERATIONS.CLIENT_FILE_SELECT);

    // Start uploading valid files if online with parallel batching
    if (!isOffline) {
      const filesToUpload = newFiles.filter((f) => f.status === 'pending');
      if (filesToUpload.length > 0) {
        tracker.start(PERF_OPERATIONS.CLIENT_UPLOAD_START);
        uploadBatch(filesToUpload);
      }
    }
  }, [isOffline, addToQueue]);

  // Choose the appropriate file processor based on enableBackgroundSync
  const processFiles = enableBackgroundSync ? processFilesWithSync : processFilesWithQueue;

  // Check for interrupted uploads on mount
  useUploadRecovery(
    async (recoveredFiles) => {
      console.log(`[UploadZone] Recovering ${recoveredFiles.length} interrupted uploads`);
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

  // Batch upload files with concurrency control
  const MAX_CONCURRENT_UPLOADS = 3;

  const uploadBatch = async (uploadFiles: UploadFile[]) => {
    // Create chunks for parallel processing with concurrency limit
    const uploadQueue = [...uploadFiles];
    const activeUploads = new Set<Promise<void>>();

    while (uploadQueue.length > 0 || activeUploads.size > 0) {
      // Start new uploads up to concurrency limit
      while (uploadQueue.length > 0 && activeUploads.size < MAX_CONCURRENT_UPLOADS) {
        const file = uploadQueue.shift()!;
        const uploadPromise = uploadFileToServer(file).then(() => {
          activeUploads.delete(uploadPromise);
        }).catch((error) => {
          console.error(`Upload failed for file ${file.file.name}:`, error);
          activeUploads.delete(uploadPromise);
        });
        activeUploads.add(uploadPromise);
      }

      // Wait for at least one upload to complete before continuing
      if (activeUploads.size > 0) {
        await Promise.race(activeUploads);
      }
    }
  };

  // Upload file to server - simplified direct upload
  const uploadFileToServer = async (uploadFile: UploadFile) => {
    const tracker = getGlobalPerformanceTracker();
    const uploadStartTime = Date.now();

    setFiles((prev) =>
      prev.map((f) =>
        f.id === uploadFile.id ? { ...f, status: 'uploading', progress: 10 } : f
      )
    );

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', uploadFile.file);

      // Add tags to the form data
      if (tags.length > 0) {
        formData.append('tags', JSON.stringify(tags));
      }

      // Track upload progress with XMLHttpRequest for better progress reporting
      const xhr = new XMLHttpRequest();

      // Create a promise to handle the XHR request
      const uploadPromise = new Promise<any>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            setFiles((prev) =>
              prev.map((f) =>
                f.id === uploadFile.id
                  ? { ...f, progress: Math.min(90, percentComplete) }
                  : f
              )
            );
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch {
              reject(new Error('Invalid response from server'));
            }
          } else {
            try {
              const error = JSON.parse(xhr.responseText);
              reject(new Error(error.error || `Upload failed with status ${xhr.status}`));
            } catch {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'));
        });

        // Upload without blocking on embedding generation for faster response
        xhr.open('POST', '/api/upload');
        xhr.send(formData);
      });

      const result = await uploadPromise;

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      // Track client upload time
      tracker.track('client:single_upload', Date.now() - uploadStartTime);

      // End the initial upload start timer if this is the first successful upload
      if (tracker.getSampleCount('client:single_upload') === 1) {
        tracker.end(PERF_OPERATIONS.CLIENT_UPLOAD_START);
      }

      // Handle duplicate detection as a special success case
      const isDuplicate = result.isDuplicate === true;
      const needsEmbedding = result.asset?.needsEmbedding === true;

      // Track time to searchable if embedding is not needed
      if (!needsEmbedding && result.asset?.id) {
        tracker.track(PERF_OPERATIONS.CLIENT_TO_SEARCHABLE, Date.now() - uploadStartTime);
      }

      setFiles((prev) => {
        const updated = prev.map((f) =>
          f.id === uploadFile.id
            ? {
                ...f,
                status: (isDuplicate ? 'duplicate' : 'success') as 'duplicate' | 'success',
                progress: 100,
                assetId: result.asset?.id,
                blobUrl: result.asset?.blobUrl,
                isDuplicate,
                needsEmbedding,
                embeddingStatus: (needsEmbedding ? 'pending' : 'ready') as 'pending' | 'ready',
              }
            : f
        );
        return updated;
      });

      // Remove from persisted queue on success
      if ((uploadFile as any).persistedId) {
        try {
          await uploadQueueManager.removeUpload((uploadFile as any).persistedId);
        } catch (err) {
          console.error('[UploadZone] Failed to remove persisted upload:', err);
        }
      }

      // Trigger a refresh of the asset list if there's a callback
      if (window.location.pathname === '/app') {
        // Dispatch a custom event that the library page can listen to
        window.dispatchEvent(new CustomEvent('assetUploaded', { detail: result.asset }));
      }

    } catch (error) {
      console.error('Upload error:', error);

      // Parse error for better messaging
      const errorDetails = getUploadErrorDetails(
        error instanceof Error ? error : new Error('Upload failed'),
        error instanceof Error && error.message.includes('401') ? 401 :
        error instanceof Error && error.message.includes('503') ? 503 : undefined
      );

      setFiles((prev) => {
        const updated = prev.map((f) =>
          f.id === uploadFile.id
            ? {
                ...f,
                status: 'error' as const,
                progress: 0,
                error: error instanceof Error ? error.message : 'Upload failed',
                errorDetails,
              }
            : f
        );
        return updated;
      });

      // Update persisted status to failed
      if ((uploadFile as any).persistedId) {
        try {
          await uploadQueueManager.updateUploadStatus(
            (uploadFile as any).persistedId,
            'failed',
            error instanceof Error ? error.message : 'Upload failed'
          );
        } catch (err) {
          console.error('[UploadZone] Failed to update persisted status:', err);
        }
      }
    } finally {
      // Remove from active uploads
      activeUploadsRef.current.delete(uploadFile.id);
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
      processFiles(files);
    }
  };

  // File input handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  // Remove file from list
  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Retry failed upload
  const retryUpload = (uploadFile: UploadFile) => {
    const freshFile = { ...uploadFile, status: 'pending' as const, progress: 0, error: undefined };
    setFiles((prev) =>
      prev.map((f) => (f.id === uploadFile.id ? freshFile : f))
    );
    uploadFileToServer(freshFile);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Calculate overall progress
  const calculateOverallProgress = () => {
    if (files.length === 0) return 0;

    const totalProgress = files.reduce((acc, file) => {
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

    return Math.round(totalProgress / files.length);
  };

  // Get upload statistics
  const getUploadStats = () => {
    const completed = files.filter(f => f.status === 'success' || f.status === 'duplicate').length;
    const uploading = files.filter(f => f.status === 'uploading').length;
    const pending = files.filter(f => f.status === 'pending' || f.status === 'queued').length;
    const failed = files.filter(f => f.status === 'error').length;

    return { completed, uploading, pending, failed, total: files.length };
  };

  // Cancel remaining uploads
  const cancelRemainingUploads = () => {
    setIsCancelling(true);

    // Remove pending files
    setFiles((prev) =>
      prev.filter((f) =>
        f.status === 'success' ||
        f.status === 'duplicate' ||
        f.status === 'error' ||
        f.status === 'uploading'
      )
    );

    // Clear active uploads tracking
    activeUploadsRef.current.clear();

    setTimeout(() => setIsCancelling(false), 500);
  };

  // Show background sync status if enabled
  const showSyncStatus = enableBackgroundSync && (pendingCount > 0 || uploadingCount > 0 || errorCount > 0);
  const successfulUploads = files.filter((file) => file.status === 'success' || file.status === 'duplicate');
  const hasSuccessfulUploads = successfulUploads.length > 0;
  const hasActiveUploads = files.some((file) =>
    file.status === 'uploading' || file.status === 'pending' || file.status === 'queued'
  );

  const handleViewLibrary = () => {
    setFiles([]);
    setTags([]);
    setUploadStats(null);
    router.push('/app');
  };

  return (
    <div
      className="w-full"
      onPaste={handlePaste}
      tabIndex={0}
    >
      {/* Upload Progress Header - shows when files are being processed */}
      {uploadStats && uploadStats.totalFiles > 0 && (
        <div className="mb-4">
          <UploadProgressHeader
            stats={uploadStats}
            onMinimize={() => {}}
            className="animate-fade-in"
          />
        </div>
      )}

      {/* Background sync status (only when enabled) */}
      {showSyncStatus && (
        <div className="mb-4 bg-[#1B1F24] rounded-lg p-3 border border-[#2A2F37]">
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
        <div className="mb-4 rounded-xl border border-[#7C5CFF]/30 bg-[#7C5CFF]/10 p-3 animate-fade-in">
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
          'relative rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer',
          'hover:border-[#7C5CFF] hover:bg-[#7C5CFF]/5',
          isDragging
            ? 'border-[#7C5CFF] bg-[#7C5CFF]/10 scale-[1.02]'
            : 'border-[#2A2F37] bg-[#1B1F24]'
        )}
      >
        <div className="flex flex-col items-center justify-center py-12 px-6">
          <div className={cn(
            'w-16 h-16 mb-4 rounded-full flex items-center justify-center transition-all duration-200',
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
          <div className="absolute inset-0 rounded-2xl pointer-events-none">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#7C5CFF] rounded-l-2xl" />
            <div className="absolute right-0 top-0 bottom-0 w-1 bg-[#B6FF6E] rounded-r-2xl" />
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

      {/* Tag Input - Only show when files are selected */}
      {files.length > 0 && (
        <div className="mt-6">
          <div className="bg-[#14171A] border border-[#2A2F37] rounded-xl p-4 mb-4">
            <h3 className="text-[#E6E8EB] font-medium text-sm mb-3">Add Tags</h3>
            <TagInput
              tags={tags}
              onTagsChange={setTags}
              placeholder="Add tags to these uploads..."
              maxTags={10}
            />
          </div>
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-6 space-y-4">
          {/* Batch Upload Progress Header */}
          <div className="bg-[#14171A] border border-[#2A2F37] rounded-xl p-4">
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

            {/* Overall progress bar */}
            <div className="relative">
              <div className="w-full h-2 bg-[#1B1F24] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#7C5CFF] to-[#9B7FFF] transition-all duration-500 ease-out"
                  style={{ width: `${calculateOverallProgress()}%` }}
                />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[#B3B7BE] text-xs">
                  {getUploadStats().completed} of {files.length} files
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
          </div>

          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="bg-[#1B1F24] rounded-lg p-3 border border-[#2A2F37]"
              >
                <div className="flex items-center gap-3">
                  {/* File icon/preview */}
                  <div className="w-12 h-12 rounded-lg bg-[#14171A] flex items-center justify-center overflow-hidden">
                    {file.blobUrl ? (
                      <img
                        src={file.blobUrl}
                        alt={file.file.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl">🖼️</span>
                    )}
                  </div>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[#E6E8EB] text-sm font-medium truncate">
                      {file.file.name}
                    </p>
                    <p className="text-[#B3B7BE] text-xs">
                      {formatFileSize(file.file.size)}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {file.status === 'uploading' && (
                      <>
                        <div className="w-24 h-1 bg-[#2A2F37] rounded-full overflow-hidden">
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
                          setFiles(prev => prev.map(f =>
                            f.id === file.id
                              ? { ...f, embeddingStatus: status, embeddingError: error }
                              : f
                          ));
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
                      fileName={file.file.name}
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

          {hasSuccessfulUploads && (
            <div className="flex flex-col gap-3 rounded-xl border border-[#2A2F37] bg-[#14171A] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#B6FF6E]/10 text-[#B6FF6E]">
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
                  className="inline-flex items-center justify-center rounded-lg bg-[#7C5CFF] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#6B4FE0] disabled:cursor-not-allowed disabled:bg-[#2A2F37] disabled:text-[#6A6E78]"
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
