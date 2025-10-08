'use client';

import { cn } from '@/lib/utils';

interface ImageSkeletonProps {
  className?: string;
  variant?: 'tile' | 'list';
}

export function ImageSkeleton({ className, variant = 'tile' }: ImageSkeletonProps) {
  if (variant === 'list') {
    return (
      <div className={cn('flex items-center gap-4 p-4', className)}>
        <div className="h-16 w-16 flex-shrink-0 animate-pulse bg-[#1B1F24]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-[#1B1F24]" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-[#1B1F24]/70" />
        </div>
      </div>
    );
  }

  // Default tile variant
  return (
    <div className={cn('group relative overflow-hidden  bg-[#1B1F24] animate-pulse', className)}>
      <div className="aspect-square w-full">
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F1216]/60 to-transparent opacity-0" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="h-3 w-2/3 rounded bg-[#2A2F37]/50" />
      </div>
    </div>
  );
}

interface ImageGridSkeletonProps {
  count?: number;
  variant?: 'tile' | 'list';
  className?: string;
}

export function ImageGridSkeleton({
  count = 12,
  variant = 'tile',
  className
}: ImageGridSkeletonProps) {
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
        'grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
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
  isExiting = false
}: ImageSkeletonProps & { isExiting?: boolean }) {
  const baseClasses = cn(
    'transition-all duration-300 ease-out transform-gpu will-change-transform',
    isExiting ? 'scale-95 opacity-0' : 'scale-100 opacity-100',
    className
  );

  if (variant === 'list') {
    return (
      <div className={cn('flex items-center gap-4 p-4', baseClasses)}>
        <div className="h-16 w-16 flex-shrink-0 bg-[#1B1F24] skeleton-shimmer" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded bg-[#1B1F24] skeleton-shimmer" />
          <div className="h-3 w-1/2 rounded bg-[#1B1F24]/70 skeleton-shimmer" />
        </div>
      </div>
    );
  }

  // Default tile variant with optimized shimmer
  return (
    <div className={cn(
      'group relative overflow-hidden  bg-[#1B1F24] skeleton-shimmer',
      baseClasses
    )}>
      <div className="aspect-square w-full" />
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="h-3 w-2/3 rounded bg-[#2A2F37]/50" />
      </div>
    </div>
  );
}