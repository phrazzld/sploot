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
 * Stats display component for the footer
 * Shows library statistics in "134 memes • 2 bangers • 9.9 MB" format
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
    formatter: formatWithCommas,
  });

  const animatedFavorites = useAnimatedNumber(favoriteCount, {
    duration: 300,
    formatter: formatWithCommas,
  });

  const animatedSize = useAnimatedSize(totalSizeBytes, {
    duration: 300,
  });

  // Pluralize labels (using animated values)
  const pluralizeAnimated = (animatedCount: string, count: number, singular: string, plural?: string): string => {
    if (!showLabels) return animatedCount;
    const label = count === 1 ? singular : plural || `${singular}s`;
    return `${animatedCount} ${label}`;
  };

  const stats = [
    {
      value: pluralizeAnimated(animatedAssets, totalAssets, 'meme'),
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      value: pluralizeAnimated(animatedFavorites, favoriteCount, 'banger'),
      icon: (
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
        </svg>
      ),
    },
    {
      value: animatedSize,
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M7 7h10M7 12h10m-7 5h4m-9 4h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className={cn(
        'flex items-center gap-1',
        'text-sm text-[#B3B7BE]',
        className
      )}
    >
      {stats.map((stat, index) => (
        <span key={index} className="flex items-center gap-1">
          {index > 0 && <span className="mx-1.5 opacity-40">•</span>}
          {stat.icon && <span className="opacity-60">{stat.icon}</span>}
          <span>{stat.value}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * Compact stats display for mobile or space-constrained layouts
 * Shows only the numbers without labels
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
        'text-xs text-[#B3B7BE]',
        className
      )}
    >
      <span className="flex items-center gap-0.5">
        <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {animatedAssets}
      </span>
      <span className="opacity-40">•</span>
      <span className="flex items-center gap-0.5">
        <svg className="w-3 h-3 opacity-60" fill="currentColor" viewBox="0 0 24 24">
          <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
        </svg>
        {animatedFavorites}
      </span>
      <span className="opacity-40">•</span>
      <span className="flex items-center gap-0.5">
        <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M7 7h10M7 12h10m-7 5h4m-9 4h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        {animatedSize}
      </span>
    </div>
  );
}