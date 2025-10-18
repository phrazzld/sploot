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
            placeholder={placeholder || 'search your memes...'}
            autoFocus={autoFocus}
            className={`
              w-full h-[56px] pl-6 pr-12 text-base font-mono
              bg-black text-[#E6E8EB] placeholder-[#666666]
              border-2 rounded-md
              focus:outline-none
              ${searchState === 'typing' ? 'border-[var(--color-terminal-green)]' : ''}
              ${searchState === 'loading' ? 'border-[var(--color-terminal-green)]' : ''}
              ${searchState === 'success' ? 'border-[var(--color-terminal-green)]' : ''}
              ${searchState === 'no-results' ? 'border-[var(--color-terminal-yellow)]' : ''}
              ${searchState === 'error' ? 'border-[var(--color-terminal-red)]' : ''}
              ${searchState === 'idle' ? 'border-[#333333] focus:border-[var(--color-terminal-green)]' : ''}
            `}
          />

          {/* Action buttons */}
          <div className="absolute right-3 flex items-center gap-2">
            {/* Clear button - only show when there's text */}
            {query && (
              <button
                onClick={handleClear}
                className="p-1.5 text-[#666666] hover:text-[var(--color-terminal-red)]"
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
          </div>
        </div>
      </form>

      {/* Search history dropdown */}
      {showHistory && history.length > 0 && (
        <div
          ref={dropdownRef}
          className="
            absolute top-full mt-2 w-full
            bg-black border border-[#333333] rounded-md
            overflow-hidden z-50
          "
        >
          {/* History header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#333333]">
            <span className="font-mono text-xs text-[#888888]">recent searches</span>
            <button
              onClick={() => {
                clearHistory();
                setShowHistory(false);
              }}
              className="font-mono text-xs text-[#666666] hover:text-[var(--color-terminal-red)]"
            >
              clear history
            </button>
          </div>

          {/* History items */}
          <div className="max-h-64 overflow-y-auto">
            {history.map((item, index) => (
              <div
                key={item.timestamp}
                className={`
                  flex items-center justify-between px-4 py-3
                  hover:bg-[#0F1012] cursor-pointer group
                  ${selectedIndex === index ? 'bg-[#0F1012] border-l-2 border-[var(--color-terminal-green)]' : ''}
                `}
                onClick={() => handleHistorySelect(item.query)}
              >
                <div className="flex items-center gap-3 flex-1">
                  <svg
                    className="w-4 h-4 text-[#666666] flex-shrink-0"
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
                  <span className="font-mono text-sm text-[#E6E8EB] truncate">{item.query}</span>
                </div>
                <button
                  onClick={(e) => handleHistoryRemove(e, item.query)}
                  className="p-1 text-[#666666] hover:text-[var(--color-terminal-red)] opacity-0 group-hover:opacity-100"
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
