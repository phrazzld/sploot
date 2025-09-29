'use client';

import { useState } from 'react';
import { SearchBarElastic } from '@/components/chrome/search-bar-elastic';
import { cn } from '@/lib/utils';

export default function TestSearchAnimationPage() {
  const [lastAction, setLastAction] = useState<string>('');
  const [searchCount, setSearchCount] = useState(0);
  const [animationSpeed, setAnimationSpeed] = useState<'normal' | 'slow' | 'very-slow'>('normal');

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-[#E6E8EB] p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-4">Search Bar Animation Test</h1>
          <p className="text-[#B3B7BE]">
            Testing cubic-bezier(0.4, 0, 0.2, 1) transition for smooth expansion
          </p>
        </div>

        {/* Animation Speed Control */}
        <div className="p-4 bg-[#14171A] border border-[#2A2F37] rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Animation Speed (for testing)</h2>
          <div className="flex gap-2">
            {(['normal', 'slow', 'very-slow'] as const).map((speed) => (
              <button
                key={speed}
                onClick={() => setAnimationSpeed(speed)}
                className={cn(
                  'px-3 py-1.5 rounded-lg transition-colors',
                  animationSpeed === speed
                    ? 'bg-[#7C5CFF] text-white'
                    : 'bg-[#1B1F24] hover:bg-[#2A2F37] text-[#B3B7BE]'
                )}
              >
                {speed.charAt(0).toUpperCase() + speed.slice(1).replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Different Search Bar Configurations */}
        <div className="space-y-8">
          {/* Default Configuration */}
          <section className="p-6 bg-[#14171A] border border-[#2A2F37] rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Default (200px → 400px)</h2>
            <div
              className={cn(
                'flex justify-center',
                animationSpeed === 'slow' && '[&_>div]:!transition-[width] [&_>div]:!duration-[800ms]',
                animationSpeed === 'very-slow' && '[&_>div]:!transition-[width] [&_>div]:!duration-[2000ms]'
              )}
            >
              <SearchBarElastic
                collapsedWidth={200}
                expandedWidth={400}
                placeholder="Search your memes..."
                onSearch={(query) => {
                  setLastAction(`Searched: "${query}"`);
                  setSearchCount(c => c + 1);
                }}
              />
            </div>
            <p className="text-sm text-[#B3B7BE] mt-4">
              Click or press &quot;/&quot; to focus. Uses cubic-bezier(0.4, 0, 0.2, 1) for smooth acceleration
            </p>
          </section>

          {/* Small to Large */}
          <section className="p-6 bg-[#14171A] border border-[#2A2F37] rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Small to Large (150px → 500px)</h2>
            <div
              className={cn(
                'flex justify-center',
                animationSpeed === 'slow' && '[&_>div]:!transition-[width] [&_>div]:!duration-[800ms]',
                animationSpeed === 'very-slow' && '[&_>div]:!transition-[width] [&_>div]:!duration-[2000ms]'
              )}
            >
              <SearchBarElastic
                collapsedWidth={150}
                expandedWidth={500}
                placeholder="Type to search..."
                onSearch={(query) => {
                  setLastAction(`Searched: "${query}"`);
                  setSearchCount(c => c + 1);
                }}
              />
            </div>
            <p className="text-sm text-[#B3B7BE] mt-4">
              Larger expansion range to test animation smoothness
            </p>
          </section>

          {/* Compact */}
          <section className="p-6 bg-[#14171A] border border-[#2A2F37] rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Compact (180px → 320px)</h2>
            <div
              className={cn(
                'flex justify-center',
                animationSpeed === 'slow' && '[&_>div]:!transition-[width] [&_>div]:!duration-[800ms]',
                animationSpeed === 'very-slow' && '[&_>div]:!transition-[width] [&_>div]:!duration-[2000ms]'
              )}
            >
              <SearchBarElastic
                collapsedWidth={180}
                expandedWidth={320}
                placeholder="Search..."
                onSearch={(query) => {
                  setLastAction(`Searched: "${query}"`);
                  setSearchCount(c => c + 1);
                }}
              />
            </div>
            <p className="text-sm text-[#B3B7BE] mt-4">
              Smaller expansion for constrained spaces
            </p>
          </section>

          {/* No Auto-Collapse */}
          <section className="p-6 bg-[#14171A] border border-[#2A2F37] rounded-lg">
            <h2 className="text-xl font-semibold mb-4">No Auto-Collapse</h2>
            <div
              className={cn(
                'flex justify-center',
                animationSpeed === 'slow' && '[&_>div]:!transition-[width] [&_>div]:!duration-[800ms]',
                animationSpeed === 'very-slow' && '[&_>div]:!transition-[width] [&_>div]:!duration-[2000ms]'
              )}
            >
              <SearchBarElastic
                collapsedWidth={200}
                expandedWidth={400}
                placeholder="Stays expanded..."
                autoCollapse={false}
                onSearch={(query) => {
                  setLastAction(`Searched: "${query}"`);
                  setSearchCount(c => c + 1);
                }}
              />
            </div>
            <p className="text-sm text-[#B3B7BE] mt-4">
              Remains expanded after losing focus
            </p>
          </section>
        </div>

        {/* Stats */}
        <div className="p-4 bg-[#14171A] border border-[#2A2F37] rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Activity</h2>
          <div className="space-y-2 text-sm text-[#B3B7BE]">
            <p>Last Action: <span className="text-[#B6FF6E] font-mono">{lastAction || 'None'}</span></p>
            <p>Search Count: <span className="text-[#7C5CFF]">{searchCount}</span></p>
          </div>
        </div>

        {/* Technical Details */}
        <div className="p-6 bg-[#14171A] border border-[#7C5CFF]/30 rounded-lg">
          <h2 className="text-xl font-semibold text-[#7C5CFF] mb-4">Animation Details</h2>
          <div className="space-y-3 text-[#B3B7BE]">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold text-[#E6E8EB]">Timing Function:</p>
                <code className="text-[#B6FF6E]">cubic-bezier(0.4, 0, 0.2, 1)</code>
              </div>
              <div>
                <p className="font-semibold text-[#E6E8EB]">Duration:</p>
                <code className="text-[#B6FF6E]">180ms</code>
              </div>
              <div>
                <p className="font-semibold text-[#E6E8EB]">Property:</p>
                <code className="text-[#B6FF6E]">width</code>
              </div>
              <div>
                <p className="font-semibold text-[#E6E8EB]">Optimization:</p>
                <code className="text-[#B6FF6E]">will-change: width</code>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-[#2A2F37]">
              <p className="text-sm">
                The cubic-bezier(0.4, 0, 0.2, 1) function creates a smooth ease curve with:
              </p>
              <ul className="mt-2 ml-4 space-y-1 text-sm list-disc">
                <li>Quick initial acceleration (0.4 control point)</li>
                <li>Smooth deceleration at the end</li>
                <li>Natural feeling motion that matches Material Design standards</li>
                <li>No jarring stops or starts</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}