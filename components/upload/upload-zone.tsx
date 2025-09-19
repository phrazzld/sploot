'use client';

import { useState, useRef, useCallback, DragEvent, ClipboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from '@/lib/blob';
import { cn } from '@/lib/utils';
import { useOffline } from '@/hooks/use-offline';
import { useUploadQueue } from '@/hooks/use-upload-queue';
import { useBackgroundSync } from '@/hooks/use-background-sync';

interface UploadFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'queued';
  progress: number;
  error?: string;
  assetId?: string;
  blobUrl?: string;
}

interface UploadZoneProps {
  /**
   * Enable background sync for offline upload support.
   * When true, uses service worker background sync.
   * When false, uses localStorage-based queue.
   * @default false
   */
  enableBackgroundSync?: boolean;
}

export function UploadZone({ enableBackgroundSync = false }: UploadZoneProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const { isOffline, isSlowConnection } = useOffline();
  const router = useRouter();

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

    // Start uploading valid files if online
    if (!isOffline) {
      newFiles
        .filter((f) => f.status === 'pending')
        .forEach((uploadFile) => uploadFileToServer(uploadFile));
    }
  }, [isOffline, supportsBackgroundSync, addToBackgroundSync]);

  // Process files for upload with regular queue
  const processFilesWithQueue = useCallback((fileList: FileList | File[]) => {
    const newFiles: UploadFile[] = [];

    Array.from(fileList).forEach((file) => {
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
      } else {
        newFiles.push({
          id: `${Date.now()}-${Math.random()}`,
          file,
          status: error ? 'error' : 'pending',
          progress: 0,
          error: error || undefined,
        });
      }
    });

    setFiles((prev) => [...prev, ...newFiles]);

    // Start uploading valid files if online
    if (!isOffline) {
      newFiles
        .filter((f) => f.status === 'pending')
        .forEach((uploadFile) => uploadFileToServer(uploadFile));
    }
  }, [isOffline, addToQueue]);

  // Choose the appropriate file processor based on enableBackgroundSync
  const processFiles = enableBackgroundSync ? processFilesWithSync : processFilesWithQueue;

  // Upload file to server - simplified direct upload
  const uploadFileToServer = async (uploadFile: UploadFile) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === uploadFile.id ? { ...f, status: 'uploading', progress: 10 } : f
      )
    );

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', uploadFile.file);

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

        xhr.open('POST', '/api/upload');
        xhr.send(formData);
      });

      const result = await uploadPromise;

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? {
                ...f,
                status: 'success',
                progress: 100,
                assetId: result.asset?.id,
                blobUrl: result.asset?.blobUrl,
              }
            : f
        )
      );

      // Trigger a refresh of the asset list if there's a callback
      if (window.location.pathname === '/app') {
        // Dispatch a custom event that the library page can listen to
        window.dispatchEvent(new CustomEvent('assetUploaded', { detail: result.asset }));
      }

    } catch (error) {
      console.error('Upload error:', error);

      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? {
                ...f,
                status: 'error',
                progress: 0,
                error: error instanceof Error ? error.message : 'Upload failed',
              }
            : f
        )
      );
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

  // Show background sync status if enabled
  const showSyncStatus = enableBackgroundSync && (pendingCount > 0 || uploadingCount > 0 || errorCount > 0);
  const successfulUploads = files.filter((file) => file.status === 'success');
  const hasSuccessfulUploads = successfulUploads.length > 0;
  const hasActiveUploads = files.some((file) =>
    file.status === 'uploading' || file.status === 'pending' || file.status === 'queued'
  );

  const handleViewLibrary = () => {
    setFiles([]);
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
            {isDragging ? 'Drop your images here' : 'Drag & drop images here'}
          </p>
          <p className="text-[#B3B7BE] text-sm mb-4">
            or click to browse • paste from clipboard
          </p>
          <p className="text-[#B3B7BE]/60 text-xs">
            JPEG, PNG, WebP, GIF • Max 10MB per file
          </p>
          {enableBackgroundSync && supportsBackgroundSync && (
            <p className="text-[#7C5CFF]/60 text-xs mt-2">
              Background sync enabled • Uploads continue offline
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

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-6 space-y-4">
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
                  <div className="flex items-center gap-2">
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
                      <span className="text-[#B6FF6E] text-sm">✓</span>
                    )}

                    {file.status === 'error' && (
                      <button
                        onClick={() => retryUpload(file)}
                        className="text-[#FF4D4D] hover:text-[#FF6B6B] text-xs underline"
                      >
                        Retry
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

                {/* Error message */}
                {file.error && (
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
                  <p className="text-sm font-medium text-[#E6E8EB]">
                    {successfulUploads.length === 1
                      ? '1 image added to your library'
                      : `${successfulUploads.length} images added to your library`}
                  </p>
                  {hasActiveUploads ? (
                    <p className="text-xs text-[#B3B7BE]">Finishing remaining uploads...</p>
                  ) : (
                    <p className="text-xs text-[#B3B7BE]">Jump back to browse everything in your collection.</p>
                  )}
                </div>
              </div>

              <button
                onClick={handleViewLibrary}
                className="inline-flex items-center justify-center rounded-lg bg-[#7C5CFF] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#6B4FE0] disabled:cursor-not-allowed disabled:bg-[#2A2F37] disabled:text-[#6A6E78]"
                disabled={hasActiveUploads}
              >
                View in Library
              </button>
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
