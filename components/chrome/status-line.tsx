'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

interface StatusLineProps {
  assetCount?: number;
  storageUsed?: number;
  lastUploadTime?: Date | string | null;
  queueDepth?: number;
  className?: string;
}

/**
 * Terminal-style status line showing real-time system metrics
 * Format: VIEW: DENSE GRID | 247 ASSETS | 843MB | LAST: 2m | Q:3
 * Reads view mode and density from URL params for display
 */
export function StatusLine({
  assetCount = 0,
  storageUsed = 0,
  lastUploadTime = null,
  queueDepth = 0,
  className,
}: StatusLineProps) {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const searchParams = useSearchParams();

  // Read view state from URL params
  const viewMode = (searchParams.get('view') || 'grid') as 'grid' | 'list';
  const density = (searchParams.get('density') || 'dense') as 'compact' | 'dense' | 'comfortable';

  // Update current time every second for relative display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatStorage = (bytes: number): string => {
    if (bytes === 0) return '0B';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  };

  const formatTimestamp = (time: Date | string | null): string => {
    if (!time) return 'NEVER';
    const date = typeof time === 'string' ? new Date(time) : time;
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
  };

  const getRelativeTime = (time: Date | string | null): string => {
    if (!time) return '';
    const date = typeof time === 'string' ? new Date(time) : time;
    const seconds = Math.floor((currentTime.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const relativeTime = getRelativeTime(lastUploadTime);

  // Format view mode for display
  const formatViewMode = () => {
    const densityLabel = density.toUpperCase();
    const viewLabel = viewMode === 'grid' ? 'GRID' : 'LIST';
    return `${densityLabel} ${viewLabel}`;
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 text-xs font-mono text-[#888888]',
        'select-none',
        className
      )}
      title={`Assets: ${assetCount} | Storage: ${formatStorage(storageUsed)} | Last upload: ${formatTimestamp(lastUploadTime)} | Queue: ${queueDepth}`}
    >
      {/* View Mode Indicator */}
      <span className="hidden xl:inline flex items-center gap-1">
        <span className="text-[#666666]">VIEW:</span>
        <span className="text-white">{formatViewMode()}</span>
      </span>
      <span className="hidden xl:inline text-[#333333]">|</span>

      <span className="hidden lg:inline">
        {assetCount} <span className="text-[#666666]">ASSETS</span>
      </span>
      <span className="hidden lg:inline text-[#333333]">|</span>
      <span className="hidden md:inline">{formatStorage(storageUsed)}</span>
      {lastUploadTime && (
        <>
          <span className="hidden md:inline text-[#333333]">|</span>
          <span className="hidden xl:inline">
            <span className="text-[#666666]">LAST:</span> {relativeTime}
          </span>
        </>
      )}
      {queueDepth > 0 && (
        <>
          <span className="text-[#333333]">|</span>
          <span className="text-[var(--color-terminal-yellow)]">
            <span className="text-[#666666]">Q:</span>{queueDepth}
          </span>
        </>
      )}
    </div>
  );
}
