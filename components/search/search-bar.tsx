'use client';

import { useState, useCallback, KeyboardEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDebounce } from '@/hooks/use-debounce';

interface SearchBarProps {
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  onSearch?: (query: string, options?: { updateUrl?: boolean }) => void;
  inline?: boolean;
  initialQuery?: string;
}

export function SearchBar({
  placeholder = 'search your memes...',
  autoFocus = false,
  className = '',
  onSearch,
  inline = false,
  initialQuery = '',
}: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Debounce the search query with 600ms delay for stability
  const debouncedQuery = useDebounce(query, 600);

  // Keep local state in sync with parent-controlled initial query
  useEffect(() => {
    // Only update if actually different to prevent loops
    if (query !== initialQuery) {
      setQuery(initialQuery);
    }
  }, [initialQuery, query]); // Include both to satisfy linter, but guard prevents loops

  // Handle search when debounced query changes
  useEffect(() => {
    const trimmedQuery = debouncedQuery.trim();

    // Always call onSearch if provided, but without updating URL during typing
    if (onSearch) {
      setLoading(trimmedQuery.length > 0);
      // Call with updateUrl: false to prevent URL changes during typing
      onSearch(trimmedQuery, { updateUrl: false });
      // Loading state will be cleared when results arrive
      if (trimmedQuery) {
        setTimeout(() => setLoading(false), 500);
      } else {
        setLoading(false);
      }
    } else if (trimmedQuery && !inline) {
      // Default behavior: navigate to search page
      router.push(`/app/search?q=${encodeURIComponent(trimmedQuery)}`);
    }
  }, [debouncedQuery, onSearch, router, inline]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Add ESC key handler to clear search
    if (e.key === 'Escape') {
      setQuery('');
      if (onSearch) {
        onSearch('', { updateUrl: false });
      }
      // Blur the input to remove focus
      e.currentTarget.blur();
    }
    // Keep Enter key for immediate search (skips debounce)
    else if (e.key === 'Enter' && !loading && query.trim()) {
      const trimmedQuery = query.trim();
      setLoading(true);

      if (onSearch) {
        // Pass updateUrl: true on Enter to explicitly trigger URL update
        onSearch(trimmedQuery, { updateUrl: true });
      } else if (!inline) {
        router.push(`/app/search?q=${encodeURIComponent(trimmedQuery)}`);
      }

      // Loading will be set to false by the useEffect
    }
  };

  const handleClear = () => {
    setQuery('');
    if (onSearch) {
      onSearch('', { updateUrl: false });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuery = query.trim();
    if (trimmedQuery && onSearch && !loading) {
      setLoading(true);
      // Pass updateUrl: true on form submission
      onSearch(trimmedQuery, { updateUrl: true });
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search bar container with pill shape */}
      <form onSubmit={handleSubmit} className="relative">
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
            onChange={(e) => {
              // Prevent changes during active search to avoid race conditions
              if (!loading) {
                setQuery(e.target.value);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className="
              w-full h-[52px] pl-14 pr-20
              bg-[#14171A] text-[#E6E8EB] placeholder-[#6A6E78]
              rounded-full border border-[#2A2F37]
              focus:outline-none focus:border-[#7C5CFF]
              focus:ring-2 focus:ring-[#7C5CFF]/20
              focus:shadow-[inset_0_0_12px_rgba(124,92,255,0.1)]
              transition-all duration-200
            "
          />

          {/* Action buttons */}
          <div className="absolute right-3 flex items-center gap-2">
            {/* Loading indicator */}
            {loading && (
              <div className="p-1.5 text-[#7C5CFF]">
                <svg
                  className="animate-spin h-5 w-5"
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
              </div>
            )}

            {/* Clear button - only show when there's text and not loading */}
            {query && !loading && (
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
          </div>
        </div>
      </form>

      {/* Hint text for keyboard shortcuts */}
      <div className="absolute -bottom-6 left-0 text-xs text-[#6A6E78] opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="hidden sm:inline">esc to clear • enter for instant search</span>
      </div>
    </div>
  );
}
