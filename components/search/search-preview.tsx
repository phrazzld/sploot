'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Asset } from '@/lib/types';

interface SearchPreviewProps {
  query: string;
  results: Asset[];
  loading: boolean;
  selectedIndex: number;
  onSelectResult: (asset: Asset) => void;
  onSeeAll: () => void;
  onClose: () => void;
  onNavigate: (direction: 'up' | 'down') => void;
  totalCount?: number;
}

export function SearchPreview({
  query,
  results,
  loading,
  selectedIndex,
  onSelectResult,
  onSeeAll,
  onClose,
  onNavigate,
  totalCount,
}: SearchPreviewProps) {
  const router = useRouter();
  const previewRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (previewRef.current && !previewRef.current.contains(e.target as Node)) {
        // Check if click is also outside search bar (handled by parent)
        const searchBar = document.querySelector('[data-search-bar]');
        if (!searchBar?.contains(e.target as Node)) {
          onClose();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (!query || (results.length === 0 && !loading)) {
    return null;
  }

  return (
    <div
      ref={previewRef}
      className="absolute top-full left-0 right-0 mt-2 z-50"
    >
      <div className="bg-[#14171A] border border-[#2A2F37] rounded-2xl shadow-2xl overflow-hidden">
        {loading && results.length === 0 ? (
          <div className="p-4 text-center text-[#6A6E78]">
            <div className="inline-flex items-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-sm">Searching...</span>
            </div>
          </div>
        ) : results.length === 0 ? (
          <div className="p-4 text-center text-[#6A6E78] text-sm">
            No results found for "{query}"
          </div>
        ) : (
          <>
            <div className="max-h-[320px] overflow-y-auto">
              {results.map((asset, index) => (
                <div
                  key={asset.id}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  className={`
                    flex items-center gap-3 p-3 cursor-pointer
                    transition-all duration-150
                    ${
                      index === selectedIndex
                        ? 'bg-[#7C5CFF]/10 border-l-2 border-[#7C5CFF]'
                        : 'hover:bg-[#1C1F26] border-l-2 border-transparent'
                    }
                  `}
                  onClick={() => onSelectResult(asset)}
                  onMouseEnter={() => onNavigate(index === selectedIndex ? 'down' : 'up')}
                >
                  {/* Thumbnail */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-[#0A0B0D]">
                    <img
                      src={asset.thumbnailUrl || asset.blobUrl}
                      alt={asset.filename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[#E6E8EB] truncate">
                      {asset.filename}
                    </div>
                    {/* TODO: Add match percentage when available in API response
                    {asset.matchPercentage && (
                      <div className="text-xs text-[#6A6E78]">
                        {Math.round(asset.matchPercentage * 100)}% match
                      </div>
                    )}
                    */}
                  </div>

                  {/* Arrow indicator for selected */}
                  {index === selectedIndex && (
                    <div className="flex-shrink-0 text-[#7C5CFF]">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div
              className="
                border-t border-[#2A2F37] p-3
                flex items-center justify-between
                bg-[#0F1012] hover:bg-[#14171A]
                cursor-pointer transition-colors
              "
              onClick={onSeeAll}
            >
              <span className="text-sm text-[#B3B7BE]">
                {totalCount && totalCount > results.length
                  ? `See all ${totalCount} results`
                  : `See all results`}
              </span>
              <span className="text-xs text-[#6A6E78]">Press Enter</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}