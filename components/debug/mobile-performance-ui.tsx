'use client';

import { useState, useEffect, useCallback } from 'react';
import { mobilePerformanceAnalyzer } from '@/lib/mobile-performance-analyzer';
import type { MobilePerformanceReport } from '@/lib/mobile-performance-analyzer';

export function MobilePerformanceUI() {
  const [report, setReport] = useState<MobilePerformanceReport | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'touch' | 'scroll' | 'gestures'>('overview');
  const [isRunning, setIsRunning] = useState(false);

  // Only show in development and on mobile/tablet
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const runAnalysis = useCallback(() => {
    if (!mobilePerformanceAnalyzer) return;

    setIsRunning(true);

    // Wait for some scroll/interaction data to accumulate
    setTimeout(() => {
      const performanceReport = mobilePerformanceAnalyzer.generateReport();
      setReport(performanceReport);
      setIsRunning(false);
      console.log('Mobile Performance Report:', performanceReport);

      // Save to localStorage
      localStorage.setItem('sploot-mobile-performance', JSON.stringify({
        timestamp: new Date().toISOString(),
        report: performanceReport,
      }));
    }, 2000);
  }, []);

  useEffect(() => {
    // Check if mobile/tablet
    const isMobileOrTablet = window.innerWidth < 1024 || 'ontouchstart' in window;

    if (isMobileOrTablet) {
      // Auto-run after delay
      const timer = setTimeout(() => {
        runAnalysis();
        setIsVisible(true);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [runAnalysis]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mobilePerformanceAnalyzer?.cleanup();
    };
  }, []);

  if (!isVisible || !report) {
    return null;
  }

  if (isMinimized) {
    return (
      <div className="fixed top-20 right-4 z-[100]">
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-[#14171A] border border-[#2A2F37] text-white px-2 py-1 rounded text-[10px] font-mono"
        >
          📱 Mobile Perf
        </button>
      </div>
    );
  }

  const performanceScore = Math.round(
    (report.touchTargets.complianceRate.appleHIG +
     (100 - report.thumbZone.hard.percentage) +
     Math.min(100, (report.scrollPerformance.frameRate.average / 60) * 100) +
     (100 - report.scrollPerformance.scrollJank.jankPercentage)) / 4
  );

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-[#22C55E]';
    if (score >= 70) return 'text-[#B6FF6E]';
    if (score >= 50) return 'text-[#FFB020]';
    return 'text-[#FF4D4D]';
  };

  const getComplianceColor = (rate: number) => {
    if (rate >= 90) return 'text-[#22C55E]';
    if (rate >= 75) return 'text-[#B6FF6E]';
    if (rate >= 50) return 'text-[#FFB020]';
    return 'text-[#FF4D4D]';
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100] bg-[#14171A] border border-[#2A2F37] rounded-lg shadow-xl w-80 max-h-[500px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[#2A2F37]">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-[#FFB020] animate-pulse' : 'bg-[#B6FF6E]'}`} />
          <span className="text-xs font-mono text-[#E6E8EB]">Mobile Performance</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold ${getScoreColor(performanceScore)}`}>
            {performanceScore}
          </span>
          <div className="flex gap-1">
            <button
              onClick={runAnalysis}
              disabled={isRunning}
              className="text-[10px] px-2 py-1 bg-[#7C5CFF] text-white rounded disabled:opacity-50"
            >
              {isRunning ? '...' : 'Re-run'}
            </button>
            <button
              onClick={() => setIsMinimized(true)}
              className="text-[10px] px-2 py-1 text-[#B3B7BE] hover:text-white"
            >
              _
            </button>
          </div>
        </div>
      </div>

      {/* Device Info Bar */}
      <div className="px-3 py-1 bg-[#1B1F24] text-[10px] text-[#B3B7BE] flex justify-between">
        <span>{report.device.viewport.width}×{report.device.viewport.height}</span>
        <span>{report.device.pixelRatio}x</span>
        <span>{report.device.orientation}</span>
        <span>{report.device.isTouchDevice ? 'Touch' : 'Mouse'}</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#2A2F37]">
        {(['overview', 'touch', 'scroll', 'gestures'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-2 py-1.5 text-[10px] font-mono capitalize ${
              activeTab === tab
                ? 'bg-[#1B1F24] text-[#E6E8EB] border-b-2 border-[#7C5CFF]'
                : 'text-[#B3B7BE] hover:text-[#E6E8EB]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'overview' && (
          <div className="space-y-3">
            {/* Score Breakdown */}
            <div className="space-y-2">
              <div className="text-[10px] text-[#B3B7BE] uppercase">Performance Score</div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[#B3B7BE]">Touch Compliance:</span>
                  <span className={getComplianceColor(report.touchTargets.complianceRate.appleHIG)}>
                    {report.touchTargets.complianceRate.appleHIG.toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#B3B7BE]">Thumb Reach:</span>
                  <span className={getComplianceColor(100 - report.thumbZone.hard.percentage)}>
                    {(100 - report.thumbZone.hard.percentage).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#B3B7BE]">Frame Rate:</span>
                  <span className={getComplianceColor((report.scrollPerformance.frameRate.average / 60) * 100)}>
                    {report.scrollPerformance.frameRate.average.toFixed(0)} FPS
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#B3B7BE]">Jank-free:</span>
                  <span className={getComplianceColor(100 - report.scrollPerformance.scrollJank.jankPercentage)}>
                    {(100 - report.scrollPerformance.scrollJank.jankPercentage).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Key Issues */}
            {report.touchTargets.nonCompliant.length > 0 && (
              <div className="bg-[#1B1F24] rounded p-2">
                <div className="text-[10px] text-[#FF4D4D] uppercase mb-1">Issues</div>
                <div className="text-xs text-[#E6E8EB]">
                  {report.touchTargets.nonCompliant.length} small touch targets
                </div>
              </div>
            )}

            {/* Recommendations */}
            {report.recommendations.length > 0 && (
              <div>
                <div className="text-[10px] text-[#B3B7BE] uppercase mb-1">Recommendations</div>
                <div className="space-y-1">
                  {report.recommendations.slice(0, 3).map((rec, i) => (
                    <div key={i} className="text-[10px] text-[#E6E8EB]">
                      • {rec}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'touch' && (
          <div className="space-y-3">
            {/* Touch Target Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#1B1F24] rounded p-2">
                <div className="text-[10px] text-[#B3B7BE]">Total Targets</div>
                <div className="text-sm font-mono text-[#E6E8EB]">
                  {report.touchTargets.all.length}
                </div>
              </div>
              <div className="bg-[#1B1F24] rounded p-2">
                <div className="text-[10px] text-[#B3B7BE]">Avg Size</div>
                <div className="text-sm font-mono text-[#E6E8EB]">
                  {report.touchTargets.averageSize.width.toFixed(0)}×{report.touchTargets.averageSize.height.toFixed(0)}
                </div>
              </div>
            </div>

            {/* Compliance */}
            <div>
              <div className="text-[10px] text-[#B3B7BE] uppercase mb-1">Compliance</div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-[#B3B7BE]">Apple HIG (44×44)</span>
                    <span className={getComplianceColor(report.touchTargets.complianceRate.appleHIG)}>
                      {report.touchTargets.complianceRate.appleHIG.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 bg-[#1B1F24] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#7C5CFF]"
                      style={{ width: `${report.touchTargets.complianceRate.appleHIG}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-[#B3B7BE]">Material (48×48)</span>
                    <span className={getComplianceColor(report.touchTargets.complianceRate.materialDesign)}>
                      {report.touchTargets.complianceRate.materialDesign.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 bg-[#1B1F24] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#B6FF6E]"
                      style={{ width: `${report.touchTargets.complianceRate.materialDesign}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Thumb Zones */}
            <div>
              <div className="text-[10px] text-[#B3B7BE] uppercase mb-1">Thumb Zones</div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#22C55E]">Easy</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-[#1B1F24] rounded-full h-1.5">
                      <div
                        className="bg-[#22C55E] h-1.5 rounded-full"
                        style={{ width: `${report.thumbZone.easy.percentage}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-[#E6E8EB] w-10 text-right">
                      {report.thumbZone.easy.percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#FFB020]">Stretch</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-[#1B1F24] rounded-full h-1.5">
                      <div
                        className="bg-[#FFB020] h-1.5 rounded-full"
                        style={{ width: `${report.thumbZone.stretch.percentage}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-[#E6E8EB] w-10 text-right">
                      {report.thumbZone.stretch.percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#FF4D4D]">Hard</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-[#1B1F24] rounded-full h-1.5">
                      <div
                        className="bg-[#FF4D4D] h-1.5 rounded-full"
                        style={{ width: `${report.thumbZone.hard.percentage}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-[#E6E8EB] w-10 text-right">
                      {report.thumbZone.hard.percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Non-compliant Elements */}
            {report.touchTargets.nonCompliant.length > 0 && (
              <div>
                <div className="text-[10px] text-[#FF4D4D] uppercase mb-1">
                  Small Targets ({report.touchTargets.nonCompliant.length})
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {report.touchTargets.nonCompliant.slice(0, 5).map((target, i) => (
                    <div key={i} className="text-[10px] text-[#E6E8EB]">
                      {target.label}: {target.width.toFixed(0)}×{target.height.toFixed(0)}px
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'scroll' && (
          <div className="space-y-3">
            {/* Frame Rate */}
            <div>
              <div className="text-[10px] text-[#B3B7BE] uppercase mb-1">Frame Rate</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#1B1F24] rounded p-2">
                  <div className="text-[10px] text-[#B3B7BE]">Current</div>
                  <div className="text-sm font-mono text-[#E6E8EB]">
                    {report.scrollPerformance.frameRate.current.toFixed(0)} FPS
                  </div>
                </div>
                <div className="bg-[#1B1F24] rounded p-2">
                  <div className="text-[10px] text-[#B3B7BE]">Average</div>
                  <div className="text-sm font-mono text-[#E6E8EB]">
                    {report.scrollPerformance.frameRate.average.toFixed(0)} FPS
                  </div>
                </div>
                <div className="bg-[#1B1F24] rounded p-2">
                  <div className="text-[10px] text-[#B3B7BE]">Min</div>
                  <div className="text-sm font-mono text-[#FF4D4D]">
                    {report.scrollPerformance.frameRate.min.toFixed(0)} FPS
                  </div>
                </div>
                <div className="bg-[#1B1F24] rounded p-2">
                  <div className="text-[10px] text-[#B3B7BE]">Dropped</div>
                  <div className="text-sm font-mono text-[#FFB020]">
                    {report.scrollPerformance.frameRate.droppedFrames}
                  </div>
                </div>
              </div>
            </div>

            {/* Jank Analysis */}
            <div>
              <div className="text-[10px] text-[#B3B7BE] uppercase mb-1">Scroll Jank</div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[#B3B7BE]">Jank Events:</span>
                  <span className={report.scrollPerformance.scrollJank.jankEvents > 10 ? 'text-[#FF4D4D]' : 'text-[#E6E8EB]'}>
                    {report.scrollPerformance.scrollJank.jankEvents}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#B3B7BE]">Total Duration:</span>
                  <span className="text-[#E6E8EB]">
                    {report.scrollPerformance.scrollJank.totalJankDuration.toFixed(0)}ms
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#B3B7BE]">Longest Jank:</span>
                  <span className="text-[#FFB020]">
                    {report.scrollPerformance.scrollJank.longestJank.toFixed(0)}ms
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#B3B7BE]">Jank Rate:</span>
                  <span className={getComplianceColor(100 - report.scrollPerformance.scrollJank.jankPercentage)}>
                    {report.scrollPerformance.scrollJank.jankPercentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Scroll Features */}
            <div>
              <div className="text-[10px] text-[#B3B7BE] uppercase mb-1">Features</div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[#B3B7BE]">Momentum:</span>
                  <span className={report.scrollPerformance.momentum.enabled ? 'text-[#22C55E]' : 'text-[#FF4D4D]'}>
                    {report.scrollPerformance.momentum.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#B3B7BE]">Overscroll:</span>
                  <span className={report.scrollPerformance.overscroll.bounceEnabled ? 'text-[#22C55E]' : 'text-[#B3B7BE]'}>
                    {report.scrollPerformance.overscroll.bounceEnabled ? 'Bounce' : 'None'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'gestures' && (
          <div className="space-y-3">
            {/* Gesture Support */}
            <div>
              <div className="text-[10px] text-[#B3B7BE] uppercase mb-1">Gesture Support</div>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(report.gestureConflicts.gestureRecognizers).map(([gesture, supported]) => (
                  <div key={gesture} className="flex items-center gap-1 text-xs">
                    <span className={supported ? 'text-[#22C55E]' : 'text-[#5A616A]'}>
                      {supported ? '✓' : '✗'}
                    </span>
                    <span className="text-[#B3B7BE] capitalize">{gesture}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Conflicts */}
            <div>
              <div className="text-[10px] text-[#B3B7BE] uppercase mb-1">Gesture Conflicts</div>
              <div className="space-y-2">
                {report.gestureConflicts.swipeConflicts.horizontal.length > 0 && (
                  <div>
                    <div className="text-[10px] text-[#FFB020] mb-1">
                      Horizontal Swipe ({report.gestureConflicts.swipeConflicts.horizontal.length})
                    </div>
                    <div className="text-[10px] text-[#B3B7BE]">
                      Elements may conflict with back gesture
                    </div>
                  </div>
                )}

                {report.gestureConflicts.accidentalTaps.nearEdges.length > 0 && (
                  <div>
                    <div className="text-[10px] text-[#FFB020] mb-1">
                      Edge Taps ({report.gestureConflicts.accidentalTaps.nearEdges.length})
                    </div>
                    <div className="text-[10px] text-[#B3B7BE]">
                      Elements too close to screen edges
                    </div>
                  </div>
                )}

                {report.gestureConflicts.tapDeadZones.percentage > 30 && (
                  <div>
                    <div className="text-[10px] text-[#FF4D4D] mb-1">
                      Dead Zones
                    </div>
                    <div className="text-[10px] text-[#B3B7BE]">
                      {report.gestureConflicts.tapDeadZones.percentage.toFixed(0)}% of screen not tappable
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-3 border-t border-[#2A2F37]">
        <button
          onClick={() => {
            const reportText = mobilePerformanceAnalyzer?.generateDetailedReport() || '';
            navigator.clipboard.writeText(reportText);
          }}
          className="w-full text-[10px] px-2 py-1 bg-[#1B1F24] text-[#B3B7BE] rounded hover:bg-[#2A2F37]"
        >
          Copy Full Report
        </button>
      </div>
    </div>
  );
}