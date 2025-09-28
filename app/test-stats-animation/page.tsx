'use client';

import { useState } from 'react';
import { StatsDisplay, StatsCompact } from '@/components/chrome/stats-display';
import { cn } from '@/lib/utils';

export default function TestStatsAnimationPage() {
  const [totalAssets, setTotalAssets] = useState(134);
  const [favoriteCount, setFavoriteCount] = useState(2);
  const [totalSizeBytes, setTotalSizeBytes] = useState(9.9 * 1024 * 1024); // 9.9 MB

  const randomizeStats = () => {
    setTotalAssets(Math.floor(Math.random() * 10000) + 10);
    setFavoriteCount(Math.floor(Math.random() * 100));
    setTotalSizeBytes(Math.random() * 1024 * 1024 * 1024); // Up to 1GB
  };

  const incrementStats = () => {
    setTotalAssets(prev => prev + Math.floor(Math.random() * 50) + 1);
    setFavoriteCount(prev => prev + Math.floor(Math.random() * 5) + 1);
    setTotalSizeBytes(prev => prev + Math.random() * 50 * 1024 * 1024); // Add up to 50MB
  };

  const decrementStats = () => {
    setTotalAssets(prev => Math.max(0, prev - Math.floor(Math.random() * 30) + 1));
    setFavoriteCount(prev => Math.max(0, prev - Math.floor(Math.random() * 3) + 1));
    setTotalSizeBytes(prev => Math.max(0, prev - Math.random() * 30 * 1024 * 1024)); // Remove up to 30MB
  };

  const presetValues = [
    { assets: 0, favorites: 0, size: 0 },
    { assets: 42, favorites: 7, size: 1.5 * 1024 * 1024 },
    { assets: 134, favorites: 2, size: 9.9 * 1024 * 1024 },
    { assets: 1337, favorites: 42, size: 256 * 1024 * 1024 },
    { assets: 9999, favorites: 999, size: 2.5 * 1024 * 1024 * 1024 },
  ];

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-[#E6E8EB] p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-4">Stats Animation Test</h1>
          <p className="text-[#B3B7BE]">
            Testing 300ms number morphing animation for footer stats
          </p>
        </div>

        {/* Current Values Display */}
        <div className="p-4 bg-[#14171A] border border-[#2A2F37] rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Current Values</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-[#B3B7BE]">Total Assets:</p>
              <p className="text-xl font-mono text-[#7C5CFF]">{totalAssets.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[#B3B7BE]">Favorites:</p>
              <p className="text-xl font-mono text-[#B6FF6E]">{favoriteCount.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[#B3B7BE]">Size:</p>
              <p className="text-xl font-mono text-[#BAFF39]">
                {(totalSizeBytes / (1024 * 1024)).toFixed(1)} MB
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="p-4 bg-[#14171A] border border-[#2A2F37] rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Controls</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={randomizeStats}
              className="px-4 py-2 bg-[#7C5CFF] hover:bg-[#6B4EE6] text-white rounded-lg transition-colors"
            >
              Randomize All
            </button>
            <button
              onClick={incrementStats}
              className="px-4 py-2 bg-[#1B1F24] hover:bg-[#2A2F37] text-[#B3B7BE] rounded-lg transition-colors"
            >
              Increment (+)
            </button>
            <button
              onClick={decrementStats}
              className="px-4 py-2 bg-[#1B1F24] hover:bg-[#2A2F37] text-[#B3B7BE] rounded-lg transition-colors"
            >
              Decrement (-)
            </button>
          </div>

          <div className="mt-4">
            <p className="text-sm text-[#B3B7BE] mb-2">Preset Values:</p>
            <div className="flex flex-wrap gap-2">
              {presetValues.map((preset, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setTotalAssets(preset.assets);
                    setFavoriteCount(preset.favorites);
                    setTotalSizeBytes(preset.size);
                  }}
                  className="px-3 py-1.5 bg-[#1B1F24] hover:bg-[#2A2F37] text-[#B3B7BE] text-sm rounded-lg transition-colors"
                >
                  {index === 0 ? 'Empty' :
                   index === 1 ? 'Small' :
                   index === 2 ? 'Default' :
                   index === 3 ? 'Medium' : 'Large'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats Display Components */}
        <div className="space-y-8">
          <section className="p-6 bg-[#14171A] border border-[#2A2F37] rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Full Stats Display</h2>
            <p className="text-sm text-[#B3B7BE] mb-6">With labels, used in footer</p>
            <div className="flex justify-center py-4 bg-[#0A0B0D] rounded-lg">
              <StatsDisplay
                totalAssets={totalAssets}
                favoriteCount={favoriteCount}
                totalSizeBytes={totalSizeBytes}
              />
            </div>
          </section>

          <section className="p-6 bg-[#14171A] border border-[#2A2F37] rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Compact Stats Display</h2>
            <p className="text-sm text-[#B3B7BE] mb-6">Without labels, for mobile</p>
            <div className="flex justify-center py-4 bg-[#0A0B0D] rounded-lg">
              <StatsCompact
                totalAssets={totalAssets}
                favoriteCount={favoriteCount}
                totalSizeBytes={totalSizeBytes}
              />
            </div>
          </section>
        </div>

        {/* Technical Details */}
        <div className="p-6 bg-[#14171A] border border-[#7C5CFF]/30 rounded-lg">
          <h2 className="text-xl font-semibold text-[#7C5CFF] mb-4">Animation Details</h2>
          <div className="space-y-3 text-[#B3B7BE]">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold text-[#E6E8EB]">Duration:</p>
                <code className="text-[#B6FF6E]">300ms</code>
              </div>
              <div>
                <p className="font-semibold text-[#E6E8EB]">Animation Method:</p>
                <code className="text-[#B6FF6E]">requestAnimationFrame</code>
              </div>
              <div>
                <p className="font-semibold text-[#E6E8EB]">Easing:</p>
                <code className="text-[#B6FF6E]">ease-in-out quadratic</code>
              </div>
              <div>
                <p className="font-semibold text-[#E6E8EB]">Frame Rate:</p>
                <code className="text-[#B6FF6E]">60 FPS</code>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-[#2A2F37]">
              <p className="text-sm mb-2">Features:</p>
              <ul className="ml-4 space-y-1 text-sm list-disc">
                <li>Smooth morphing between old and new values</li>
                <li>Thousands separator for large numbers</li>
                <li>Unit transitions (KB → MB → GB)</li>
                <li>Optimized with requestAnimationFrame</li>
                <li>Cancels in-progress animations on rapid updates</li>
                <li>Custom easing function for natural motion</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}