'use client';

import { cn } from '@/lib/utils';
import { useAnimatedNumber, formatWithCommas, useAnimatedSize } from '@/hooks/use-animated-number';

interface StatsDisplayProps {
  totalAssets?: number;
  favoriteCount?: number;
  totalSizeBytes?: number;
  className?: string;
  showLabels?: boolean;
}

/**
 * Stats display component for terminal aesthetic
 * Terminal-style format: "247 ASSETS | 12 FAVORITES | 843MB"
 * Uses monospace typography (JetBrains Mono) and pipe separators
 */
export function StatsDisplay({
  totalAssets = 0,
  favoriteCount = 0,
  totalSizeBytes = 0,
  className,
  showLabels = true,
}: StatsDisplayProps) {
  // Animate the numbers with 300ms morphing effect
  const animatedAssets = useAnimatedNumber(totalAssets, {
    duration: 300,
    formatter: (n) => Math.round(n).toString(),
  });

  const animatedFavorites = useAnimatedNumber(favoriteCount, {
    duration: 300,
    formatter: (n) => Math.round(n).toString(),
  });

  const animatedSize = useAnimatedSize(totalSizeBytes, {
    duration: 300,
  });

  // Terminal-style stats format (no icons, uppercase labels, pipe separators)
  const stats = [
    { label: 'ASSETS', value: animatedAssets },
    { label: 'FAVORITES', value: animatedFavorites },
    { label: '', value: animatedSize }, // Size already has unit
  ];

  return (
    <div
      className={cn(
        'flex items-center gap-2',
        'font-mono text-xs text-[var(--color-terminal-gray)]',
        'tracking-wide',
        className
      )}
    >
      {stats.map((stat, index) => (
        <span key={index} className="flex items-center gap-2">
          {index > 0 && <span className="opacity-40">|</span>}
          <span className="tabular-nums">
            {stat.value}
            {stat.label && showLabels && <span className="ml-1 opacity-80">{stat.label}</span>}
          </span>
        </span>
      ))}
    </div>
  );
}

/**
 * Compact stats display for mobile or space-constrained layouts
 * Terminal-style monospace format without labels
 */
export function StatsCompact({
  totalAssets = 0,
  favoriteCount = 0,
  totalSizeBytes = 0,
  className,
}: StatsDisplayProps) {
  // Animate the numbers with 300ms morphing effect
  const animatedAssets = useAnimatedNumber(totalAssets, {
    duration: 300,
    formatter: (n) => Math.round(n).toString(),
  });

  const animatedFavorites = useAnimatedNumber(favoriteCount, {
    duration: 300,
    formatter: (n) => Math.round(n).toString(),
  });

  // Custom formatter for compact size display
  const formatSizeCompact = (bytes: number): string => {
    if (bytes === 0) return '0';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) {
      const kb = bytes / 1024;
      return `${Math.round(kb)}K`;
    }
    if (mb >= 1000) {
      const gb = mb / 1024;
      return `${gb.toFixed(1)}G`;
    }
    return `${Math.round(mb)}M`;
  };

  const animatedSize = useAnimatedNumber(totalSizeBytes, {
    duration: 300,
    formatter: formatSizeCompact,
  });

  return (
    <div
      className={cn(
        'flex items-center gap-2',
        'font-mono text-xs text-[var(--color-terminal-gray)]',
        'tabular-nums tracking-wide',
        className
      )}
    >
      <span>{animatedAssets}</span>
      <span className="opacity-40">|</span>
      <span>{animatedFavorites}</span>
      <span className="opacity-40">|</span>
      <span>{animatedSize}</span>
    </div>
  );
}