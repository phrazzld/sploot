/**
 * Hook for real-time processing queue progress updates via SSE
 *
 * Connects to /api/sse/processing-updates to receive global queue statistics
 * every 5 seconds, showing progress through upload → process → embed pipeline.
 */

import { useEffect, useState, useCallback, useRef } from 'react';

export interface ProcessingStats {
  total: number;
  uploaded: number;
  processing: number;
  embedding: number;
  ready: number;
  failed: number;
}

export interface ProcessingProgressState {
  stats: ProcessingStats | null;
  isConnected: boolean;
  lastUpdate: number | null;
  error: string | null;
}

const INITIAL_STATS: ProcessingStats = {
  total: 0,
  uploaded: 0,
  processing: 0,
  embedding: 0,
  ready: 0,
  failed: 0,
};

/**
 * Hook to consume processing queue statistics via SSE
 *
 * @param options.enabled - Whether to connect to SSE (default: true)
 * @param options.onUpdate - Callback fired on each stats update
 * @returns Processing stats and connection state
 */
export function useProcessingProgress(options?: {
  enabled?: boolean;
  onUpdate?: (stats: ProcessingStats) => void;
}) {
  const [state, setState] = useState<ProcessingProgressState>({
    stats: null,
    isConnected: false,
    lastUpdate: null,
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const onUpdateRef = useRef(options?.onUpdate);

  // Keep callback ref current
  useEffect(() => {
    onUpdateRef.current = options?.onUpdate;
  }, [options?.onUpdate]);

  useEffect(() => {
    const enabled = options?.enabled ?? true;

    if (!enabled) {
      // Cleanup if disabled
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setState(prev => ({ ...prev, isConnected: false }));
      return;
    }

    // Create SSE connection
    const eventSource = new EventSource('/api/sse/processing-updates');
    eventSourceRef.current = eventSource;

    // Handle connection established
    eventSource.addEventListener('connected', () => {
      console.log('[ProcessingProgress] SSE connected');
      setState(prev => ({ ...prev, isConnected: true, error: null }));
    });

    // Handle progress updates
    eventSource.addEventListener('progress', (event) => {
      try {
        const data = JSON.parse(event.data);
        const stats: ProcessingStats = data.stats || INITIAL_STATS;

        setState(prev => ({
          ...prev,
          stats,
          lastUpdate: data.timestamp || Date.now(),
          error: null,
        }));

        // Call user callback
        if (onUpdateRef.current) {
          onUpdateRef.current(stats);
        }
      } catch (error) {
        console.error('[ProcessingProgress] Failed to parse SSE data:', error);
      }
    });

    // Handle errors
    eventSource.onerror = (error) => {
      console.error('[ProcessingProgress] SSE error:', error);

      // EventSource automatically reconnects, just update state
      setState(prev => ({
        ...prev,
        isConnected: eventSource.readyState === EventSource.OPEN,
        error: 'Connection interrupted, reconnecting...',
      }));
    };

    // Cleanup on unmount
    return () => {
      console.log('[ProcessingProgress] Disconnecting SSE');
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [options?.enabled]);

  const reconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    // Trigger re-mount by forcing state change
    setState(prev => ({ ...prev, isConnected: false }));
  }, []);

  return {
    ...state,
    reconnect,
  };
}
