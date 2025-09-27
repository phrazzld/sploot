'use client';

import { useState, useEffect, useCallback } from 'react';
import { performanceProfiler } from '@/lib/performance-profiler';

export function PerformanceProfilerUI() {
  const [isProfilerActive, setIsProfilerActive] = useState(false);
  const [report, setReport] = useState<string>('');
  const [isMinimized, setIsMinimized] = useState(false);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const runProfiler = useCallback(() => {
    if (!performanceProfiler) return;

    setIsProfilerActive(true);

    // Wait for page to stabilize
    setTimeout(() => {
      // Test some interactions
      const sidebar = document.querySelector('aside');
      const navButtons = sidebar?.querySelectorAll('a, button') || [];

      // Measure a few clicks
      const measureInteractions = async () => {
        for (let i = 0; i < Math.min(3, navButtons.length); i++) {
          const element = navButtons[i] as HTMLElement;
          await performanceProfiler.measureInteractionDelay(element);
          // Small delay between measurements
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Generate report
        const reportText = performanceProfiler.generateReport();
        setReport(reportText);
        setIsProfilerActive(false);

        // Log to console
        console.log('Performance Profile:', performanceProfiler.getMetrics());
        console.log(reportText);

        // Save to localStorage for reference
        localStorage.setItem('sploot-performance-baseline', JSON.stringify({
          timestamp: new Date().toISOString(),
          metrics: performanceProfiler.getMetrics(),
          report: reportText,
        }));
      };

      measureInteractions();
    }, 1000);
  }, []);

  useEffect(() => {
    // Auto-run on mount in dev
    if (process.env.NODE_ENV === 'development' && !report) {
      runProfiler();
    }
  }, []);

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-[100]">
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-[#7C5CFF] text-white px-3 py-1 rounded text-xs font-mono"
        >
          Perf Profiler
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[100] bg-[#14171A] border border-[#2A2F37] rounded-lg shadow-xl max-w-md">
      <div className="flex items-center justify-between p-3 border-b border-[#2A2F37]">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isProfilerActive ? 'bg-[#BAFF39] animate-pulse' : 'bg-[#7C5CFF]'}`} />
          <span className="text-xs font-mono text-[#E6E8EB]">Performance Profiler</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={runProfiler}
            disabled={isProfilerActive}
            className="text-xs px-2 py-1 bg-[#7C5CFF] text-white rounded disabled:opacity-50"
          >
            {isProfilerActive ? 'Running...' : 'Re-run'}
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="text-xs px-2 py-1 text-[#B3B7BE] hover:text-white"
          >
            _
          </button>
        </div>
      </div>

      {report && (
        <div className="p-3 max-h-96 overflow-y-auto">
          <pre className="text-[10px] text-[#B3B7BE] font-mono whitespace-pre-wrap">
            {report}
          </pre>
          <button
            onClick={() => {
              navigator.clipboard.writeText(report);
            }}
            className="mt-2 text-xs px-2 py-1 bg-[#1B1F24] text-[#B3B7BE] rounded hover:bg-[#2A2F37]"
          >
            Copy Report
          </button>
        </div>
      )}
    </div>
  );
}