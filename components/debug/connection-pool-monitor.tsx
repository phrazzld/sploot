'use client';

import React from 'react';
import { useConnectionPoolStats } from '@/lib/connection-pool';

/**
 * Debug component to monitor connection pool status
 * Only visible in development mode
 */
export function ConnectionPoolMonitor() {
  const stats = useConnectionPoolStats();
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    // Toggle with Ctrl+Shift+P
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  if (process.env.NODE_ENV !== 'development' || !isVisible) {
    return null;
  }

  const connectionBarWidth = (stats.activeConnections / 4) * 100;
  const isAtCapacity = stats.activeConnections >= 4;

  return (
    <div className="fixed top-4 right-4 bg-black/90 text-xs font-mono p-4 rounded-lg shadow-xl border border-[#7C5CFF]/20 max-w-sm z-50">
      <div className="text-[#BAFF39] mb-2 flex items-center justify-between">
        <span>Connection Pool Monitor</span>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-white"
        >
          ×
        </button>
      </div>

      {/* Active Connections Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-gray-400 mb-1">
          <span>Active</span>
          <span className={isAtCapacity ? 'text-[#FF4D4D]' : 'text-[#B6FF6E]'}>
            {stats.activeConnections}/4
          </span>
        </div>
        <div className="h-2 bg-gray-800 rounded overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isAtCapacity ? 'bg-[#FF4D4D]' : 'bg-[#7C5CFF]'
            }`}
            style={{ width: `${connectionBarWidth}%` }}
          />
        </div>
      </div>

      {/* Queue Status */}
      {stats.queuedRequests > 0 && (
        <div className="mb-3 p-2 bg-[#FFB020]/10 rounded">
          <div className="text-[#FFB020]">
            ⚠️ {stats.queuedRequests} requests queued
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="space-y-1 text-gray-300">
        <div className="flex justify-between">
          <span>Total Processed:</span>
          <span className="text-[#B6FF6E]">{stats.totalProcessed}</span>
        </div>
        <div className="flex justify-between">
          <span>Total Errors:</span>
          <span className={stats.totalErrors > 0 ? 'text-[#FF4D4D]' : 'text-gray-500'}>
            {stats.totalErrors}
          </span>
        </div>
        {stats.averageWaitTime > 0 && (
          <div className="flex justify-between">
            <span>Avg Wait:</span>
            <span className="text-[#7C5CFF]">{stats.averageWaitTime}ms</span>
          </div>
        )}
      </div>

      {/* Status Indicator */}
      <div className="mt-3 pt-3 border-t border-gray-800">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full animate-pulse ${
            isAtCapacity ? 'bg-[#FF4D4D]' : 'bg-[#B6FF6E]'
          }`} />
          <span className="text-gray-400 text-[10px]">
            {isAtCapacity ? 'At capacity - requests queuing' : 'Healthy - slots available'}
          </span>
        </div>
      </div>

      <div className="mt-2 text-[10px] text-gray-600">
        Press Ctrl+Shift+P to toggle
      </div>
    </div>
  );
}