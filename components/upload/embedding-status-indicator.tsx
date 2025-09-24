'use client';

import { useState, useEffect } from 'react';
import { FileMetadata } from '@/lib/file-metadata-manager';
import { useEmbeddingStatusSubscription } from '@/contexts/embedding-status-context';

interface EmbeddingStatusIndicatorProps {
  file: FileMetadata;
  onStatusChange: (status: 'pending' | 'processing' | 'ready' | 'failed', error?: string) => void;
}

/**
 * Component to handle inline embedding status display
 * Shows the current state of embedding generation for a file
 */
export function EmbeddingStatusIndicator({
  file,
  onStatusChange
}: EmbeddingStatusIndicatorProps) {
  const [showStatus, setShowStatus] = useState(true);
  const [autoHideTimer, setAutoHideTimer] = useState<NodeJS.Timeout | null>(null);

  // Use centralized embedding status subscription
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