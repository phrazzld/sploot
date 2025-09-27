'use client';

import { useState, useEffect, useCallback } from 'react';
import { navigationAuditor } from '@/lib/navigation-auditor';
import type { NavigationAuditReport, NavigationElement } from '@/lib/navigation-auditor';

export function NavigationAuditUI() {
  const [report, setReport] = useState<NavigationAuditReport | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedElement, setSelectedElement] = useState<NavigationElement | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'elements' | 'issues'>('overview');

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const runAudit = useCallback(() => {
    if (!navigationAuditor) return;
    const auditReport = navigationAuditor.getReport();
    setReport(auditReport);
    console.log('Navigation Audit:', auditReport);
  }, []);

  useEffect(() => {
    // Run audit after delay to ensure DOM is ready
    const timer = setTimeout(() => {
      runAudit();
      setIsVisible(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [runAudit]);

  if (!isVisible || !report) {
    return null;
  }

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 left-4 z-[100]">
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-[#14171A] border border-[#2A2F37] text-white px-3 py-1 rounded text-xs font-mono flex items-center gap-2"
        >
          <div className="w-2 h-2 rounded-full bg-[#7C5CFF]" />
          Nav Audit
        </button>
      </div>
    );
  }

  const getUsageColor = (usage: NavigationElement['estimatedUsage']) => {
    const colors = {
      critical: 'text-[#FF64C5]',
      high: 'text-[#7C5CFF]',
      medium: 'text-[#B6FF6E]',
      low: 'text-[#B3B7BE]',
      rare: 'text-[#5A616A]',
    };
    return colors[usage];
  };

  const getDepthColor = (depth: number) => {
    if (depth === 0) return 'text-[#B6FF6E]';
    if (depth === 1) return 'text-[#E6E8EB]';
    if (depth === 2) return 'text-[#FFB020]';
    return 'text-[#FF4D4D]';
  };

  return (
    <div className="fixed bottom-4 left-4 z-[100] bg-[#14171A] border border-[#2A2F37] rounded-lg shadow-xl w-96 max-h-[600px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[#2A2F37]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#7C5CFF]" />
          <span className="text-xs font-mono text-[#E6E8EB]">Navigation Audit</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={runAudit}
            className="text-xs px-2 py-1 bg-[#7C5CFF] text-white rounded hover:bg-[#7C5CFF]/80"
          >
            Re-audit
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="text-xs px-2 py-1 text-[#B3B7BE] hover:text-white"
          >
            _
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#2A2F37]">
        {(['overview', 'elements', 'issues'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-3 py-2 text-xs font-mono capitalize ${
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
            {/* Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#1B1F24] rounded p-2">
                <div className="text-[10px] text-[#B3B7BE] uppercase">Total Elements</div>
                <div className="text-lg font-mono text-[#E6E8EB]">{report.summary.totalElements}</div>
              </div>
              <div className="bg-[#1B1F24] rounded p-2">
                <div className="text-[10px] text-[#B3B7BE] uppercase">Avg Depth</div>
                <div className="text-lg font-mono text-[#E6E8EB]">
                  {report.summary.averageClickDepth.toFixed(1)}
                </div>
              </div>
              <div className="bg-[#1B1F24] rounded p-2">
                <div className="text-[10px] text-[#B3B7BE] uppercase">Touch Compliance</div>
                <div className={`text-lg font-mono ${
                  report.summary.touchTargetCompliance > 80 ? 'text-[#22C55E]' : 'text-[#FFB020]'
                }`}>
                  {report.summary.touchTargetCompliance.toFixed(0)}%
                </div>
              </div>
              <div className="bg-[#1B1F24] rounded p-2">
                <div className="text-[10px] text-[#B3B7BE] uppercase">Keyboard Access</div>
                <div className={`text-lg font-mono ${
                  report.summary.keyboardAccessibility > 90 ? 'text-[#22C55E]' : 'text-[#FFB020]'
                }`}>
                  {report.summary.keyboardAccessibility.toFixed(0)}%
                </div>
              </div>
            </div>

            {/* Location breakdown */}
            <div>
              <div className="text-[10px] text-[#B3B7BE] uppercase mb-2">By Location</div>
              <div className="space-y-1">
                {Object.entries(report.summary.byLocation).map(([location, count]) => (
                  <div key={location} className="flex justify-between text-xs">
                    <span className="text-[#B3B7BE]">{location}:</span>
                    <span className="text-[#E6E8EB] font-mono">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Depth distribution */}
            <div>
              <div className="text-[10px] text-[#B3B7BE] uppercase mb-2">Click Depth</div>
              <div className="space-y-1">
                {Object.entries(report.summary.byClickDepth)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([depth, count]) => (
                    <div key={depth} className="flex items-center justify-between">
                      <span className={`text-xs ${getDepthColor(Number(depth))}`}>
                        Depth {depth}:
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-[#1B1F24] rounded-full h-2">
                          <div
                            className="bg-[#7C5CFF] h-2 rounded-full"
                            style={{ width: `${(count / report.summary.totalElements) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-[#E6E8EB] w-8 text-right">
                          {count}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Most used */}
            <div>
              <div className="text-[10px] text-[#B3B7BE] uppercase mb-2">Most Used (Estimated)</div>
              <div className="space-y-1">
                {report.usageAnalysis.mostUsed.slice(0, 5).map((el, i) => (
                  <div key={el.id} className="flex items-center justify-between text-xs">
                    <span className="text-[#E6E8EB]">
                      {i + 1}. {el.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={getUsageColor(el.estimatedUsage)}>
                        {el.estimatedUsage}
                      </span>
                      <span className="text-[#5A616A]">d:{el.clickDepth}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'elements' && (
          <div className="space-y-2">
            {report.elements.map(element => (
              <button
                key={element.id}
                onClick={() => setSelectedElement(element)}
                className="w-full text-left bg-[#1B1F24] rounded p-2 hover:bg-[#2A2F37] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#E6E8EB] truncate flex-1">
                    {element.label}
                  </span>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className={getDepthColor(element.clickDepth)}>
                      d:{element.clickDepth}
                    </span>
                    <span className={`${
                      element.touchTarget.meetsMinimum ? 'text-[#22C55E]' : 'text-[#FF4D4D]'
                    }`}>
                      {element.touchTarget.width.toFixed(0)}×{element.touchTarget.height.toFixed(0)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-[#5A616A]">{element.location}</span>
                  <span className="text-[10px] text-[#5A616A]">{element.type}</span>
                  <span className={`text-[10px] ${getUsageColor(element.estimatedUsage)}`}>
                    {element.estimatedUsage}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {activeTab === 'issues' && (
          <div className="space-y-3">
            {/* Small touch targets */}
            {report.issues.smallTouchTargets.length > 0 && (
              <div>
                <div className="text-[10px] text-[#FF4D4D] uppercase mb-2">
                  Small Touch Targets ({report.issues.smallTouchTargets.length})
                </div>
                <div className="space-y-1">
                  {report.issues.smallTouchTargets.slice(0, 5).map(el => (
                    <div key={el.id} className="text-xs text-[#E6E8EB]">
                      {el.label}: {el.touchTarget.width.toFixed(0)}×{el.touchTarget.height.toFixed(0)}px
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Deep navigation */}
            {report.issues.deepNavigation.length > 0 && (
              <div>
                <div className="text-[10px] text-[#FFB020] uppercase mb-2">
                  Deep Navigation ({report.issues.deepNavigation.length})
                </div>
                <div className="space-y-1">
                  {report.issues.deepNavigation.slice(0, 5).map(el => (
                    <div key={el.id} className="text-xs text-[#E6E8EB]">
                      {el.label}: Depth {el.clickDepth}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing labels */}
            {report.issues.noLabels.length > 0 && (
              <div>
                <div className="text-[10px] text-[#FFB020] uppercase mb-2">
                  Missing Labels ({report.issues.noLabels.length})
                </div>
                <div className="text-xs text-[#B3B7BE]">
                  Elements without proper aria-label or text content
                </div>
              </div>
            )}

            {/* Keyboard issues */}
            {report.issues.notKeyboardAccessible.length > 0 && (
              <div>
                <div className="text-[10px] text-[#FF4D4D] uppercase mb-2">
                  Not Keyboard Accessible ({report.issues.notKeyboardAccessible.length})
                </div>
                <div className="text-xs text-[#B3B7BE]">
                  Elements that cannot be accessed via keyboard navigation
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="pt-2 border-t border-[#2A2F37]">
              <div className="text-[10px] text-[#B3B7BE] uppercase mb-2">Summary</div>
              <div className="space-y-1 text-xs">
                {report.summary.touchTargetCompliance < 80 && (
                  <div className="text-[#FFB020]">
                    ⚠️ {(100 - report.summary.touchTargetCompliance).toFixed(0)}% of elements have small touch targets
                  </div>
                )}
                {report.summary.averageClickDepth > 1.5 && (
                  <div className="text-[#FFB020]">
                    ⚠️ Average click depth is {report.summary.averageClickDepth.toFixed(1)} (target: &lt;1.5)
                  </div>
                )}
                {report.issues.deepNavigation.length > 0 && (
                  <div className="text-[#FF4D4D]">
                    ⚠️ {report.issues.deepNavigation.length} elements require &gt;2 clicks
                  </div>
                )}
                {report.summary.keyboardAccessibility < 95 && (
                  <div className="text-[#FFB020]">
                    ⚠️ {(100 - report.summary.keyboardAccessibility).toFixed(0)}% lack keyboard access
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
            const reportText = navigationAuditor?.generateDetailedReport() || '';
            navigator.clipboard.writeText(reportText);
          }}
          className="w-full text-xs px-2 py-1 bg-[#1B1F24] text-[#B3B7BE] rounded hover:bg-[#2A2F37]"
        >
          Copy Full Report
        </button>
      </div>

      {/* Element detail modal */}
      {selectedElement && (
        <div
          className="fixed inset-0 bg-black/50 z-[101] flex items-center justify-center"
          onClick={() => setSelectedElement(null)}
        >
          <div
            className="bg-[#14171A] border border-[#2A2F37] rounded-lg p-4 max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-sm font-mono text-[#E6E8EB] mb-3">{selectedElement.label}</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#B3B7BE]">Type:</span>
                <span className="text-[#E6E8EB]">{selectedElement.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#B3B7BE]">Location:</span>
                <span className="text-[#E6E8EB]">{selectedElement.location}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#B3B7BE]">Click Depth:</span>
                <span className={getDepthColor(selectedElement.clickDepth)}>
                  {selectedElement.clickDepth}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#B3B7BE]">Touch Target:</span>
                <span className={`${
                  selectedElement.touchTarget.meetsMinimum ? 'text-[#22C55E]' : 'text-[#FF4D4D]'
                }`}>
                  {selectedElement.touchTarget.width.toFixed(0)}×{selectedElement.touchTarget.height.toFixed(0)}px
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#B3B7BE]">Usage:</span>
                <span className={getUsageColor(selectedElement.estimatedUsage)}>
                  {selectedElement.estimatedUsage} ({selectedElement.usageScore})
                </span>
              </div>
              {selectedElement.path && (
                <div className="flex justify-between">
                  <span className="text-[#B3B7BE]">Path:</span>
                  <span className="text-[#7C5CFF] font-mono">{selectedElement.path}</span>
                </div>
              )}
              <div className="pt-2 border-t border-[#2A2F37]">
                <div className="text-[#B3B7BE] mb-1">Accessibility:</div>
                <div className="space-y-1 ml-2">
                  <div className="flex items-center gap-2">
                    {selectedElement.accessibility.hasLabel || selectedElement.accessibility.hasAriaLabel
                      ? <span className="text-[#22C55E]">✓</span>
                      : <span className="text-[#FF4D4D]">✗</span>}
                    <span className="text-[#B3B7BE]">Has label</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedElement.accessibility.isKeyboardAccessible
                      ? <span className="text-[#22C55E]">✓</span>
                      : <span className="text-[#FF4D4D]">✗</span>}
                    <span className="text-[#B3B7BE]">Keyboard accessible</span>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={() => setSelectedElement(null)}
              className="mt-4 w-full text-xs px-2 py-1 bg-[#7C5CFF] text-white rounded hover:bg-[#7C5CFF]/80"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}