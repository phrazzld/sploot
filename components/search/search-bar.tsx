'use client';

import { useState, useCallback, KeyboardEvent, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useDebounce } from '@/hooks/use-debounce';
import { useSearchPreview } from '@/hooks/use-search-preview';
import { SearchPreview } from './search-preview';
import type { Asset } from '@/lib/types';

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

  // Preview state management
  const [showPreview, setShowPreview] = useState(false);
  const [previewResults, setPreviewResults] = useState<Asset[]>([]);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(-1);
  const [previewTotalCount, setPreviewTotalCount] = useState(0);

  // Use search preview hook with 200ms debounce for faster feedback
  const {
    results: previewData,
    loading: previewLoading,
    error: previewError,
    totalCount: previewTotal
  } = useSearchPreview(query, showPreview, { limit: 5, debounceMs: 200 });

  // Update preview results when data changes
  useEffect(() => {
    setPreviewResults(previewData);
    setPreviewTotalCount(previewTotal);
  }, [previewData, previewTotal]);

  // Show preview when typing and hide when query is empty
  useEffect(() => {
    if (query.trim()) {
      setShowPreview(true);
    } else {
      setShowPreview(false);
      setSelectedPreviewIndex(-1);
    }
  }, [query]);

  // Handle preview result selection
  const handleSelectPreviewResult = useCallback(
    (asset: Asset) => {
      // Navigate to the asset directly or trigger parent search with the query
      setShowPreview(false);
      setSelectedPreviewIndex(-1);

      // Keep the current search query and trigger search
      if (onSearch) {
        onSearch(query, { updateUrl: true });
      }

      // TODO: Add logic to highlight or scroll to selected asset in results
    },
    [query, onSearch]
  );

  // Handle "see all results" action
  const handleSeeAllResults = useCallback(() => {
    setShowPreview(false);
    setSelectedPreviewIndex(-1);

    if (query.trim() && onSearch) {
      onSearch(query.trim(), { updateUrl: true });
    }
  }, [query, onSearch]);

  // Handle preview navigation
  const handlePreviewNavigate = useCallback(
    (direction: 'up' | 'down') => {
      if (direction === 'down') {
        setSelectedPreviewIndex((prev) =>
          prev < previewResults.length - 1 ? prev + 1 : 0
        );
      } else {
        setSelectedPreviewIndex((prev) =>
          prev > 0 ? prev - 1 : previewResults.length - 1
        );
      }
    },
    [previewResults.length]
  );

  // Debounce the search query with 600ms delay for stability
  const debouncedQuery = useDebounce(query, 600);

  // Context-sensitive hint text
  const hintText = useMemo(() => {
    if (!query.trim()) {
      return 'Type to search';
    } else if (query.trim() && !loading) {
      return 'Press Enter to save search';
    } else if (query.trim() && loading) {
      return 'Searching...';
    } else {
      return 'Press Escape to clear';
    }
  }, [query, loading]);

  // Sync with initialQuery only when it changes externally (e.g., from URL navigation)
  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]); // Only depend on initialQuery, not query

  // Handle search when debounced query changes
  useEffect(() => {
    const trimmedQuery = debouncedQuery.trim();

    // Always call onSearch if provided, but without updating URL during typing
    if (onSearch) {
      // Call with updateUrl: false to prevent URL changes during typing
      onSearch(trimmedQuery, { updateUrl: false });
    } else if (trimmedQuery && !inline) {
      // Default behavior: navigate to search page
      router.push(`/app/search?q=${encodeURIComponent(trimmedQuery)}`);
    }

    // Clear loading state when search completes
    setLoading(false);
  }, [debouncedQuery, onSearch, router, inline]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Add ESC key handler to clear search
    if (e.key === 'Escape') {
      if (showPreview) {
        // Close preview if open
        setShowPreview(false);
        setSelectedPreviewIndex(-1);
      } else {
        // Otherwise clear search
        setQuery('');
        if (onSearch) {
          onSearch('', { updateUrl: false });
        }
        // Blur the input to remove focus
        e.currentTarget.blur();
      }
    }
    // Arrow navigation for preview
    else if (e.key === 'ArrowDown' && showPreview && previewResults.length > 0) {
      e.preventDefault();
      setSelectedPreviewIndex((prev) =>
        prev < previewResults.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp' && showPreview && previewResults.length > 0) {
      e.preventDefault();
      setSelectedPreviewIndex((prev) =>
        prev > 0 ? prev - 1 : previewResults.length - 1
      );
    }
    // Keep Enter key for immediate search (skips debounce)
    else if (e.key === 'Enter' && !loading) {
      // If preview is showing and an item is selected, select it
      if (showPreview && selectedPreviewIndex >= 0 && previewResults[selectedPreviewIndex]) {
        e.preventDefault();
        handleSelectPreviewResult(previewResults[selectedPreviewIndex]);
      }
      // Otherwise perform normal search
      else if (query.trim()) {
        const trimmedQuery = query.trim();
        setLoading(true);

        if (onSearch) {
          // Pass updateUrl: true on Enter to explicitly trigger URL update
          onSearch(trimmedQuery, { updateUrl: true });
        } else if (!inline) {
          router.push(`/app/search?q=${encodeURIComponent(trimmedQuery)}`);
        }

        // Close preview on search
        setShowPreview(false);
      }
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
    <div className={`relative ${className}`} data-search-bar>
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
              setQuery(e.target.value);
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

      {/* Search preview dropdown */}
      {showPreview && (
        <SearchPreview
          query={query}
          results={previewResults}
          loading={previewLoading}
          selectedIndex={selectedPreviewIndex}
          onSelectResult={handleSelectPreviewResult}
          onSeeAll={handleSeeAllResults}
          onClose={() => {
            setShowPreview(false);
            setSelectedPreviewIndex(-1);
          }}
          onNavigate={handlePreviewNavigate}
          totalCount={previewTotalCount}
        />
      )}

      {/* Context-sensitive hint text */}
      <div className="absolute -bottom-6 left-0 flex items-center gap-2 text-xs animate-fade-in">
        <span className="text-[#B3B7BE] transition-colors duration-200">
          {hintText}
        </span>
        {query.trim() && !loading && (
          <span className="text-[#6A6E78] animate-fade-in">
            • <kbd className="px-1.5 py-0.5 rounded bg-[#1B1F24] border border-[#2A2F37] text-[#B3B7BE] text-[10px] font-mono">ESC</kbd> to clear
          </span>
        )}
      </div>
    </div>
  );
}
