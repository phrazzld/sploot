'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { trackEmptyStateRender } from '@/lib/performance-metrics';

export type EmptyStateVariant = 'first-use' | 'filtered' | 'search';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  onUploadClick?: () => void;
  searchQuery?: string;
  className?: string;
  showUploadButton?: boolean; // Control whether to show the upload button (avoids duplication with navbar)
  onFilesDropped?: (files: File[]) => void; // Callback when files are dropped on the empty state
}

/**
 * Empty state component for the library
 * Displays contextual messaging when no assets are available
 */
export function EmptyState({
  variant = 'first-use',
  onUploadClick,
  searchQuery,
  className,
  showUploadButton = true, // Default to true for backwards compatibility
  onFilesDropped,
}: EmptyStateProps) {
  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0); // Track nested drag events
  const mountTimeRef = useRef(performance.now());

  // Performance measurement - track time to empty state render
  // Target: P95 < 100ms for smooth UX
  useEffect(() => {
    const renderEnd = performance.now();
    const renderTime = renderEnd - mountTimeRef.current;

    // Track metric (sends to telemetry)
    trackEmptyStateRender(mountTimeRef.current);

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[perf] EmptyState rendered in ${renderTime.toFixed(2)}ms`);
    }
  }, []);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      // Filter for image files only
      const imageFiles = files.filter(file => file.type.startsWith('image/'));

      if (imageFiles.length > 0 && onFilesDropped) {
        onFilesDropped(imageFiles);
      } else if (imageFiles.length === 0 && files.length > 0) {
        console.warn('[EmptyState] No image files in drop');
      }
    }
  }, [onFilesDropped]);

  // Determine message based on variant
  const getMessage = () => {
    switch (variant) {
      case 'search':
        return {
          title: 'no results found',
          description: searchQuery
            ? `No memes match "${searchQuery}". Try different search terms or browse your full library.`
            : 'No memes match your search. Try different terms or browse your full library.',
        };
      case 'filtered':
        return {
          title: 'no memes match these filters',
          description: 'Try adjusting your filters or clearing them to see all your memes.',
        };
      case 'first-use':
      default:
        return {
          title: 'drop files here',
          description: 'drag and drop images into your library or start an upload to see them appear instantly.',
        };
    }
  };

  const message = getMessage();
  const shouldShowUploadButton = variant === 'first-use' && showUploadButton;

  // Only enable drag-drop for first-use variant
  const enableDragDrop = variant === 'first-use';

  return (
    <div
      className={cn('flex h-full items-center justify-center py-8', className)}
      onDragEnter={enableDragDrop ? handleDragEnter : undefined}
      onDragOver={enableDragDrop ? handleDragOver : undefined}
      onDragLeave={enableDragDrop ? handleDragLeave : undefined}
      onDrop={enableDragDrop ? handleDrop : undefined}
    >
      <div className={cn(
        'flex w-full max-w-md flex-col items-center gap-4 text-center',
        'transition-all duration-200 ease-out',
        // Drag feedback: border + scale
        isDragging && enableDragDrop && [
          'scale-[1.02]',
          'rounded-2xl border-2 border-[#7C5CFF] border-dashed',
          'bg-[#7C5CFF]/5 p-8'
        ]
      )}>
        {/* Minimal icon - 16x16 size */}
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#1B1F24]">
          <svg
            className="h-8 w-8 text-[#7C5CFF]/80"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <rect
              x="8"
              y="12"
              width="48"
              height="40"
              rx="6"
              stroke="currentColor"
              strokeWidth="2.5"
              opacity="0.9"
            />
            <path
              d="M18 39l9.5-11a2 2 0 013 0l6 7.2a2 2 0 003.1.1L44 30"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.9"
            />
            <circle cx="42" cy="23" r="3.5" fill="currentColor" opacity="0.9" />
          </svg>
        </div>

        {/* Compact message */}
        <div className="space-y-1">
          <h3 className="text-base font-medium text-[#E6E8EB]">{message.title}</h3>
          {message.description && (
            <p className="text-sm text-[#B3B7BE]/80">{message.description}</p>
          )}
        </div>

        {/* Keyboard hint for first-use */}
        {shouldShowUploadButton && (
          <div className="mt-2 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-[#7C5CFF]/70">
              <kbd className="rounded bg-[#1B1F24] px-1.5 py-0.5 font-mono text-[#7C5CFF]">⌘V</kbd>
              <span>to paste</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#474C58]">or</span>
              {onUploadClick ? (
                <button
                  onClick={onUploadClick}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#7C5CFF] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#6B4FE0]"
                  aria-label="Upload images"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M10 4v12M4 10h12"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  upload
                </button>
              ) : (
                <Link
                  href="/app?upload=1"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#7C5CFF] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#6B4FE0]"
                  aria-label="Upload images"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M10 4v12M4 10h12"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  upload
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}