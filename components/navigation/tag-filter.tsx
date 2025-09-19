'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface Tag {
  id: string;
  name: string;
  color: string | null;
  assetCount: number;
}

export function TagFilter() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  const pathname = usePathname();

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

  if (loading) {
    return (
      <div className="px-3 py-2">
        <div className="h-6 bg-[#1B1F24] rounded animate-pulse" />
      </div>
    );
  }

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
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

      {isExpanded && (
        <div className="mt-1 space-y-0.5">
          {tags.map(tag => {
            const tagPath = `/app/tags/${tag.id}`;
            const isActive = pathname === tagPath;

            return (
              <Link
                key={tag.id}
                href={tagPath}
                className={cn(
                  'flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-200',
                  'hover:bg-[#1B1F24] group',
                  isActive ?
                    'bg-[#7C5CFF]/10 text-[#7C5CFF]' :
                    'text-[#B3B7BE] hover:text-[#E6E8EB]'
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
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}