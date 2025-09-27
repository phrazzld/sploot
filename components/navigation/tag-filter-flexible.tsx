'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

interface Tag {
  id: string;
  name: string;
  color: string | null;
  assetCount: number;
}

export type TagFilterPosition = 'sidebar' | 'navbar' | 'footer' | 'header';
export type TagFilterDisplayMode = 'full' | 'compact' | 'chips';

interface TagFilterFlexibleProps {
  position?: TagFilterPosition;
  displayMode?: TagFilterDisplayMode;
  showHeader?: boolean;
  expandable?: boolean;
  maxItemsBeforeScroll?: number;
  className?: string;
}

export function TagFilterFlexible({
  position = 'sidebar',
  displayMode = 'full',
  showHeader = true,
  expandable = true,
  maxItemsBeforeScroll = 10,
  className
}: TagFilterFlexibleProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(!expandable || position === 'footer');
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTagId = searchParams.get('tagId');

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      const response = await fetch('/api/tags');
      if (response.ok) {
        const data = await response.json();
        setTags(data.tags || []);
      }
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTagClick = (tagId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tagId === null) {
      params.delete('tagId');
    } else if (activeTagId === tagId) {
      params.delete('tagId');
    } else {
      params.set('tagId', tagId);
    }
    router.push(`/app${params.toString() ? `?${params}` : ''}`);
  };

  // Loading state
  if (loading) {
    return (
      <div className={cn(
        position === 'footer' || position === 'navbar' ? 'flex items-center gap-2' : 'space-y-2',
        className
      )}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              'bg-[#1B1F24] rounded animate-pulse',
              position === 'footer' || position === 'navbar' ? 'h-8 w-20' : 'h-6 w-full'
            )}
          />
        ))}
      </div>
    );
  }

  if (tags.length === 0) {
    return null;
  }

  // Chips display mode for footer/navbar
  if (displayMode === 'chips' || position === 'footer' || position === 'navbar') {
    return (
      <div className={cn(
        'flex items-center gap-2',
        tags.length > maxItemsBeforeScroll && 'overflow-x-auto scrollbar-thin',
        className
      )}>
        {/* All Items Chip */}
        <button
          onClick={() => handleTagClick(null)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
            'whitespace-nowrap flex-shrink-0',
            !activeTagId
              ? 'bg-[#7C5CFF] text-white'
              : 'bg-[#1B1F24] text-[#B3B7BE] hover:bg-[#2A2F37] hover:text-[#E6E8EB]'
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#B6FF6E]" />
          All
        </button>

        {/* Tag Chips */}
        {tags.map(tag => (
          <button
            key={tag.id}
            onClick={() => handleTagClick(tag.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
              'whitespace-nowrap flex-shrink-0',
              activeTagId === tag.id
                ? 'bg-[#7C5CFF] text-white'
                : 'bg-[#1B1F24] text-[#B3B7BE] hover:bg-[#2A2F37] hover:text-[#E6E8EB]'
            )}
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: tag.color || '#B3B7BE' }}
            />
            <span>{tag.name}</span>
            {displayMode === 'full' && (
              <span className="opacity-60">({tag.assetCount})</span>
            )}
          </button>
        ))}
      </div>
    );
  }

  // Full vertical display mode for sidebar
  return (
    <div className={cn('mt-6', className)}>
      {showHeader && expandable && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-3 py-2 flex items-center justify-between text-[#B3B7BE] hover:text-[#E6E8EB] transition-colors"
        >
          <span className="text-xs font-semibold uppercase tracking-wider">Tags</span>
          <svg
            className={cn(
              'w-4 h-4 transition-transform',
              isExpanded ? 'rotate-180' : ''
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {(!expandable || isExpanded) && (
        <div className={cn(
          'space-y-0.5',
          showHeader && 'mt-1',
          tags.length > maxItemsBeforeScroll && 'max-h-64 overflow-y-auto scrollbar-thin'
        )}>
          {/* All Items Button */}
          <button
            onClick={() => handleTagClick(null)}
            className={cn(
              'flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-200',
              'hover:bg-[#1B1F24] group w-full',
              !activeTagId ? 'bg-[#7C5CFF]/10 text-[#7C5CFF]' : 'text-[#B3B7BE] hover:text-[#E6E8EB]'
            )}
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#B6FF6E]" />
              All memes
            </span>
            {!activeTagId && (
              <span className="text-xs text-[#7C5CFF]">∞</span>
            )}
          </button>

          {/* Tag Buttons */}
          {tags.map(tag => {
            const isActive = activeTagId === tag.id;

            return (
              <button
                key={tag.id}
                onClick={() => handleTagClick(tag.id)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-200 text-left',
                  'hover:bg-[#1B1F24] group',
                  isActive
                    ? 'bg-[#7C5CFF]/10 text-[#7C5CFF]'
                    : 'text-[#B3B7BE] hover:text-[#E6E8EB]'
                )}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      tag.color ? '' : 'bg-[#B3B7BE]'
                    )}
                    style={tag.color ? { backgroundColor: tag.color } : undefined}
                  />
                  <span className="truncate">{tag.name}</span>
                </div>
                <span className={cn(
                  'text-xs',
                  isActive ? 'text-[#7C5CFF]' : 'text-[#B3B7BE]/60'
                )}>
                  {tag.assetCount}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}