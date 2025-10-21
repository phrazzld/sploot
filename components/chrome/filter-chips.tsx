'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Heart, Clock } from 'lucide-react';

export type FilterType = 'all' | 'favorites' | 'recent';

interface FilterChipsProps {
  activeFilter?: FilterType;
  onFilterChange?: (filter: FilterType) => void;
  className?: string;
  showLabels?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Filter chips component for the footer
 * Shows favorites and recent filters with toggle states
 */
export function FilterChips({
  activeFilter = 'all',
  onFilterChange,
  className,
  showLabels = true,
  size = 'md',
}: FilterChipsProps) {
  const filters = [
    {
      value: 'all' as FilterType,
      label: 'All',
      icon: null,
    },
    {
      value: 'favorites' as FilterType,
      label: 'Favorites',
      icon: Heart,
    },
    {
      value: 'recent' as FilterType,
      label: 'Recent',
      icon: Clock,
    },
  ];

  // Map custom size to Button size prop
  const buttonSize = size === 'md' ? 'default' : size === 'lg' ? 'lg' : size;

  return (
    <div
      className={cn('flex items-center gap-1.5', className)}
      role="group"
      aria-label="Filter options"
    >
      {filters.map((filter) => {
        const isActive = activeFilter === filter.value;
        const Icon = filter.icon;

        return (
          <Button
            key={filter.value}
            variant={isActive ? 'default' : 'outline'}
            size={buttonSize}
            onClick={() => onFilterChange?.(filter.value)}
            className={cn(
              'gap-1.5',
              isActive && 'shadow-lg',
              !showLabels && 'w-8 px-0'
            )}
            aria-pressed={isActive}
            aria-label={filter.label}
            title={filter.label}
          >
            {Icon && (
              <Icon
                className="h-4 w-4"
                fill={filter.value === 'favorites' && isActive ? 'currentColor' : 'none'}
                strokeWidth={2}
              />
            )}
            {showLabels && <span>{filter.label}</span>}
          </Button>
        );
      })}
    </div>
  );
}

/**
 * Single filter chip for custom layouts
 * Can be used independently for more flexible positioning
 */
export function FilterChip({
  label,
  icon,
  isActive = false,
  onClick,
  className,
  size = 'md',
}: {
  label: string;
  icon?: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  // Map custom size to Button size prop
  const buttonSize = size === 'md' ? 'default' : size === 'lg' ? 'lg' : size;

  return (
    <Button
      variant={isActive ? 'default' : 'outline'}
      size={buttonSize}
      onClick={onClick}
      className={cn('gap-1.5', isActive && 'shadow-lg', className)}
      aria-pressed={isActive}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{label}</span>
    </Button>
  );
}
