'use client';

import { useState, useCallback, KeyboardEvent, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchHistory } from '@/hooks/use-search-history';

interface SearchBarProps {
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  onSearch?: (searchCommand: { query: string; timestamp: number; updateUrl?: boolean }) => void;
  inline?: boolean;
  initialQuery?: string;
  searchState?: 'idle' | 'typing' | 'loading' | 'success' | 'no-results' | 'error';
  resultCount?: number;
}

export function SearchBar({
  placeholder = 'search your memes...',
  autoFocus = false,
  className = '',
  onSearch,
  inline = false,
  initialQuery = '',
  searchState = 'idle',
  resultCount = 0,
}: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { history, addToHistory, removeFromHistory, clearHistory } = useSearchHistory();

  // Sync with initialQuery only when it changes externally (e.g., from URL navigation)
  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]); // Only depend on initialQuery, not query

  // Handle clicks outside dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowHistory(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Navigate through history with arrow keys
    if (showHistory && history.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < history.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        const selected = history[selectedIndex];
        setQuery(selected.query);
        setShowHistory(false);
        setSelectedIndex(-1);
        handleSubmit(selected.query, true);
        return;
      }
    }

    // Add ESC key handler to clear search or close dropdown
    if (e.key === 'Escape') {
      if (showHistory) {
        setShowHistory(false);
        setSelectedIndex(-1);
      } else {
        // Clear search input
        setQuery('');
        // Blur the input to remove focus
        e.currentTarget.blur();
      }
    }
    // Enter key triggers search
    else if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleClear = () => {
    setQuery('');
    // Clear search results
    if (onSearch) {
      onSearch({
        query: '',
        timestamp: Date.now(),
        updateUrl: false
      });
    }
  };

  const handleSubmit = useCallback((overrideQuery?: string, updateUrl = true) => {
    const searchQuery = overrideQuery || query;
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery) {
      // Add to search history
      addToHistory(trimmedQuery);
      setShowHistory(false);
      setSelectedIndex(-1);

      if (onSearch) {
        // Send search command with timestamp and updateUrl flag
        onSearch({
          query: trimmedQuery,
          timestamp: Date.now(),
          updateUrl
        });
      } else if (!inline) {
        // Default behavior: navigate to search page
        router.push(`/app/search?q=${encodeURIComponent(trimmedQuery)}`);
      }
    }
  }, [query, onSearch, inline, router, addToHistory]);

  const handleHistorySelect = (historyQuery: string) => {
    setQuery(historyQuery);
    setShowHistory(false);
    setSelectedIndex(-1);
    handleSubmit(historyQuery, true);
  };

  const handleHistoryRemove = (e: React.MouseEvent, historyQuery: string) => {
    e.stopPropagation();
    removeFromHistory(historyQuery);
  };

  return (
    <div className={`relative ${className}`} data-search-bar>
      {/* Search bar container with pill shape */}
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="relative">
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
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              // Trigger search while typing without updating URL
              if (onSearch) {
                onSearch({
                  query: e.target.value.trim(),
                  timestamp: Date.now(),
                  updateUrl: false
                });
              }
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (!query && history.length > 0) {
                setShowHistory(true);
              }
            }}
            placeholder={placeholder || 'search your memes... (press enter)'}
            autoFocus={autoFocus}
            className={`
              w-full h-[52px] pl-14 pr-24
              bg-[#14171A] text-[#E6E8EB] placeholder-[#6A6E78]
              rounded-full border
              focus:outline-none focus:ring-2
              transition-all duration-300
              ${searchState === 'typing' ? 'border-[#7C5CFF] ring-2 ring-[#7C5CFF]/20' : ''}
              ${searchState === 'loading' ? 'border-[#7C5CFF] animate-pulse' : ''}
              ${searchState === 'success' ? 'border-[#22C55E]' : ''}
              ${searchState === 'no-results' ? 'border-[#FFC107]' : ''}
              ${searchState === 'error' ? 'border-[#EF4444]' : ''}
              ${searchState === 'idle' ? 'border-[#2A2F37] focus:border-[#7C5CFF] focus:ring-[#7C5CFF]/20' : ''}
              focus:shadow-[inset_0_0_12px_rgba(124,92,255,0.1)]
            `}
          />

          {/* Action buttons */}
          <div className="absolute right-3 flex items-center gap-2">
            {/* Clear button - only show when there's text */}
            {query && (
              <button
                onClick={handleClear}
                className="
                  p-1.5 text-[#6A6E78] hover:text-[#B3B7BE]
                  transition-colors duration-200
                "
                aria-label="clear search"
                title="clear search (esc)"
              >
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}

            {/* Submit button - always visible */}
            <button
              type="submit"
              className="
                p-2 text-[#7C5CFF] hover:text-[#8F72FF]
                hover:bg-[#7C5CFF]/10 rounded-full
                transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]/30
              "
              aria-label="search"
              title="search (enter)"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>
          </div>
        </div>
      </form>

      {/* Search history dropdown */}
      {showHistory && history.length > 0 && (
        <div
          ref={dropdownRef}
          className="
            absolute top-full mt-2 w-full
            bg-[#14171A] border border-[#2A2F37] rounded-2xl
            shadow-xl overflow-hidden z-50
            animate-in fade-in-0 slide-in-from-top-1 duration-200
          "
        >
          {/* History header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2F37]">
            <span className="text-xs text-[#6A6E78] font-medium">Recent Searches</span>
            <button
              onClick={() => {
                clearHistory();
                setShowHistory(false);
              }}
              className="text-xs text-[#6A6E78] hover:text-[#B3B7BE] transition-colors"
            >
              Clear history
            </button>
          </div>

          {/* History items */}
          <div className="max-h-64 overflow-y-auto">
            {history.map((item, index) => (
              <div
                key={item.timestamp}
                className={`
                  flex items-center justify-between px-4 py-3
                  hover:bg-[#1F2328] cursor-pointer transition-colors
                  ${selectedIndex === index ? 'bg-[#1F2328]' : ''}
                `}
                onClick={() => handleHistorySelect(item.query)}
              >
                <div className="flex items-center gap-3 flex-1">
                  <svg
                    className="w-4 h-4 text-[#6A6E78] flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-[#E6E8EB] text-sm truncate">{item.query}</span>
                </div>
                <button
                  onClick={(e) => handleHistoryRemove(e, item.query)}
                  className="
                    p-1 text-[#6A6E78] hover:text-[#B3B7BE]
                    opacity-0 group-hover:opacity-100 transition-all
                  "
                  aria-label="Remove from history"
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
