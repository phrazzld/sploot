'use client';

import { cn } from '@/lib/utils';

interface QuerySyntaxIndicatorProps {
  query: string;
  resultCount: number;
  filters?: {
    favorites?: boolean;
    tagName?: string;
  };
  latencyMs?: number;
  className?: string;
}

/**
 * Terminal-style query syntax breakdown
 * Shows parsed query, active filters, result count, and search latency
 * Format: QUERY: "drake meme" | FILTERS: [favorites] | RESULTS: 23 | LATENCY: 0.89s
 */
export function QuerySyntaxIndicator({
  query,
  resultCount,
  filters,
  latencyMs,
  className,
}: QuerySyntaxIndicatorProps) {
  const hasFilters = filters?.favorites || filters?.tagName;

  return (
    <div
      className={cn(
        'font-mono text-xs text-[#888888]',
        'flex flex-wrap items-center gap-2',
        className
      )}
    >
      {/* Query */}
      <span className="flex items-center gap-2">
        <span className="text-[#666666]">QUERY:</span>
        <span className="text-white">
          &quot;{query}&quot;
        </span>
      </span>

      {/* Separator */}
      <span className="text-[#333333]">|</span>

      {/* Filters */}
      {hasFilters && (
        <>
          <span className="flex items-center gap-2">
            <span className="text-[#666666]">FILTERS:</span>
            <span className="text-[var(--color-terminal-yellow)]">
              [
              {filters.favorites && 'favorites'}
              {filters.favorites && filters.tagName && ', '}
              {filters.tagName && `#${filters.tagName}`}
              ]
            </span>
          </span>
          <span className="text-[#333333]">|</span>
        </>
      )}

      {/* Results */}
      <span className="flex items-center gap-2">
        <span className="text-[#666666]">RESULTS:</span>
        <span className="text-[var(--color-terminal-green)]">
          {resultCount}
        </span>
      </span>

      {/* Latency */}
      {latencyMs !== undefined && (
        <>
          <span className="text-[#333333]">|</span>
          <span className="flex items-center gap-2">
            <span className="text-[#666666]">LATENCY:</span>
            <span className="text-[#888888]">
              {(latencyMs / 1000).toFixed(2)}s
            </span>
          </span>
        </>
      )}
    </div>
  );
}
