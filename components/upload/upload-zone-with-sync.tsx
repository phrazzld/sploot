'use client';

import { useState, useRef, useCallback, DragEvent, ClipboardEvent } from 'react';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from '@/lib/blob';
import { cn } from '@/lib/utils';
import { useOffline } from '@/hooks/use-offline';
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

export function UploadZoneWithSync() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const { isOffline, isSlowConnection } = useOffline();
  const {
    addToBackgroundSync,
    supportsBackgroundSync,
    queue,
    retryFailedUploads,
    clearCompleted,
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

  // Process files for upload
  const processFiles = useCallback(async (fileList: FileList | File[]) => {
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
        continue;
      }

      // Use background sync for uploads (works both online and offline)
      if (supportsBackgroundSync) {
        const id = await addToBackgroundSync(file);
        newFiles.push({
          id,
          file,
          status: 'queued',
          progress: 0,
          error: undefined,
        });

        // Show notification about background upload
        if (isOffline) {
          console.log(`File ${file.name} queued for background upload when online`);
        } else {
          console.log(`File ${file.name} added to background upload queue`);
        }
      } else {
        // Fallback to regular upload if background sync not supported
        newFiles.push({
          id: `${Date.now()}-${Math.random()}`,
          file,
          status: isOffline ? 'queued' : 'pending',
          progress: 0,
          error: undefined,
        });
      }
    }

    setFiles((prev) => [...prev, ...newFiles]);

    // Start uploading valid files if online and no background sync
    if (!isOffline && !supportsBackgroundSync) {
      newFiles
        .filter((f) => f.status === 'pending')
        .forEach((uploadFile) => uploadFileToServer(uploadFile));
    }
  }, [isOffline, supportsBackgroundSync, addToBackgroundSync]);

  // Upload file to server (fallback when no background sync)
  const uploadFileToServer = async (uploadFile: UploadFile) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === uploadFile.id ? { ...f, status: 'uploading', progress: 10 } : f
      )
    );

    try {
      // Get pre-signed upload URL
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, progress: 20 } : f
        )
      );

      const uploadUrlResponse = await fetch('/api/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: uploadFile.file.name,
          contentType: uploadFile.file.type,
        }),
      });

      if (!uploadUrlResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { url, pathname } = await uploadUrlResponse.json();

      // Upload to blob storage
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, progress: 50 } : f
        )
      );

      const uploadResponse = await fetch(url, {
        method: 'PUT',
        body: uploadFile.file,
        headers: {
          'Content-Type': uploadFile.file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      // Create asset record
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, progress: 80 } : f
        )
      );

      const assetResponse = await fetch('/api/assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          blobUrl: url.split('?')[0], // Remove query params
          pathname,
          filename: uploadFile.file.name,
          mimeType: uploadFile.file.type,
          size: uploadFile.file.size,
        }),
      });

      if (!assetResponse.ok) {
        throw new Error('Failed to create asset record');
      }

      const { asset } = await assetResponse.json();

      // Mark as successful
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, status: 'success', progress: 100, assetId: asset.id, blobUrl: asset.blobUrl }
            : f
        )
      );
    } catch (error) {
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
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFiles(files);
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
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  };

  // Retry failed uploads
  const handleRetry = () => {
    if (supportsBackgroundSync) {
      retryFailedUploads();
    } else {
      files
        .filter((f) => f.status === 'error')
        .forEach((uploadFile) => uploadFileToServer(uploadFile));
    }
  };

  // Remove file from list
  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-6 space-y-6">
      {/* Background Sync Status */}
      {supportsBackgroundSync && (
        <div className="bg-lab-surface border border-lab-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-lab-text">
                Background Upload {isOffline ? '(Offline Mode)' : '(Online)'}
              </p>
              <p className="text-xs text-lab-text-secondary">
                {pendingCount > 0 && `${pendingCount} pending, `}
                {uploadingCount > 0 && `${uploadingCount} uploading, `}
                {errorCount > 0 && `${errorCount} failed`}
                {pendingCount === 0 && uploadingCount === 0 && errorCount === 0 && 'No uploads in queue'}
              </p>
            </div>
            <div className="flex gap-2">
              {errorCount > 0 && (
                <button
                  onClick={handleRetry}
                  className="px-3 py-1 text-xs bg-lab-primary text-white rounded-lg hover:opacity-90"
                >
                  Retry Failed
                </button>
              )}
              {queue.filter((q) => q.status === 'success').length > 0 && (
                <button
                  onClick={clearCompleted}
                  className="px-3 py-1 text-xs bg-lab-surface-secondary text-lab-text rounded-lg hover:opacity-90"
                >
                  Clear Completed
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Zone */}
      <div
        className={cn(
          'relative border-2 border-dashed rounded-2xl transition-all duration-200',
          isDragging
            ? 'border-lab-primary bg-lab-primary/10 scale-[1.02]'
            : 'border-lab-border hover:border-lab-border-active',
          'group'
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onPaste={handlePaste}
      >
        <div className="p-12 text-center">
          <div className="mb-4">
            <svg
              className={cn(
                'w-16 h-16 mx-auto transition-colors',
                isDragging ? 'text-lab-primary' : 'text-lab-text-secondary'
              )}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>

          <p className="text-lab-text font-medium mb-2">
            {isDragging ? 'Drop your images here' : 'Drag and drop images here'}
          </p>
          <p className="text-sm text-lab-text-secondary mb-4">
            or paste from clipboard (Ctrl/Cmd+V)
          </p>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-2 bg-lab-primary text-white rounded-lg hover:opacity-90 transition-opacity"
            disabled={isSlowConnection}
          >
            Select Files
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ALLOWED_FILE_TYPES.join(',')}
            onChange={handleFileSelect}
            className="hidden"
          />

          <p className="text-xs text-lab-text-tertiary mt-4">
            Supported: JPEG, PNG, WebP, GIF • Max 10MB per file
          </p>

          {isOffline && (
            <p className="text-xs text-orange-500 mt-2">
              ⚠️ You're offline - files will be uploaded automatically when connection is restored
            </p>
          )}

          {isSlowConnection && (
            <p className="text-xs text-yellow-500 mt-2">
              ⚠️ Slow connection detected - uploads may take longer
            </p>
          )}
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-lab-text mb-2">
            Upload Queue ({files.length} files)
          </h3>
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-3 bg-lab-surface border border-lab-border rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-lab-text truncate">
                  {file.file.name}
                </p>
                <p className="text-xs text-lab-text-secondary">
                  {(file.file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>

              <div className="flex items-center gap-3">
                {file.status === 'uploading' && (
                  <div className="w-24 h-2 bg-lab-surface-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-lab-primary transition-all duration-300"
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                )}

                {file.status === 'success' && (
                  <span className="text-xs text-green-500">✓ Uploaded</span>
                )}

                {file.status === 'error' && (
                  <span className="text-xs text-red-500">{file.error}</span>
                )}

                {file.status === 'queued' && (
                  <span className="text-xs text-yellow-500">
                    {supportsBackgroundSync ? 'Queued (Background)' : 'Queued'}
                  </span>
                )}

                {file.status === 'pending' && (
                  <span className="text-xs text-blue-500">Pending</span>
                )}

                <button
                  onClick={() => removeFile(file.id)}
                  className="text-lab-text-secondary hover:text-red-500 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}