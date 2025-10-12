'use client';

import { useState, useEffect } from 'react';
import { useProcessingStatus } from '@/hooks/use-processing-status';

interface ProcessingStatusIndicatorProps {
  assetId: string | undefined;
  onStatusChange?: (status: 'pending' | 'processing' | 'complete' | 'failed') => void;
}

/**
 * Component to display image processing status for uploaded files
 * Shows current state of Sharp image processing (resize, thumbnail generation)
 *
 * States:
 * - pending: Just uploaded, waiting for processing
 * - processing: Currently being processed by cron job
 * - complete: Processing done, ready for embedding
 * - failed: Processing failed, needs retry
 */
export function ProcessingStatusIndicator({
  assetId,
  onStatusChange
}: ProcessingStatusIndicatorProps) {
  const [showStatus, setShowStatus] = useState(true);
  const [autoHideTimer, setAutoHideTimer] = useState<NodeJS.Timeout | null>(null);

  // Poll processing status
  const { status, retry } = useProcessingStatus(assetId, {
    enabled: !!assetId,
    onComplete: (status) => {
      if (onStatusChange) {
        onStatusChange('complete');
      }
      // Auto-dismiss success after 3s
      const timer = setTimeout(() => setShowStatus(false), 3000);
      setAutoHideTimer(timer);
    },
    onError: (error) => {
      if (onStatusChange) {
        onStatusChange('failed');
      }
    },
  });

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (autoHideTimer) {
        clearTimeout(autoHideTimer);
      }
    };
  }, [autoHideTimer]);

  // If no asset ID, show nothing
  if (!assetId) {
    return null;
  }

  // If status is hidden (after auto-dismiss), show nothing
  if (!showStatus) {
    return null;
  }

  // Loading state
  if (!status) {
    return (
      <span className="text-[#888888] text-xs font-mono">⏳ Checking...</span>
    );
  }

  // Determine current state
  const getState = () => {
    if (status.processingError) return 'failed';
    if (status.processed) return 'complete';
    return 'processing';
  };

  const currentState = getState();

  // Update parent if provided
  useEffect(() => {
    if (onStatusChange) {
      onStatusChange(currentState);
    }
  }, [currentState, onStatusChange]);

  // Retry handler
  const handleRetry = async () => {
    if (retry) {
      await retry();
    }
  };

  // Render based on state
  switch (currentState) {
    case 'processing':
      return (
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-[#7C5CFF] flex items-center gap-1">
            ⚡ Processing
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

    case 'complete':
      return (
        <div className="flex items-center gap-2 text-xs font-mono animate-fade-in">
          <span className="text-[#4ADE80]">✓ Processed</span>
        </div>
      );

    case 'failed':
      return (
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-[#EF4444]">⚠️ Failed</span>
          <button
            onClick={handleRetry}
            className="text-[#7C5CFF] hover:text-[#9B7FFF] underline font-medium"
            disabled={!retry}
          >
            Retry
          </button>
        </div>
      );

    default:
      return null;
  }
}
