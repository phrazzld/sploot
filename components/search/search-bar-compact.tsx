'use client';

import { useState, useCallback, KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';

interface SearchBarCompactProps {
  placeholder?: string;
  className?: string;
  onSearch?: (query: string) => void;
}

export function SearchBarCompact({
  placeholder = 'Search...',
  className = '',
  onSearch,
}: SearchBarCompactProps) {
  const [query, setQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useRouter();

  const handleSearch = useCallback(async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    if (onSearch) {
      onSearch(trimmedQuery);
    } else {
      router.push(`/app/search?q=${encodeURIComponent(trimmedQuery)}`);
    }

    // Collapse after search
    setIsExpanded(false);
  }, [query, onSearch, router]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    } else if (e.key === 'Escape') {
      setIsExpanded(false);
      setQuery('');
    }
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      // Focus input when expanding
      setTimeout(() => {
        document.getElementById('compact-search-input')?.focus();
      }, 100);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Collapsed state - just icon */}
      {!isExpanded && (
        <button
          onClick={toggleExpanded}
          className="p-3 bg-[#14171A] border border-[#2A2F37] text-[#B3B7BE] hover:text-[#E6E8EB] hover:border-[#7C5CFF]/50 hover:bg-[#1B1F24] transition-all duration-200 group"
          aria-label="Open search"
        >
          <svg
            className="w-5 h-5 group-hover:scale-110 transition-transform duration-200"
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
        </button>
      )}

      {/* Expanded state - input field */}
      {isExpanded && (
        <div className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-200">
          <div className="relative">
            {/* Left accent stripe */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[#7C5CFF]" />

            <input
              id="compact-search-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-64 h-10 pl-4 pr-10 bg-[#14171A] text-[#E6E8EB] placeholder-[#6A6E78] border border-[#2A2F37] focus:outline-none focus:border-[#7C5CFF] focus:ring-1 focus:ring-[#7C5CFF]/20 transition-all duration-200 text-sm"
            />

            {/* Close button */}
            <button
              onClick={() => {
                setIsExpanded(false);
                setQuery('');
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#6A6E78] hover:text-[#B3B7BE] transition-colors duration-200"
              aria-label="Close search"
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
          </div>

          {/* Search button */}
          {query && (
            <button
              onClick={handleSearch}
              className="p-2 bg-[#7C5CFF] text-white hover:bg-[#6B4FE6] active:bg-[#5941CC] transition-all duration-200 animate-in fade-in duration-200"
              aria-label="Search"
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
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}