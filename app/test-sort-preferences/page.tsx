'use client';

import { useState, useEffect } from 'react';
import { useSortPreferences } from '@/hooks/use-sort-preferences';
import type { SortOption, SortDirection } from '@/components/chrome/sort-dropdown';

export default function TestSortPreferences() {
  const { sortBy, direction, handleSortChange, resetPreferences, isLoading } = useSortPreferences();
  const [changeCount, setChangeCount] = useState(0);
  const [savedValue, setSavedValue] = useState<string>('');
  const [lastChangeTime, setLastChangeTime] = useState<number>(0);

  // Monitor localStorage directly
  useEffect(() => {
    const interval = setInterval(() => {
      const stored = localStorage.getItem('sploot-sort-preferences');
      setSavedValue(stored || 'null');
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const handleTestChange = (newSort: SortOption, newDirection: SortDirection) => {
    const now = Date.now();
    setChangeCount(prev => prev + 1);
    setLastChangeTime(now);
    handleSortChange(newSort, newDirection);
  };

  const options: SortOption[] = ['recent', 'date', 'size', 'name'];
  const directions: SortDirection[] = ['asc', 'desc'];

  return (
    <div className="min-h-screen bg-[#0B0C0E] p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white">Sort Preferences Test</h1>

        {/* Current State */}
        <div className="bg-[#14171A] rounded-lg border border-[#2A2F37] p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Current State</h2>
          <div className="space-y-2 text-sm text-[#B3B7BE]">
            <p>Loading: {String(isLoading)}</p>
            <p>Sort By: {sortBy}</p>
            <p>Direction: {direction}</p>
            <p>Change Count: {changeCount}</p>
            <p>Last Change: {lastChangeTime ? new Date(lastChangeTime).toLocaleTimeString() : 'Never'}</p>
          </div>
        </div>

        {/* localStorage Value (100ms updates) */}
        <div className="bg-[#14171A] rounded-lg border border-[#2A2F37] p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">localStorage (100ms debounced)</h2>
          <pre className="text-xs text-[#B3B7BE] font-mono overflow-auto">
            {savedValue ? JSON.stringify(JSON.parse(savedValue), null, 2) : 'null'}
          </pre>
          <p className="text-xs text-[#888C96]">
            Should update ~100ms after changes stop
          </p>
        </div>

        {/* Sort Options */}
        <div className="bg-[#14171A] rounded-lg border border-[#2A2F37] p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Sort Options</h2>
          <div className="grid grid-cols-4 gap-2">
            {options.map(option => (
              <button
                key={option}
                onClick={() => handleTestChange(option, direction)}
                className={`
                  px-4 py-2 rounded text-sm transition-all
                  ${sortBy === option
                    ? 'bg-[#7C5CFF] text-white'
                    : 'bg-[#1B1F24] text-[#B3B7BE] hover:bg-[#2A2F37]'
                  }
                `}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {/* Direction Options */}
        <div className="bg-[#14171A] rounded-lg border border-[#2A2F37] p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Sort Direction</h2>
          <div className="grid grid-cols-2 gap-2">
            {directions.map(dir => (
              <button
                key={dir}
                onClick={() => handleTestChange(sortBy, dir)}
                className={`
                  px-4 py-2 rounded text-sm transition-all
                  ${direction === dir
                    ? 'bg-[#7C5CFF] text-white'
                    : 'bg-[#1B1F24] text-[#B3B7BE] hover:bg-[#2A2F37]'
                  }
                `}
              >
                {dir === 'asc' ? 'Ascending ↑' : 'Descending ↓'}
              </button>
            ))}
          </div>
        </div>

        {/* Rapid Fire Test */}
        <div className="bg-[#14171A] rounded-lg border border-[#2A2F37] p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Rapid Fire Test</h2>
          <p className="text-sm text-[#B3B7BE] mb-4">
            Click rapidly to test debouncing. localStorage should only update after you stop.
          </p>
          <button
            onClick={() => {
              const randomOption = options[Math.floor(Math.random() * options.length)];
              const randomDirection = directions[Math.floor(Math.random() * directions.length)];
              handleTestChange(randomOption, randomDirection);
            }}
            className="px-6 py-3 bg-[#B6FF6E] text-black rounded-lg hover:bg-[#a8ef60] transition-all"
          >
            Random Change
          </button>
        </div>

        {/* Reset */}
        <div className="bg-[#14171A] rounded-lg border border-[#2A2F37] p-6">
          <button
            onClick={resetPreferences}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
          >
            Reset to Defaults
          </button>
        </div>

        {/* Instructions */}
        <div className="bg-[#14171A] rounded-lg border border-[#2A2F37] p-6 space-y-2">
          <h2 className="text-lg font-semibold text-white">Test Instructions</h2>
          <ul className="text-sm text-[#B3B7BE] space-y-1 list-disc list-inside">
            <li>Try changing sort options and direction</li>
            <li>Watch localStorage update ~100ms after changes stop</li>
            <li>Refresh the page to verify persistence</li>
            <li>Use Rapid Fire to test debouncing</li>
            <li>Open browser console to see any errors</li>
          </ul>
        </div>
      </div>
    </div>
  );
}