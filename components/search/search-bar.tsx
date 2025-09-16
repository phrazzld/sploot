'use client';

import { useState, useCallback, KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';

interface SearchBarProps {
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  onSearch?: (query: string) => void;
}

export function SearchBar({
  placeholder = 'Search your memes...',
  autoFocus = false,
  className = '',
  onSearch,
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSearch = useCallback(async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    setLoading(true);

    try {
      if (onSearch) {
        // If a custom onSearch handler is provided, use it
        onSearch(trimmedQuery);
      } else {
        // Default behavior: navigate to search page with query
        router.push(`/app/search?q=${encodeURIComponent(trimmedQuery)}`);
      }
    } finally {
      setLoading(false);
    }
  }, [query, onSearch, router]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !loading) {
      handleSearch();
    }
  };

  const handleClear = () => {
    setQuery('');
    if (onSearch) {
      onSearch('');
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search bar container with pill shape and left stripe */}
      <div className="relative">
        {/* Left accent stripe */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#7C5CFF] rounded-full" />

        <div className="relative flex items-center">
          {/* Search icon */}
          <div className="absolute left-6 pointer-events-none text-[#B3B7BE]">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Input field */}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
            disabled={loading}
            className="
              w-full h-[52px] pl-14 pr-24
              bg-[#14171A] text-[#E6E8EB] placeholder-[#6A6E78]
              rounded-full border border-[#2A2F37]
              focus:outline-none focus:border-[#7C5CFF]
              focus:ring-2 focus:ring-[#7C5CFF]/20
              focus:shadow-[inset_0_0_12px_rgba(124,92,255,0.1)]
              transition-all duration-200
              disabled:opacity-60 disabled:cursor-not-allowed
            "
          />

          {/* Action buttons */}
          <div className="absolute right-3 flex items-center gap-2">
            {/* Clear button - only show when there's text */}
            {query && !loading && (
              <button
                onClick={handleClear}
                className="
                  p-1.5 text-[#6A6E78] hover:text-[#B3B7BE]
                  transition-colors duration-200
                "
                aria-label="Clear search"
              >
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}

            {/* Search button / Loading indicator */}
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="
                px-4 py-1.5
                bg-[#7C5CFF] text-white text-sm font-medium
                rounded-full
                hover:bg-[#6B4FE6] active:bg-[#5941CC]
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200
                flex items-center gap-2
              "
              aria-label={loading ? 'Searching...' : 'Search'}
            >
              {loading ? (
                <>
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
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span className="hidden sm:inline">Searching...</span>
                </>
              ) : (
                <span>Search</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Optional keyboard hint */}
      <div className="absolute -bottom-6 left-14 text-xs text-[#6A6E78]">
        Press <kbd className="px-1.5 py-0.5 bg-[#1B1F24] rounded text-[#B3B7BE]">Enter</kbd> to search
      </div>
    </div>
  );
}