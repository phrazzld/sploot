'use client';

import { useRef, useMemo, useCallback, useLayoutEffect, CSSProperties } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FileMetadata } from '@/lib/file-metadata-manager';
import { EmbeddingStatusIndicator } from './embedding-status-indicator';
import { UploadErrorDisplay } from './upload-error-display';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface FileListVirtualProps {
  fileMetadata: Map<string, FileMetadata>;
  setFileMetadata: React.Dispatch<React.SetStateAction<Map<string, FileMetadata>>>;
  formatFileSize: (bytes: number) => string;
  retryUpload: (metadata: FileMetadata) => void;
  removeFile: (id: string) => void;
}

interface FileRowProps {
  file: FileMetadata;
  style: CSSProperties;
  formatFileSize: (bytes: number) => string;
  onStatusChange: (status: 'pending' | 'processing' | 'ready' | 'failed', error?: string) => void;
  onRetry: () => void;
  onRemove: () => void;
  onViewDuplicate?: () => void;
  measureElement: (element: HTMLDivElement | null) => void;
}

/**
 * Individual file row component with dynamic height measurement
 */
function FileRow({
  file,
  style,
  formatFileSize,
  onStatusChange,
  onRetry,
  onRemove,
  onViewDuplicate,
  measureElement
}: FileRowProps) {
  // Dynamic height based on content
  const hasError = file.status === 'error' && file.errorDetails;
  const baseHeight = 64; // Base height in pixels
  const errorHeight = hasError ? 80 : 0; // Extra height for error display

  return (
    <div
      ref={measureElement}
      style={style}
      className="px-2"
      data-index={style.top}
    >
      <div
        className={cn(
          "bg-[#1B1F24] rounded-lg p-3 border border-[#2A2F37] flex items-center transition-all",
          hasError && "border-red-500/30"
        )}
        style={{ minHeight: `${baseHeight + errorHeight}px` }}
      >
        <div className="flex items-center gap-3 w-full">
          {/* File icon/preview */}
          <div className="w-12 h-12 rounded-lg bg-[#14171A] flex items-center justify-center overflow-hidden flex-shrink-0">
            {file.blobUrl ? (
              <img
                src={file.blobUrl}
                alt={file.name}
                className="w-full h-full object-cover"
                loading="lazy"
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
                onStatusChange={onStatusChange}
              />
            )}

            {file.status === 'duplicate' && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#FFB020]">already exists</span>
                {file.needsEmbedding ? (
                  <span className="text-[#7C5CFF]">• indexing...</span>
                ) : (
                  <button
                    onClick={onViewDuplicate}
                    className="text-[#7C5CFF] hover:text-[#9B7FFF] font-medium underline"
                  >
                    view
                  </button>
                )}
              </div>
            )}

            {hasError && (
              <UploadErrorDisplay
                error={file.errorDetails}
                fileId={file.id}
                fileName={file.name}
                onRetry={onRetry}
                onDismiss={onRemove}
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
}

/**
 * Virtual file list component with dynamic row heights
 * Efficiently renders 10,000+ files at 60fps
 */
export function FileListVirtual({
  fileMetadata,
  setFileMetadata,
  formatFileSize,
  retryUpload,
  removeFile
}: FileListVirtualProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Convert Map to sorted array for virtualization
  const filesArray = useMemo(() => {
    return Array.from(fileMetadata.values()).sort((a, b) => a.addedAt - b.addedAt);
  }, [fileMetadata]);

  // Dynamic size estimation based on file status
  const estimateSize = useCallback((index: number) => {
    const file = filesArray[index];
    if (!file) return 64; // Default height

    // Add extra height for error states
    if (file.status === 'error' && file.errorDetails) {
      return 144; // Base + error display
    }

    return 64; // Base height
  }, [filesArray]);

  // Initialize virtualizer with dynamic sizing
  const virtualizer = useVirtualizer({
    count: filesArray.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 5, // Render 5 extra items for smooth scrolling
    measureElement: (element) => {
      // Measure actual element height for accurate virtualization
      if (element) {
        return element.getBoundingClientRect().height;
      }
      return 64;
    }
  });

  // Handle status updates
  const handleStatusChange = useCallback((fileId: string, status: 'pending' | 'processing' | 'ready' | 'failed', error?: string) => {
    setFileMetadata(prev => {
      const updated = new Map(prev);
      const metadata = updated.get(fileId);
      if (metadata) {
        updated.set(fileId, {
          ...metadata,
          embeddingStatus: status,
          embeddingError: error
        });
      }
      return updated;
    });
  }, [setFileMetadata]);

  // Handle duplicate view navigation
  const handleViewDuplicate = useCallback((assetId: string) => {
    if (assetId) {
      router.push(`/app?highlight=${assetId}`);
    }
  }, [router]);

  // Performance optimization: measure once after mount
  useLayoutEffect(() => {
    virtualizer.measure();
  }, [filesArray.length]);

  const virtualItems = virtualizer.getVirtualItems();

  // Show empty state
  if (filesArray.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-[#B3B7BE]">
        <p>No files uploaded yet</p>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-[#2A2F37] scrollbar-track-[#14171A]"
      style={{
        contain: 'strict', // CSS containment for better performance
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
          if (!file) return null;

          return (
            <FileRow
              key={file.id}
              file={file}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
              formatFileSize={formatFileSize}
              onStatusChange={(status, error) => handleStatusChange(file.id, status, error)}
              onRetry={() => retryUpload(file)}
              onRemove={() => removeFile(file.id)}
              onViewDuplicate={() => handleViewDuplicate(file.assetId || '')}
              measureElement={(el) => {
                if (el) {
                  virtualItem.measureElement(el);
                }
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// Export for use in upload-zone
export default FileListVirtual;