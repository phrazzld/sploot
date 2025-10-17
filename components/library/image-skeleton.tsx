'use client';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

interface ImageSkeletonProps {
  className?: string;
  variant?: 'tile' | 'list';
}

export function ImageSkeleton({ className, variant = 'tile' }: ImageSkeletonProps) {
  if (variant === 'list') {
    return (
      <div className={cn('flex items-center gap-4 p-4', className)}>
        <Skeleton className="h-16 w-16 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    );
  }

  // Default tile variant - matches ImageTile Card structure
  return (
    <Card className={cn('overflow-hidden border', className)}>
      <CardContent className="p-0">
        <Skeleton className="aspect-square w-full" />
      </CardContent>
    </Card>
  );
}

interface ImageGridSkeletonProps {
  count?: number;
  variant?: 'tile' | 'list';
  className?: string;
}

export function ImageGridSkeleton({ count = 12, variant = 'tile', className }: ImageGridSkeletonProps) {
  if (variant === 'list') {
    return (
      <div className={cn('space-y-1', className)}>
        {Array.from({ length: count }).map((_, i) => (
          <ImageSkeleton key={i} variant="list" />
        ))}
      </div>
    );
  }

  // Default grid variant
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <ImageSkeleton key={i} variant="tile" />
      ))}
    </div>
  );
}

// Optimized skeleton with CSS transforms for smooth transitions
export function OptimizedImageSkeleton({
  className,
  variant = 'tile',
  isExiting = false,
}: ImageSkeletonProps & { isExiting?: boolean }) {
  const baseClasses = cn(
    'transition-all duration-300 ease-out transform-gpu will-change-transform',
    isExiting ? 'scale-95 opacity-0' : 'scale-100 opacity-100',
    className
  );

  if (variant === 'list') {
    return (
      <div className={cn('flex items-center gap-4 p-4', baseClasses)}>
        <Skeleton className="h-16 w-16 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2 opacity-70" />
        </div>
      </div>
    );
  }

  // Default tile variant with optimized transitions
  return (
    <Card className={cn('overflow-hidden border', baseClasses)}>
      <CardContent className="p-0">
        <Skeleton className="aspect-square w-full" />
      </CardContent>
    </Card>
  );
}
