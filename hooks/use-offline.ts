'use client';

import { useEffect, useState, useCallback } from 'react';

interface OfflineState {
  isOffline: boolean;
  isSlowConnection: boolean;
  wasOffline: boolean;
  connectionType: string | undefined;
}

export function useOffline() {
  const [offlineState, setOfflineState] = useState<OfflineState>({
    isOffline: false,
    isSlowConnection: false,
    wasOffline: false,
    connectionType: undefined,
  });

  const checkConnection = useCallback(async () => {
    // Check navigator.onLine first
    if (!navigator.onLine) {
      setOfflineState(prev => ({
        ...prev,
        isOffline: true,
        wasOffline: true,
      }));
      return false;
    }

    // Try to fetch a small resource to verify actual connectivity
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        setOfflineState(prev => ({
          ...prev,
          isOffline: false,
          isSlowConnection: false,
        }));
        return true;
      }
    } catch (error) {
      // Network error or timeout
      setOfflineState(prev => ({
        ...prev,
        isOffline: true,
        wasOffline: true,
      }));
      return false;
    }

    return false;
  }, []);

  const checkConnectionSpeed = useCallback(() => {
    // Use Network Information API if available
    const connection = (navigator as any).connection ||
                       (navigator as any).mozConnection ||
                       (navigator as any).webkitConnection;

    if (connection) {
      const effectiveType = connection.effectiveType;
      const downlink = connection.downlink;

      setOfflineState(prev => ({
        ...prev,
        connectionType: effectiveType,
        isSlowConnection: effectiveType === 'slow-2g' || effectiveType === '2g' || downlink < 0.5,
      }));
    }
  }, []);

  useEffect(() => {
    // Initial check
    checkConnection();
    checkConnectionSpeed();

    // Set up event listeners
    const handleOnline = () => {
      checkConnection();
      checkConnectionSpeed();
    };

    const handleOffline = () => {
      setOfflineState(prev => ({
        ...prev,
        isOffline: true,
        wasOffline: true,
      }));
    };

    const handleConnectionChange = () => {
      checkConnectionSpeed();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for connection changes if supported
    const connection = (navigator as any).connection ||
                       (navigator as any).mozConnection ||
                       (navigator as any).webkitConnection;

    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
    }

    // Periodic check every 30 seconds
    const intervalId = setInterval(() => {
      checkConnection();
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
      clearInterval(intervalId);
    };
  }, [checkConnection, checkConnectionSpeed]);

  return {
    ...offlineState,
    checkConnection,
  };
}