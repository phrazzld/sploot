'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface StatusLineProps {
  assetCount?: number;
  storageUsed?: number;
  lastUploadTime?: Date | string | null;
  queueDepth?: number;
  className?: string;
}

/**
 * Status line showing real-time system status using shadcn Badge components
 * Format: DENSE | LAST: 2m | Q:3
 * Shows app state (density, activity, queue) - library stats shown in page body
 * Reads density from URL params for display
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

  // Read density state from URL params
  const density = (searchParams.get('density') || 'dense') as 'compact' | 'dense' | 'comfortable';

  // Update current time every second for relative display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatStorage = (bytes: number): string => {
    if (bytes === 0) return '0 MB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
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

  return (
    <div
      className={cn(
        'flex items-center gap-2',
        'select-none',
        className
      )}
      title={`Density: ${density} | Last upload: ${formatTimestamp(lastUploadTime)} | Queue: ${queueDepth}`}
    >
      {/* Density Indicator */}
      <Badge variant="outline" className="hidden xl:flex items-center gap-1 font-mono text-xs">
        <span className="text-muted-foreground">density:</span>
        <span>{density}</span>
      </Badge>

      {lastUploadTime && (
        <>
          <Separator orientation="vertical" className="hidden xl:block h-4" />
          <Badge variant="outline" className="hidden xl:inline-block font-mono text-xs">
            <span className="text-muted-foreground">last:</span> {relativeTime}
          </Badge>
        </>
      )}

      {queueDepth > 0 && (
        <>
          <Separator orientation="vertical" className="h-4" />
          <Badge variant="secondary" className="font-mono text-xs text-yellow-500">
            <span className="text-muted-foreground">q:</span>{queueDepth}
          </Badge>
        </>
      )}
    </div>
  );
}
