/**
 * Hook for polling individual asset processing status
 *
 * Polls /api/assets/[id]/processing-status to track:
 * - Image processing state (processed flag)
 * - Embedding generation state (embedded flag)
 * - Error states and retry counts
 *
 * Automatically stops polling when processing completes or component unmounts.
 */

import { useEffect, useState, useCallback, useRef } from 'react';

export interface ProcessingStatusData {
  processed: boolean;
  embedded: boolean;
  processingError: string | null;
  embeddingError: string | null;
  processingRetryCount: number;
  embeddingRetryCount: number;
}

export interface ProcessingStatusState {
  status: ProcessingStatusData | null;
  isLoading: boolean;
  error: string | null;
  lastUpdate: number | null;
}

const POLL_INTERVAL_MS = 5000; // 5 seconds

/**
 * Hook to poll processing status for a single asset
 *
 * @param assetId - The asset ID to poll status for
 * @param options.enabled - Whether to poll (default: true)
 * @param options.onComplete - Callback when processing completes (processed=true)
 * @param options.onError - Callback when processing error occurs
 * @returns Processing status state and retry function
 */
export function useProcessingStatus(
  assetId: string | undefined,
  options?: {
    enabled?: boolean;
    onComplete?: (status: ProcessingStatusData) => void;
    onError?: (error: string) => void;
  }
) {
  const [state, setState] = useState<ProcessingStatusState>({
    status: null,
    isLoading: false,
    error: null,
    lastUpdate: null,
  });

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const onCompleteRef = useRef(options?.onComplete);
  const onErrorRef = useRef(options?.onError);

  // Keep callback refs current
  useEffect(() => {
    onCompleteRef.current = options?.onComplete;
    onErrorRef.current = options?.onError;
  }, [options?.onComplete, options?.onError]);

  // Fetch status function
  const fetchStatus = useCallback(async () => {
    if (!assetId) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`/api/assets/${assetId}/processing-status`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Asset not found');
        }
        throw new Error('Failed to fetch processing status');
      }

      const data = await response.json();
      const status: ProcessingStatusData = {
        processed: data.processed,
        embedded: data.embedded,
        processingError: data.processingError,
        embeddingError: data.embeddingError,
        processingRetryCount: data.processingRetryCount,
        embeddingRetryCount: data.embeddingRetryCount,
      };

      setState({
        status,
        isLoading: false,
        error: null,
        lastUpdate: Date.now(),
      });

      // Trigger callbacks
      if (status.processed && onCompleteRef.current) {
        onCompleteRef.current(status);
      }

      if (status.processingError && onErrorRef.current) {
        onErrorRef.current(status.processingError);
      }

      // Stop polling if processing is complete (or permanently failed)
      if (status.processed || (status.processingError && status.processingRetryCount >= 3)) {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));

      if (onErrorRef.current) {
        onErrorRef.current(errorMessage);
      }
    }
  }, [assetId]);

  // Set up polling
  useEffect(() => {
    const enabled = options?.enabled ?? true;

    if (!enabled || !assetId) {
      // Cleanup if disabled
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    // Initial fetch
    fetchStatus();

    // Start polling
    pollTimerRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);

    // Cleanup on unmount
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [assetId, options?.enabled, fetchStatus]);

  // Retry function for manual retry
  const retry = useCallback(async () => {
    if (!assetId) return;

    try {
      const response = await fetch(`/api/assets/${assetId}/retry-processing`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to retry processing');
      }

      const data = await response.json();

      if (data.success) {
        // Immediately fetch updated status
        await fetchStatus();

        // Restart polling if it was stopped
        if (!pollTimerRef.current) {
          pollTimerRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        error: errorMessage,
      }));
    }
  }, [assetId, fetchStatus]);

  return {
    ...state,
    retry,
    refetch: fetchStatus,
  };
}
