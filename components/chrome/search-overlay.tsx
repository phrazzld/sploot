'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch?: (query: string) => void;
}

/**
 * Full-screen search overlay for mobile devices
 * Appears when search icon is tapped on mobile
 */
export function SearchOverlay({
  isOpen,
  onClose,
  onSearch,
}: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize query from URL
  useEffect(() => {
    const urlQuery = searchParams.get('q');
    if (urlQuery) {
      setQuery(urlQuery);
    }
  }, [searchParams]);

  // Focus input when overlay opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);

    // Update URL with search query
    const params = new URLSearchParams(searchParams.toString());
    params.set('q', query.trim());
    router.push(`/app?${params.toString()}`);

    // Call onSearch callback if provided
    onSearch?.(query.trim());

    // Close overlay after search
    setTimeout(() => {
      setIsSearching(false);
      onClose();
    }, 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
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

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50',
        'bg-[#0A0B0D]/95 backdrop-blur-md',
        'animate-in fade-in duration-200'
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          'flex flex-col',
          'w-full max-w-2xl mx-auto',
          'px-4 pt-20'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input container */}
        <div className="relative">
          {/* Close button */}
          <button
            onClick={onClose}
            className={cn(
              'absolute -top-12 right-0',
              'p-2 rounded-lg',
              'text-[#B3B7BE] hover:text-[#E6E8EB]',
              'hover:bg-[#2A2F37]',
              'transition-colors'
            )}
            aria-label="Close search"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Search icon */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg
              className="w-6 h-6 text-[#7C5CFF]"
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
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search your memes..."
            className={cn(
              'w-full h-14 pl-14 pr-14',
              'bg-[#1B1F24] text-[#E6E8EB]',
              'text-lg',
              'border-2 border-[#7C5CFF]/50',
              'rounded-xl',
              'placeholder:text-[#B3B7BE]/60',
              'focus:outline-none focus:border-[#7C5CFF]',
              'transition-all duration-200',
              isSearching && 'animate-pulse'
            )}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />

          {/* Clear button */}
          {query && (
            <button
              onClick={clearSearch}
              className={cn(
                'absolute right-4 top-1/2 -translate-y-1/2',
                'p-2 rounded-lg',
                'text-[#B3B7BE] hover:text-[#E6E8EB]',
                'hover:bg-[#2A2F37]',
                'transition-colors'
              )}
              aria-label="Clear search"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Search button */}
        <button
          onClick={handleSearch}
          disabled={!query.trim()}
          className={cn(
            'mt-4 px-6 py-3',
            'bg-[#7C5CFF] text-white',
            'rounded-lg font-medium',
            'transition-all duration-200',
            query.trim()
              ? 'hover:bg-[#6B4FE6] active:scale-95'
              : 'opacity-50 cursor-not-allowed'
          )}
        >
          Search
        </button>

        {/* Quick suggestions (optional) */}
        <div className="mt-8 space-y-2">
          <p className="text-sm text-[#B3B7BE]">Try searching for:</p>
          <div className="flex flex-wrap gap-2">
            {['funny', 'reaction', 'cat', 'meme'].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  setQuery(suggestion);
                  inputRef.current?.focus();
                }}
                className={cn(
                  'px-3 py-1.5',
                  'bg-[#1B1F24] hover:bg-[#2A2F37]',
                  'text-[#B3B7BE] hover:text-[#E6E8EB]',
                  'rounded-full text-sm',
                  'transition-colors'
                )}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}