'use client';

import { useState, useEffect, useCallback } from 'react';
import { viewportAnalyzer } from '@/lib/viewport-analyzer';
import type { ViewportMetrics } from '@/lib/viewport-analyzer';

export function ViewportAnalyzerUI() {
  const [metrics, setMetrics] = useState<ViewportMetrics | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const updateMetrics = useCallback(() => {
    if (!viewportAnalyzer) return;
    const newMetrics = viewportAnalyzer.refresh();
    setMetrics(newMetrics);
  }, []);

  useEffect(() => {
    updateMetrics();

    // Update on resize
    const handleResize = () => {
      updateMetrics();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateMetrics]);

  useEffect(() => {
    // Show after a short delay to not interfere with initial render
    const timer = setTimeout(() => setIsVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  if (!isVisible || !metrics) {
    return null;
  }

  if (isMinimized) {
    return (
      <div className="fixed top-4 right-4 z-[100]">
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-[#14171A] border border-[#2A2F37] text-white px-3 py-1 rounded text-xs font-mono hover:bg-[#1B1F24]"
        >
          Viewport: {metrics.viewport.width}×{metrics.viewport.height}
        </button>
      </div>
    );
  }

  const comparison = viewportAnalyzer?.compareToTarget();

  return (
    <div className="fixed top-4 right-4 z-[100] bg-[#14171A] border border-[#2A2F37] rounded-lg shadow-xl w-80">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[#2A2F37]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#B6FF6E]" />
          <span className="text-xs font-mono text-[#E6E8EB]">Viewport Analyzer</span>
        </div>
        <button
          onClick={() => setIsMinimized(true)}
          className="text-xs px-2 py-1 text-[#B3B7BE] hover:text-white"
        >
          _
        </button>
      </div>

      {/* Metrics */}
      <div className="p-3 space-y-3 max-h-[500px] overflow-y-auto">
        {/* Viewport Info */}
        <div className="space-y-1">
          <div className="text-[10px] font-mono text-[#B3B7BE] uppercase tracking-wider">Viewport</div>
          <div className="text-sm text-[#E6E8EB] font-mono">
            {metrics.viewport.width}×{metrics.viewport.height} ({metrics.breakpoints.currentBreakpoint})
          </div>
          <div className="text-xs text-[#B3B7BE]">
            {metrics.viewport.totalPixels.toLocaleString()} pixels total
          </div>
        </div>

        {/* Chrome Usage */}
        <div className="space-y-1">
          <div className="text-[10px] font-mono text-[#B3B7BE] uppercase tracking-wider">UI Chrome</div>
          <div className="space-y-1">
            {metrics.breakpoints.isDesktop && metrics.chrome.sidebarWidth > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-[#B3B7BE]">Sidebar:</span>
                <span className="text-[#E6E8EB] font-mono">{metrics.chrome.sidebarWidth}px</span>
              </div>
            )}
            {metrics.breakpoints.isMobile && (
              <>
                <div className="flex justify-between text-xs">
                  <span className="text-[#B3B7BE]">Header:</span>
                  <span className="text-[#E6E8EB] font-mono">{metrics.chrome.headerHeight}px</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#B3B7BE]">Nav:</span>
                  <span className="text-[#E6E8EB] font-mono">{metrics.chrome.bottomNavHeight}px</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-xs pt-1 border-t border-[#2A2F37]">
              <span className="text-[#B3B7BE]">Total Chrome:</span>
              <span className="text-[#FF64C5] font-mono">{metrics.chrome.chromePercentage.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="space-y-1">
          <div className="text-[10px] font-mono text-[#B3B7BE] uppercase tracking-wider">Content Area</div>
          <div className="text-sm text-[#E6E8EB] font-mono">
            {Math.round(metrics.content.width)}×{Math.round(metrics.content.height)}
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[#B3B7BE]">Usage:</span>
            <span className="text-[#B6FF6E] font-mono">{metrics.content.contentPercentage.toFixed(1)}%</span>
          </div>
        </div>

        {/* Waste Analysis */}
        {(metrics.margins.totalWastedHorizontal > 0 || metrics.margins.totalWastedVertical > 0) && (
          <div className="space-y-1">
            <div className="text-[10px] font-mono text-[#B3B7BE] uppercase tracking-wider">Margins/Spacing</div>
            <div className="flex justify-between text-xs">
              <span className="text-[#B3B7BE]">Horizontal:</span>
              <span className="text-[#FFB020] font-mono">{metrics.margins.totalWastedHorizontal}px</span>
            </div>
            {metrics.margins.totalWastedVertical > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-[#B3B7BE]">Vertical:</span>
                <span className="text-[#FFB020] font-mono">{metrics.margins.totalWastedVertical}px</span>
              </div>
            )}
          </div>
        )}

        {/* Visual Bar */}
        <div className="space-y-1">
          <div className="text-[10px] font-mono text-[#B3B7BE] uppercase tracking-wider">Distribution</div>
          <div className="h-6 flex rounded overflow-hidden border border-[#2A2F37]">
            <div
              className="bg-[#FF64C5]"
              style={{ width: `${metrics.chrome.chromePercentage}%` }}
              title={`Chrome: ${metrics.chrome.chromePercentage.toFixed(1)}%`}
            />
            <div
              className="bg-[#B6FF6E]"
              style={{ width: `${metrics.content.contentPercentage}%` }}
              title={`Content: ${metrics.content.contentPercentage.toFixed(1)}%`}
            />
          </div>
        </div>

        {/* Comparison to Target */}
        {comparison && (
          <div className="space-y-1 pt-2 border-t border-[#2A2F37]">
            <div className="text-[10px] font-mono text-[#B3B7BE] uppercase tracking-wider">vs Target</div>
            <div className="flex justify-between text-xs">
              <span className="text-[#B3B7BE]">Current:</span>
              <span className="text-[#E6E8EB] font-mono">{comparison.current.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#B3B7BE]">Target:</span>
              <span className="text-[#7C5CFF] font-mono">{comparison.target.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#B3B7BE]">Gain:</span>
              <span className="text-[#22C55E] font-mono">
                +{comparison.improvement.toFixed(1)}% ({(comparison.pixelsReclaimed / 1000).toFixed(0)}k px)
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => {
              const report = viewportAnalyzer?.generateDetailedReport() || '';
              navigator.clipboard.writeText(report);
            }}
            className="flex-1 text-xs px-2 py-1 bg-[#1B1F24] text-[#B3B7BE] rounded hover:bg-[#2A2F37]"
          >
            Copy Report
          </button>
          <button
            onClick={updateMetrics}
            className="text-xs px-2 py-1 bg-[#7C5CFF] text-white rounded hover:bg-[#7C5CFF]/80"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}