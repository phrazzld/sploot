'use client';

import { cn } from '@/lib/utils';

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
 * Shows favorites and recent filters with 32px height and toggle states
 */
export function FilterChips({
  activeFilter = 'all',
  onFilterChange,
  className,
  showLabels = true,
  size = 'md',
}: FilterChipsProps) {
  const sizeConfig = {
    sm: {
      height: 'h-7',
      padding: showLabels ? 'px-2.5' : 'px-2',
      icon: 'w-3.5 h-3.5',
      gap: 'gap-1',
      fontSize: 'text-xs',
    },
    md: {
      height: 'h-8', // 32px height as specified
      padding: showLabels ? 'px-3' : 'px-2.5',
      icon: 'w-4 h-4',
      gap: 'gap-1.5',
      fontSize: 'text-sm',
    },
    lg: {
      height: 'h-9',
      padding: showLabels ? 'px-3.5' : 'px-3',
      icon: 'w-4.5 h-4.5',
      gap: 'gap-2',
      fontSize: 'text-base',
    },
  };

  const config = sizeConfig[size];

  const filters = [
    {
      value: 'all' as FilterType,
      label: 'All',
      icon: null,
    },
    {
      value: 'favorites' as FilterType,
      label: 'Favorites',
      icon: (
        <svg
          className={config.icon}
          fill={activeFilter === 'favorites' ? 'currentColor' : 'none'}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </svg>
      ),
    },
    {
      value: 'recent' as FilterType,
      label: 'Recent',
      icon: (
        <svg
          className={config.icon}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
  ];

  return (
    <div
      className={cn(
        'flex items-center',
        config.gap,
        className
      )}
      role="group"
      aria-label="Filter options"
    >
      {filters.map((filter) => {
        const isActive = activeFilter === filter.value;

        return (
          <button
            key={filter.value}
            onClick={() => onFilterChange?.(filter.value)}
            className={cn(
              // Base styles
              'flex items-center justify-center',
              'rounded-full transition-all duration-200',
              'font-medium',

              // Size
              config.height,
              config.padding,
              config.gap,
              config.fontSize,

              // Colors and states
              isActive
                ? 'bg-[#7C5CFF] text-white shadow-lg shadow-[#7C5CFF]/20'
                : 'bg-[#1B1F24] text-[#B3B7BE] hover:bg-[#2A2F37] hover:text-[#E6E8EB]',

              // Hover effects
              'hover:scale-105 active:scale-95',

              // Focus states
              'focus-visible:outline focus-visible:outline-2',
              'focus-visible:outline-offset-2 focus-visible:outline-[#7C5CFF]',

              // Touch optimization
              'touch-manipulation'
            )}
            aria-pressed={isActive}
            aria-label={filter.label}
            title={filter.label}
          >
            {filter.icon && (
              <span className={cn(
                'flex-shrink-0',
                isActive && 'text-white'
              )}>
                {filter.icon}
              </span>
            )}
            {showLabels && (
              <span>{filter.label}</span>
            )}
          </button>
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
  const sizeConfig = {
    sm: 'h-7 px-2.5 text-xs gap-1',
    md: 'h-8 px-3 text-sm gap-1.5', // 32px height
    lg: 'h-9 px-3.5 text-base gap-2',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center',
        'rounded-full font-medium',
        'transition-all duration-200',
        sizeConfig[size],
        isActive
          ? 'bg-[#7C5CFF] text-white shadow-lg shadow-[#7C5CFF]/20'
          : 'bg-[#1B1F24] text-[#B3B7BE] hover:bg-[#2A2F37] hover:text-[#E6E8EB]',
        'hover:scale-105 active:scale-95',
        'focus-visible:outline focus-visible:outline-2',
        'focus-visible:outline-offset-2 focus-visible:outline-[#7C5CFF]',
        className
      )}
      aria-pressed={isActive}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{label}</span>
    </button>
  );
}