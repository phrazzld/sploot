'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface SimilarityScoreLegendProps {
  className?: string;
}

const STORAGE_KEY = 'sploot_similarity_legend_dismissed';

/**
 * Terminal-style legend explaining similarity score color coding
 * Shows on first search, dismissible with localStorage persistence
 */
export function SimilarityScoreLegend({ className }: SimilarityScoreLegendProps) {
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    // Check localStorage on mount
    const dismissed = localStorage.getItem(STORAGE_KEY);
    setIsDismissed(dismissed === 'true');
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsDismissed(true);
  };

  if (isDismissed) return null;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4  border border-[#2A2F37] bg-[#0F1216] p-3',
        'text-xs font-mono',
        className
      )}
    >
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-[#888888]">CONFIDENCE:</span>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-[var(--color-terminal-green)]" />
          <span className="text-[#B3B7BE]">
            High match <span className="text-[#6A6E78]">(≥85%)</span>
          </span>
        </div>
        <span className="text-[#464C55]">•</span>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-[var(--color-terminal-yellow)]" />
          <span className="text-[#B3B7BE]">
            Medium <span className="text-[#6A6E78]">(70-85%)</span>
          </span>
        </div>
        <span className="text-[#464C55]">•</span>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-[#464C55]" />
          <span className="text-[#B3B7BE]">
            Standard <span className="text-[#6A6E78]">(&lt;70%)</span>
          </span>
        </div>
      </div>

      <button
        onClick={handleDismiss}
        className="flex items-center gap-1 text-[#6A6E78] hover:text-[#B3B7BE] transition-colors shrink-0"
        title="Dismiss legend"
      >
        <span className="text-xs">HIDE</span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
