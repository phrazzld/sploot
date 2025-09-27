'use client';

import { useState, useEffect } from 'react';
import { useFilter } from '@/contexts/filter-context';
import { FilterChips } from '@/components/chrome/filter-chips';
import { useSearchParams } from 'next/navigation';

export default function TestFilterContext() {
  const searchParams = useSearchParams();
  const {
    filterType,
    tagId,
    tagName,
    isFavoritesOnly,
    isRecentFilter,
    hasActiveFilters,
    setFilterType,
    setTagFilter,
    toggleFavorites,
    clearAllFilters,
    clearTagFilter,
  } = useFilter();

  const [changeCount, setChangeCount] = useState(0);
  const [lastAction, setLastAction] = useState<string>('');

  // Monitor URL params
  const urlFavorite = searchParams.get('favorite');
  const urlFilter = searchParams.get('filter');
  const urlTagId = searchParams.get('tagId');

  const handleFilterChange = (type: 'all' | 'favorites' | 'recent') => {
    setFilterType(type);
    setChangeCount(prev => prev + 1);
    setLastAction(`Set filter to ${type}`);
  };

  const handleTagChange = () => {
    const testTagId = 'test-tag-123';
    const testTagName = 'Test Tag';
    setTagFilter(tagId === testTagId ? null : testTagId, testTagName);
    setChangeCount(prev => prev + 1);
    setLastAction(tagId === testTagId ? 'Cleared tag filter' : 'Set tag filter');
  };

  const handleToggleFavorites = () => {
    toggleFavorites();
    setChangeCount(prev => prev + 1);
    setLastAction('Toggled favorites');
  };

  const handleClearAll = () => {
    clearAllFilters();
    setChangeCount(prev => prev + 1);
    setLastAction('Cleared all filters');
  };

  return (
    <div className="min-h-screen bg-[#0B0C0E] p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white">Filter Context Test</h1>

        {/* Current State */}
        <div className="bg-[#14171A] rounded-lg border border-[#2A2F37] p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Current Filter State</h2>
          <div className="space-y-2 text-sm text-[#B3B7BE]">
            <p>Filter Type: <span className="text-[#7C5CFF]">{filterType}</span></p>
            <p>Tag ID: <span className="text-[#7C5CFF]">{tagId || 'none'}</span></p>
            <p>Tag Name: <span className="text-[#7C5CFF]">{tagName || 'none'}</span></p>
            <p>Is Favorites Only: <span className="text-[#7C5CFF]">{String(isFavoritesOnly)}</span></p>
            <p>Is Recent Filter: <span className="text-[#7C5CFF]">{String(isRecentFilter)}</span></p>
            <p>Has Active Filters: <span className="text-[#7C5CFF]">{String(hasActiveFilters)}</span></p>
            <p>Change Count: <span className="text-[#B6FF6E]">{changeCount}</span></p>
            <p>Last Action: <span className="text-[#B6FF6E]">{lastAction || 'None'}</span></p>
          </div>
        </div>

        {/* URL Params */}
        <div className="bg-[#14171A] rounded-lg border border-[#2A2F37] p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">URL Parameters</h2>
          <div className="space-y-2 text-sm font-mono text-[#B3B7BE]">
            <p>?favorite={urlFavorite || 'null'}</p>
            <p>?filter={urlFilter || 'null'}</p>
            <p>?tagId={urlTagId || 'null'}</p>
          </div>
          <p className="text-xs text-[#888C96]">
            Should automatically sync with filter state
          </p>
        </div>

        {/* Filter Chips Component */}
        <div className="bg-[#14171A] rounded-lg border border-[#2A2F37] p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">FilterChips Component</h2>
          <FilterChips
            activeFilter={filterType}
            onFilterChange={handleFilterChange}
            size="md"
            showLabels={true}
          />
          <p className="text-xs text-[#888C96]">
            Uses same context, should stay in sync
          </p>
        </div>

        {/* Manual Controls */}
        <div className="bg-[#14171A] rounded-lg border border-[#2A2F37] p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Manual Controls</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleFilterChange('all')}
              className={`px-4 py-2 rounded text-sm transition-all ${
                filterType === 'all'
                  ? 'bg-[#7C5CFF] text-white'
                  : 'bg-[#1B1F24] text-[#B3B7BE] hover:bg-[#2A2F37]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => handleFilterChange('favorites')}
              className={`px-4 py-2 rounded text-sm transition-all ${
                filterType === 'favorites'
                  ? 'bg-[#7C5CFF] text-white'
                  : 'bg-[#1B1F24] text-[#B3B7BE] hover:bg-[#2A2F37]'
              }`}
            >
              Favorites
            </button>
            <button
              onClick={() => handleFilterChange('recent')}
              className={`px-4 py-2 rounded text-sm transition-all ${
                filterType === 'recent'
                  ? 'bg-[#7C5CFF] text-white'
                  : 'bg-[#1B1F24] text-[#B3B7BE] hover:bg-[#2A2F37]'
              }`}
            >
              Recent
            </button>
          </div>
        </div>

        {/* Tag Filter Test */}
        <div className="bg-[#14171A] rounded-lg border border-[#2A2F37] p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Tag Filter</h2>
          <button
            onClick={handleTagChange}
            className="px-6 py-3 bg-[#7C5CFF] text-white rounded-lg hover:bg-[#6b4de6] transition-all"
          >
            {tagId ? 'Clear Tag Filter' : 'Set Test Tag'}
          </button>
        </div>

        {/* Actions */}
        <div className="bg-[#14171A] rounded-lg border border-[#2A2F37] p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Actions</h2>
          <div className="flex gap-2">
            <button
              onClick={handleToggleFavorites}
              className="px-6 py-3 bg-[#B6FF6E] text-black rounded-lg hover:bg-[#a8ef60] transition-all"
            >
              Toggle Favorites
            </button>
            <button
              onClick={handleClearAll}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
            >
              Clear All Filters
            </button>
            <button
              onClick={() => clearTagFilter()}
              className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all"
              disabled={!tagId}
            >
              Clear Tag Only
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-[#14171A] rounded-lg border border-[#2A2F37] p-6 space-y-2">
          <h2 className="text-lg font-semibold text-white">Test Instructions</h2>
          <ul className="text-sm text-[#B3B7BE] space-y-1 list-disc list-inside">
            <li>Try changing filters using both manual controls and FilterChips</li>
            <li>Verify URL params update automatically</li>
            <li>Test tag filter functionality</li>
            <li>Use Toggle Favorites action to test quick switching</li>
            <li>Refresh page to verify filter persistence via URL</li>
            <li>All components should stay synchronized</li>
          </ul>
        </div>
      </div>
    </div>
  );
}