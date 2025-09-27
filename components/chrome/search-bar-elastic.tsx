'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSlashSearchShortcut } from '@/hooks/use-keyboard-shortcut';

interface SearchBarElasticProps {
  collapsedWidth?: number;
  expandedWidth?: number;
  placeholder?: string;
  className?: string;
  onSearch?: (query: string) => void;
  autoCollapse?: boolean;
}

/**
 * Elastic search bar that expands on focus
 * Transitions from collapsed to expanded width with smooth animation
 */
export function SearchBarElastic({
  collapsedWidth = 200,
  expandedWidth = 400,
  placeholder = 'Search memes...',
  className,
  onSearch,
  autoCollapse = true,
}: SearchBarElasticProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize query from URL
  useEffect(() => {
    const urlQuery = searchParams.get('q');
    if (urlQuery) {
      setQuery(urlQuery);
      setIsExpanded(true);
    }
  }, [searchParams]);

  // Add "/" keyboard shortcut to focus search
  useSlashSearchShortcut(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  });

  // Handle click outside to collapse
  useEffect(() => {
    if (!autoCollapse) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
        if (!query) {
          setIsExpanded(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [query, autoCollapse]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setIsSearching(true);

    // Update URL with search query
    const params = new URLSearchParams(searchParams.toString());
    params.set('q', query.trim());
    router.push(`/app?${params.toString()}`);

    // Call onSearch callback if provided
    onSearch?.(query.trim());

    // Reset searching state after animation
    setTimeout(() => {
      setIsSearching(false);
    }, 300);
  }, [query, searchParams, router, onSearch]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setQuery('');
      inputRef.current?.blur();
      setIsFocused(false);
      if (autoCollapse) {
        setIsExpanded(false);
      }
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    setIsExpanded(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (autoCollapse && !query) {
      // Delay collapse to allow for click events
      setTimeout(() => {
        if (!isFocused && !query) {
          setIsExpanded(false);
        }
      }, 200);
    }
  };

  const clearSearch = () => {
    setQuery('');
    const params = new URLSearchParams(searchParams.toString());
    params.delete('q');
    const newUrl = params.toString() ? `/app?${params}` : '/app';
    router.push(newUrl);
    inputRef.current?.focus();
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex items-center',
        'transition-[width] duration-[180ms] ease-out will-change-[width]', // Only transition width, use will-change for optimization
        className
      )}
      style={{
        width: isExpanded ? expandedWidth : collapsedWidth,
      }}
    >
      {/* Search Icon */}
      <div className="absolute left-3 pointer-events-none">
        <svg
          className={cn(
            'w-4 h-4 transition-colors',
            isFocused ? 'text-[#7C5CFF]' : 'text-[#B3B7BE]'
          )}
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

      {/* Input Field */}
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          'w-full h-10 pl-10 pr-10',
          'bg-[#1B1F24] text-[#E6E8EB]',
          'border border-[#2A2F37]',
          'rounded-lg',
          'placeholder:text-[#B3B7BE]/60',
          'transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]/50',
          'focus:border-[#7C5CFF]',
          isSearching && 'animate-pulse'
        )}
        aria-label="Search"
      />

      {/* Clear/Action Button */}
      {query && (
        <button
          onClick={clearSearch}
          className={cn(
            'absolute right-3',
            'p-1 rounded-md',
            'text-[#B3B7BE] hover:text-[#E6E8EB]',
            'hover:bg-[#2A2F37]',
            'transition-all duration-200'
          )}
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

      {/* Keyboard Shortcut Hint */}
      {!isFocused && !query && (
        <div className="absolute right-3 pointer-events-none">
          <kbd className="px-1.5 py-0.5 text-[10px] font-medium text-[#B3B7BE]/40 bg-[#2A2F37]/50 rounded">
            /
          </kbd>
        </div>
      )}
    </div>
  );
}

/**
 * Minimal search trigger button that expands into full search bar
 * Useful for mobile or space-constrained layouts
 */
export function SearchTrigger({
  onClick,
  className,
}: {
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'p-2.5 rounded-lg',
        'bg-[#1B1F24] hover:bg-[#2A2F37]',
        'text-[#B3B7BE] hover:text-[#7C5CFF]',
        'transition-all duration-200',
        'group',
        className
      )}
      aria-label="Search"
    >
      <svg
        className="w-5 h-5 transition-transform group-hover:scale-110"
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
  );
}