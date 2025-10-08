'use client';

import { useEffect, useState } from 'react';
import { getEmbeddingQueueManager } from '@/lib/embedding-queue';

interface StatusStats {
  assetCount: number;
  storageUsed: number;
  lastUploadTime: Date | null;
  queueDepth: number;
}

/**
 * Hook to fetch and maintain status line statistics
 * Updates every 500ms when queue is active, every 5s when idle
 */
export function useStatusStats(): StatusStats {
  const [stats, setStats] = useState<StatusStats>({
    assetCount: 0,
    storageUsed: 0,
    lastUploadTime: null,
    queueDepth: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch assets from API
        const response = await fetch('/api/assets?limit=1000');
        if (!response.ok) return;

        const data = await response.json();
        const assets = data.assets || [];

        // Calculate stats
        const assetCount = assets.length;
        const storageUsed = assets.reduce((sum: number, asset: any) => sum + (asset.size || 0), 0);

        // Find most recent upload
        let lastUploadTime: Date | null = null;
        if (assets.length > 0) {
          const sortedByDate = [...assets].sort((a: any, b: any) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return dateB - dateA;
          });
          lastUploadTime = new Date(sortedByDate[0].createdAt);
        }

        // Get queue depth
        const queueManager = getEmbeddingQueueManager();
        const status = queueManager.getStatus();
        const queueDepth = status.queued + status.processing;

        setStats({
          assetCount,
          storageUsed,
          lastUploadTime,
          queueDepth,
        });
      } catch (error) {
        console.error('Failed to fetch status stats:', error);
      }
    };

    // Initial fetch
    fetchStats();

    // Set up polling - use queue depth to determine interval
    const getInterval = () => {
      const queueManager = getEmbeddingQueueManager();
      const status = queueManager.getStatus();
      const queueDepth = status.queued + status.processing;
      return queueDepth > 0 ? 500 : 5000; // 500ms when active, 5s when idle
    };

    let intervalId: NodeJS.Timeout;
    const setupInterval = () => {
      intervalId = setInterval(() => {
        fetchStats();
        // Re-setup interval with new timing if queue state changed
        clearInterval(intervalId);
        setupInterval();
      }, getInterval());
    };

    setupInterval();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return stats;
}
