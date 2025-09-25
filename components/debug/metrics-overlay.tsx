'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getGlobalMetricsCollector, type MetricsReport } from '@/lib/metrics-collector';
import { useCircuitBreakerStats } from '@/lib/circuit-breaker';
import { useConnectionPoolStats } from '@/lib/connection-pool';

/**
 * Debug overlay for displaying performance metrics in development
 * Toggle with Ctrl+Shift+M
 * Only visible in development mode
 */
export function MetricsOverlay() {
  const [metrics, setMetrics] = useState<MetricsReport | null>(null);
  const [visible, setVisible] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const circuitBreakerStats = useCircuitBreakerStats();
  const connectionPoolStats = useConnectionPoolStats();

  // Format bytes utility
  const formatBytes = useCallback((bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }, []);

  // Format duration utility
  const formatDuration = useCallback((ms: number): string => {
    if (!ms || ms === 0) return '0ms';
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }, []);

  useEffect(() => {
    // Only in development
    if (process.env.NODE_ENV !== 'development') return;

    // Keyboard shortcut: Ctrl+Shift+M
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        setVisible(v => !v);
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    // Update metrics every second
    const interval = setInterval(() => {
      if (visible) {
        const collector = getGlobalMetricsCollector();
        setMetrics(collector.getReport());
      }
    }, 1000);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      clearInterval(interval);
    };
  }, [visible]);

  // Don't render in production or when hidden
  if (process.env.NODE_ENV !== 'development' || !visible || !metrics) {
    return null;
  }

  // Calculate derived metrics
  const uploadSuccessRate = metrics.uploads.total > 0
    ? ((metrics.uploads.completed / metrics.uploads.total) * 100).toFixed(1)
    : '0';

  const totalApiCalls = Object.values(metrics.api).reduce(
    (sum, api) => sum + api.requests,
    0
  );

  const avgApiLatency = totalApiCalls > 0
    ? Object.values(metrics.api).reduce(
        (sum, api) => sum + api.avgDuration * api.requests,
        0
      ) / totalApiCalls
    : 0;

  // Minimized view
  if (minimized) {
    return (
      <div className="fixed top-4 right-4 bg-black/90 text-green-400 p-2 font-mono text-xs rounded-lg shadow-xl border border-[#7C5CFF]/20 z-50 cursor-pointer"
           onClick={() => setMinimized(false)}>
        <div className="flex items-center gap-2">
          <span className="text-[#BAFF39]">📊</span>
          <span>Uploads: {metrics.uploads.total}</span>
          <span>|</span>
          <span>API: {totalApiCalls}</span>
          <span>|</span>
          <span>Mem: {formatBytes(metrics.memory.current)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 bg-black/90 text-green-400 p-4 font-mono text-xs max-w-md rounded-lg shadow-xl border border-[#7C5CFF]/20 z-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white text-sm flex items-center gap-2">
          <span>📊</span>
          <span>Performance Metrics</span>
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMinimized(true)}
            className="text-gray-400 hover:text-white"
            title="Minimize"
          >
            _
          </button>
          <button
            onClick={() => setVisible(false)}
            className="text-gray-400 hover:text-white"
            title="Close"
          >
            ×
          </button>
        </div>
      </div>

      {/* System Status */}
      <section className="mb-3 p-2 bg-gray-900/50 rounded">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full animate-pulse ${
              circuitBreakerStats.isOpen ? 'bg-[#FF4D4D]' :
              connectionPoolStats.activeConnections >= 4 ? 'bg-[#FFB020]' :
              'bg-[#B6FF6E]'
            }`} />
            <span className="text-gray-400">System Status</span>
          </div>
          {circuitBreakerStats.isOpen && (
            <span className="text-[#FF4D4D] text-[10px]">
              Circuit Open ({Math.round(circuitBreakerStats.timeUntilClose / 1000)}s)
            </span>
          )}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
          <div>Connections: {connectionPoolStats.activeConnections}/4</div>
          <div>Queue: {connectionPoolStats.queuedRequests}</div>
        </div>
      </section>

      {/* Uploads Section */}
      <section className="mb-3">
        <h4 className="text-[#BAFF39] mb-1">Uploads</h4>
        <div className="ml-2 space-y-1">
          <div className="flex justify-between">
            <span>Total:</span>
            <span className="text-white">{metrics.uploads.total}</span>
          </div>
          <div className="flex justify-between">
            <span>In Progress:</span>
            <span className="text-[#7C5CFF]">{metrics.uploads.inProgress}</span>
          </div>
          <div className="flex justify-between">
            <span>Completed:</span>
            <span className="text-[#B6FF6E]">{metrics.uploads.completed}</span>
          </div>
          <div className="flex justify-between">
            <span>Failed:</span>
            <span className={metrics.uploads.failed > 0 ? 'text-[#FF4D4D]' : 'text-gray-500'}>
              {metrics.uploads.failed}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Success Rate:</span>
            <span className={Number(uploadSuccessRate) < 90 ? 'text-[#FFB020]' : 'text-[#B6FF6E]'}>
              {uploadSuccessRate}%
            </span>
          </div>
          <div className="flex justify-between">
            <span>Throughput:</span>
            <span className="text-[#7C5CFF]">{formatBytes(metrics.uploads.avgThroughput)}/s</span>
          </div>
          <div className="flex justify-between">
            <span>Total Size:</span>
            <span>{formatBytes(metrics.uploads.totalBytes)}</span>
          </div>
        </div>
      </section>

      {/* API Calls Section */}
      {Object.keys(metrics.api).length > 0 && (
        <section className="mb-3">
          <h4 className="text-[#BAFF39] mb-1">API Performance</h4>
          <div className="ml-2 mb-2 text-[10px] text-gray-400">
            Total: {totalApiCalls} | Avg: {formatDuration(avgApiLatency)}
          </div>
          <div className="ml-2 space-y-2 max-h-32 overflow-y-auto">
            {Object.entries(metrics.api).map(([endpoint, data]) => (
              <div key={endpoint} className="border-l-2 border-[#7C5CFF]/30 pl-2">
                <div className="text-blue-400 text-[10px] truncate" title={endpoint}>
                  {endpoint}
                </div>
                <div className="grid grid-cols-2 gap-x-2 text-[10px]">
                  <div>Requests: {data.requests}</div>
                  <div>Avg: {formatDuration(data.avgDuration)}</div>
                  <div>P95: {formatDuration(data.p95)}</div>
                  <div>P99: {formatDuration(data.p99)}</div>
                </div>
                {data.errorRate > 0 && (
                  <div className={`text-[10px] ${data.errorRate > 0.05 ? 'text-[#FF4D4D]' : 'text-[#FFB020]'}`}>
                    Error Rate: {(data.errorRate * 100).toFixed(1)}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Memory Section */}
      <section className="mb-3">
        <h4 className="text-[#BAFF39] mb-1">Memory Usage</h4>
        <div className="ml-2 space-y-1">
          <div className="flex justify-between">
            <span>Current:</span>
            <span className="text-white">{formatBytes(metrics.memory.current)}</span>
          </div>
          <div className="flex justify-between">
            <span>Peak:</span>
            <span className="text-[#FFB020]">{formatBytes(metrics.memory.peak)}</span>
          </div>
          <div className="flex justify-between">
            <span>Average:</span>
            <span>{formatBytes(metrics.memory.average)}</span>
          </div>
        </div>
        {/* Memory usage bar */}
        {metrics.memory.current > 0 && (
          <div className="mt-2">
            <div className="h-2 bg-gray-800 rounded overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  metrics.memory.current > 500 * 1024 * 1024 ? 'bg-[#FF4D4D]' :
                  metrics.memory.current > 300 * 1024 * 1024 ? 'bg-[#FFB020]' :
                  'bg-[#7C5CFF]'
                }`}
                style={{ width: `${Math.min(100, (metrics.memory.current / (1024 * 1024 * 1024)) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </section>

      {/* Errors Section */}
      {metrics.errors.total > 0 && (
        <section className="mb-3">
          <h4 className="text-[#BAFF39] mb-1">Errors</h4>
          <div className="ml-2 space-y-1">
            <div className="flex justify-between">
              <span>Total:</span>
              <span className="text-[#FF4D4D]">{metrics.errors.total}</span>
            </div>
            {Object.entries(metrics.errors.byType).map(([type, count]) => (
              <div key={type} className="flex justify-between text-[10px]">
                <span className="capitalize">{type}:</span>
                <span className="text-[#FFB020]">{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-gray-800 text-[10px] text-gray-600">
        <div className="flex justify-between items-center">
          <span>Press Ctrl+Shift+M to toggle</span>
          <span className="text-[#7C5CFF]">Development Mode</span>
        </div>
      </div>
    </div>
  );
}

// Export as default for lazy loading
export default MetricsOverlay;