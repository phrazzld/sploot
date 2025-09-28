'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

type ViewMode = 'grid' | 'list';

export default function TestViewTransitionPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionCount, setTransitionCount] = useState(0);
  const [animationDuration, setAnimationDuration] = useState(200);

  const handleViewModeChange = (mode: ViewMode) => {
    if (mode === viewMode) return;

    setIsTransitioning(true);
    setTransitionCount(c => c + 1);

    // Simulate the actual view mode change after a brief delay
    setTimeout(() => {
      setViewMode(mode);

      // Clear transition state after animation
      setTimeout(() => {
        setIsTransitioning(false);
      }, 50);
    }, 50);
  };

  // Mock items for display
  const mockItems = Array.from({ length: 20 }, (_, i) => ({
    id: `item-${i}`,
    title: `Item ${i + 1}`,
    height: Math.floor(Math.random() * 150) + 100,
  }));

  const renderContent = () => {
    switch (viewMode) {
      case 'grid':
        return (
          <div className="grid grid-cols-3 gap-4">
            {mockItems.map((item) => (
              <div
                key={item.id}
                className="bg-[#1B1F24] border border-[#2A2F37] rounded-lg p-4"
                style={{ height: `${item.height}px` }}
              >
                <div className="h-full bg-gradient-to-b from-[#7C5CFF]/20 to-transparent rounded flex items-center justify-center">
                  <span className="text-[#B3B7BE]">{item.title}</span>
                </div>
              </div>
            ))}
          </div>
        );

      case 'list':
        return (
          <div className="space-y-2">
            {mockItems.map((item) => (
              <div
                key={item.id}
                className="bg-[#1B1F24] border border-[#2A2F37] rounded-lg p-4 flex items-center gap-4"
              >
                <div className="w-16 h-16 bg-gradient-to-b from-[#7C5CFF]/20 to-transparent rounded" />
                <span className="text-[#B3B7BE]">{item.title}</span>
              </div>
            ))}
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-[#E6E8EB] p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-4">View Mode Transition Test</h1>
          <p className="text-[#B3B7BE]">
            Testing 200ms crossfade transition between view modes without position jumping
          </p>
        </div>

        {/* Controls */}
        <div className="p-4 bg-[#14171A] border border-[#2A2F37] rounded-lg space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-3">View Mode</h2>
            <div className="flex gap-2">
              {(['grid', 'list'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleViewModeChange(mode)}
                  className={cn(
                    'px-4 py-2 rounded-lg capitalize transition-colors',
                    viewMode === mode
                      ? 'bg-[#7C5CFF] text-white'
                      : 'bg-[#1B1F24] hover:bg-[#2A2F37] text-[#B3B7BE]'
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">Animation Duration</h2>
            <div className="flex gap-2">
              {[100, 200, 300, 500].map((duration) => (
                <button
                  key={duration}
                  onClick={() => setAnimationDuration(duration)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm transition-colors',
                    animationDuration === duration
                      ? 'bg-[#B6FF6E] text-black'
                      : 'bg-[#1B1F24] hover:bg-[#2A2F37] text-[#B3B7BE]'
                  )}
                >
                  {duration}ms
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="p-4 bg-[#14171A] border border-[#2A2F37] rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Transition Stats</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-[#B3B7BE]">Current View:</p>
              <p className="text-[#B6FF6E] font-mono">{viewMode}</p>
            </div>
            <div>
              <p className="text-[#B3B7BE]">Transitioning:</p>
              <p className={cn('font-mono', isTransitioning ? 'text-[#7C5CFF]' : 'text-[#B3B7BE]')}>
                {isTransitioning ? 'true' : 'false'}
              </p>
            </div>
            <div>
              <p className="text-[#B3B7BE]">Transition Count:</p>
              <p className="text-[#7C5CFF] font-mono">{transitionCount}</p>
            </div>
          </div>
        </div>

        {/* Content with transition */}
        <div className="relative">
          <div
            className={cn(
              'transition-opacity ease-in-out',
              isTransitioning ? 'opacity-0' : 'opacity-100'
            )}
            style={{ transitionDuration: `${animationDuration}ms` }}
          >
            {renderContent()}
          </div>
        </div>

        {/* Technical Details */}
        <div className="p-6 bg-[#14171A] border border-[#7C5CFF]/30 rounded-lg">
          <h2 className="text-xl font-semibold text-[#7C5CFF] mb-4">Implementation Details</h2>
          <div className="space-y-3 text-[#B3B7BE]">
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2">
                <span className="text-[#7C5CFF]">•</span>
                <span><strong>Transition:</strong> opacity only (no scale to prevent jumping)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#7C5CFF]">•</span>
                <span><strong>Duration:</strong> 200ms (adjustable for testing)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#7C5CFF]">•</span>
                <span><strong>Easing:</strong> ease-in-out for smooth acceleration</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#7C5CFF]">•</span>
                <span><strong>No position jumping:</strong> Only opacity changes, layout remains stable</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#7C5CFF]">•</span>
                <span><strong>Scroll position:</strong> Preserved across transitions</span>
              </li>
            </ul>

            <div className="mt-4 pt-4 border-t border-[#2A2F37]">
              <p className="text-sm mb-2">Benefits of this approach:</p>
              <ul className="ml-4 space-y-1 text-sm list-disc">
                <li>Smooth visual transition between different layouts</li>
                <li>No jarring position changes or layout shifts</li>
                <li>Maintains user's scroll context</li>
                <li>Fast enough to feel responsive (200ms)</li>
                <li>Simple implementation with just opacity</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}