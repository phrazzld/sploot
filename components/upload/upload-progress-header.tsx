'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface ProgressStats {
  totalFiles: number;
  uploaded: number;
  processingEmbeddings: number;
  ready: number;
  failed: number;
  estimatedTimeRemaining: number; // ms
}

interface UploadProgressHeaderProps {
  stats: ProgressStats;
  onMinimize?: () => void;
  onExpand?: () => void;
  isMinimized?: boolean;
  className?: string;
}

export function UploadProgressHeader({
  stats,
  onMinimize,
  onExpand,
  isMinimized = false,
  className,
}: UploadProgressHeaderProps) {
  const [isCollapsed, setIsCollapsed] = useState(isMinimized);
  const [animationProgress, setAnimationProgress] = useState(0);
  const operationTimesRef = useRef<number[]>([]);
  const lastUpdateTimeRef = useRef<number>(Date.now());

  // Calculate percentages
  const uploadProgress = stats.totalFiles > 0
    ? Math.round(((stats.uploaded + stats.failed) / stats.totalFiles) * 100)
    : 0;

  const embeddingProgress = stats.totalFiles > 0
    ? Math.round(((stats.ready + stats.failed) / stats.totalFiles) * 100)
    : 0;

  const overallProgress = stats.totalFiles > 0
    ? Math.round(((stats.ready + stats.failed) / stats.totalFiles) * 100)
    : 0;

  // Update operation times for time estimation
  useEffect(() => {
    const now = Date.now();
    const timeDiff = now - lastUpdateTimeRef.current;

    if (stats.ready > 0 || stats.uploaded > 0) {
      // Track last 5 operation times
      operationTimesRef.current.push(timeDiff);
      if (operationTimesRef.current.length > 5) {
        operationTimesRef.current.shift();
      }
    }

    lastUpdateTimeRef.current = now;
  }, [stats.ready, stats.uploaded]);

  // Calculate estimated time remaining
  const getEstimatedTime = (): string => {
    if (stats.totalFiles === stats.ready + stats.failed) {
      return 'Complete';
    }

    if (operationTimesRef.current.length === 0) {
      return 'Calculating...';
    }

    const avgTime = operationTimesRef.current.reduce((a, b) => a + b, 0) / operationTimesRef.current.length;
    const remaining = stats.totalFiles - stats.ready - stats.failed;
    const estimatedMs = remaining * avgTime;

    if (estimatedMs < 1000) return 'Almost done';
    if (estimatedMs < 60000) return `${Math.ceil(estimatedMs / 1000)}s remaining`;
    return `${Math.ceil(estimatedMs / 60000)}m remaining`;
  };

  // Smooth progress animation
  useEffect(() => {
    const targetProgress = overallProgress;
    const step = () => {
      setAnimationProgress((prev) => {
        const diff = targetProgress - prev;
        if (Math.abs(diff) < 1) return targetProgress;
        return prev + diff * 0.1;
      });
    };
    const interval = setInterval(step, 50);
    return () => clearInterval(interval);
  }, [overallProgress]);

  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    if (newState && onMinimize) {
      onMinimize();
    } else if (!newState && onExpand) {
      onExpand();
    }
  };

  // Don't show if no files are being processed
  if (stats.totalFiles === 0) {
    return null;
  }

  // Check if all operations are complete
  const isComplete = stats.totalFiles === stats.ready + stats.failed;
  const hasFailures = stats.failed > 0;

  return (
    <div
      className={cn(
        'fixed top-4 right-4 z-50 w-96  border border-[#2A2F37] bg-[#14171A] shadow-2xl transition-all duration-300',
        isCollapsed && 'w-auto',
        className
      )}
    >
      {/* Header */}
      <div
        className="flex cursor-pointer items-center justify-between p-4"
        onClick={toggleCollapse}
      >
        <div className="flex items-center gap-3">
          {!isComplete && (
            <div className="relative h-6 w-6">
              <svg
                className="h-6 w-6 -rotate-90 transform"
                viewBox="0 0 24 24"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="#2A2F37"
                  strokeWidth="2"
                  fill="none"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke={hasFailures ? '#FF4D4D' : '#7C5CFF'}
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray={`${animationProgress * 0.628} 62.8`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                {Math.round(animationProgress)}
              </span>
            </div>
          )}

          {isComplete && (
            <div
              className={cn(
                'flex h-6 w-6 items-center justify-center ',
                hasFailures ? 'bg-[#FF4D4D]' : 'bg-[#B6FF6E]'
              )}
            >
              {hasFailures ? (
                <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-[#E6E8EB]">
              {isComplete
                ? hasFailures
                  ? `${stats.ready} completed, ${stats.failed} failed`
                  : 'All uploads complete'
                : `Processing ${stats.totalFiles} ${stats.totalFiles === 1 ? 'file' : 'files'}`}
            </h3>
            {!isCollapsed && !isComplete && (
              <p className="text-xs text-[#B3B7BE]">{getEstimatedTime()}</p>
            )}
          </div>
        </div>

        <button
          type="button"
          className="p-1 text-[#B3B7BE] transition-colors hover:bg-[#1B1F24] hover:text-[#E6E8EB]"
        >
          <svg
            className={cn('h-4 w-4 transition-transform', isCollapsed && 'rotate-180')}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Expanded content */}
      {!isCollapsed && (
        <div className="border-t border-[#2A2F37] p-4">
          {/* Stats grid */}
          <div className="mb-4 grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-xs text-[#B3B7BE]">Uploaded</p>
              <p className="text-sm font-semibold text-[#E6E8EB]">{stats.uploaded}</p>
            </div>
            <div>
              <p className="text-xs text-[#B3B7BE]">Processing</p>
              <p className="text-sm font-semibold text-[#7C5CFF]">{stats.processingEmbeddings}</p>
            </div>
            <div>
              <p className="text-xs text-[#B3B7BE]">Ready</p>
              <p className="text-sm font-semibold text-[#B6FF6E]">{stats.ready}</p>
            </div>
            <div>
              <p className="text-xs text-[#B3B7BE]">Failed</p>
              <p className="text-sm font-semibold text-[#FF4D4D]">{stats.failed}</p>
            </div>
          </div>

          {/* Dual-layer progress bar */}
          <div className="space-y-2">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-[#B3B7BE]">Upload Progress</span>
                <span className="font-semibold text-[#E6E8EB]">{uploadProgress}%</span>
              </div>
              <div className="relative h-2 overflow-hidden bg-[#1B1F24]">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#7C5CFF] to-[#9B7DFF] transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-[#B3B7BE]">Embedding Progress</span>
                <span className="font-semibold text-[#E6E8EB]">{embeddingProgress}%</span>
              </div>
              <div className="relative h-2 overflow-hidden bg-[#1B1F24]">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#B6FF6E] to-[#8FFF3B] transition-all duration-300"
                  style={{ width: `${embeddingProgress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          {isComplete && (
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 bg-[#1B1F24] px-3 py-1.5 text-xs font-medium text-[#B3B7BE] transition-colors hover:bg-[#2A2F37] hover:text-[#E6E8EB]"
                onClick={() => window.location.href = '/app'}
              >
                View Library
              </button>
              {hasFailures && (
                <button
                  type="button"
                  className="flex-1 bg-[#FF4D4D]/10 px-3 py-1.5 text-xs font-medium text-[#FF4D4D] transition-colors hover:bg-[#FF4D4D]/20"
                  onClick={() => {
                    // Trigger retry for failed items
                    console.log('Retrying failed uploads...');
                  }}
                >
                  Retry Failed
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Hook to manage upload progress state
export function useUploadProgress() {
  const [stats, setStats] = useState<ProgressStats>({
    totalFiles: 0,
    uploaded: 0,
    processingEmbeddings: 0,
    ready: 0,
    failed: 0,
    estimatedTimeRemaining: 0,
  });

  const startUpload = (fileCount: number) => {
    setStats({
      totalFiles: fileCount,
      uploaded: 0,
      processingEmbeddings: 0,
      ready: 0,
      failed: 0,
      estimatedTimeRemaining: 0,
    });
  };

  const updateProgress = (updates: Partial<ProgressStats>) => {
    setStats((prev) => ({ ...prev, ...updates }));
  };

  const markUploaded = (count: number = 1) => {
    setStats((prev) => ({
      ...prev,
      uploaded: prev.uploaded + count,
      processingEmbeddings: prev.processingEmbeddings + count,
    }));
  };

  const markReady = (count: number = 1) => {
    setStats((prev) => ({
      ...prev,
      processingEmbeddings: Math.max(0, prev.processingEmbeddings - count),
      ready: prev.ready + count,
    }));
  };

  const markFailed = (count: number = 1) => {
    setStats((prev) => ({
      ...prev,
      processingEmbeddings: Math.max(0, prev.processingEmbeddings - count),
      failed: prev.failed + count,
    }));
  };

  const reset = () => {
    setStats({
      totalFiles: 0,
      uploaded: 0,
      processingEmbeddings: 0,
      ready: 0,
      failed: 0,
      estimatedTimeRemaining: 0,
    });
  };

  return {
    stats,
    startUpload,
    updateProgress,
    markUploaded,
    markReady,
    markFailed,
    reset,
  };
}