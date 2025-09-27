'use client';

import { ReactNode } from 'react';
import { StatsDisplay } from './stats-display';
import { FilterChips, type FilterType } from './filter-chips';
import { SortDropdown, type SortOption, type SortDirection } from './sort-dropdown';
import { cn } from '@/lib/utils';

interface FooterProps {
  children?: ReactNode;
  className?: string;
  totalAssets?: number;
  favoriteCount?: number;
  totalSizeBytes?: number;
  showStats?: boolean;
  activeFilter?: FilterType;
  onFilterChange?: (filter: FilterType) => void;
  showFilters?: boolean;
  sortValue?: SortOption;
  sortDirection?: SortDirection;
  onSortChange?: (option: SortOption, direction: SortDirection) => void;
  showSort?: boolean;
}

/**
 * Fixed footer component for the new architecture
 * Height: 44px (11 * 4px base unit)
 * Position: Fixed bottom
 * Z-index: 50 (same as navbar)
 */
export function Footer({
  children,
  className,
  totalAssets = 134,
  favoriteCount = 2,
  totalSizeBytes = 10380902, // ~9.9 MB
  showStats = true,
  activeFilter = 'all',
  onFilterChange,
  showFilters = true,
  sortValue = 'recent',
  sortDirection = 'desc',
  onSortChange,
  showSort = true,
}: FooterProps) {
  return (
    <footer
      className={cn(
        // Fixed positioning
        'fixed bottom-0 left-0 right-0',
        // Z-index to stay above content
        'z-50',
        // Height: 44px
        'h-11',
        // Background and border
        'bg-[#14171A] border-t border-[#2A2F37]',
        // Backdrop for glass effect
        'backdrop-blur-sm',
        // Layout
        'flex items-center',
        // Padding
        'px-4 md:px-6',
        // Custom classes
        className
      )}
    >
      {/* Container for footer content */}
      <div className="flex items-center justify-between w-full max-w-screen-2xl mx-auto">
        {/* Left section: Stats display - left-aligned with 16px padding */}
        {showStats && (
          <StatsDisplay
            totalAssets={totalAssets}
            favoriteCount={favoriteCount}
            totalSizeBytes={totalSizeBytes}
            className="pl-4" // 16px left padding
          />
        )}

        {/* Center section: Filters */}
        {showFilters && (
          <FilterChips
            activeFilter={activeFilter}
            onFilterChange={onFilterChange}
            size="md" // 32px height as specified
            showLabels={true}
          />
        )}

        {/* Right section: Sort and settings */}
        <div className="flex items-center gap-3">
          {/* Sort dropdown - right-aligned before settings */}
          {showSort && (
            <SortDropdown
              value={sortValue}
              direction={sortDirection}
              onChange={onSortChange}
            />
          )}

          {/* Settings gear will go here */}
        </div>

        {/* Allow children to be passed for flexibility during development */}
        {children}
      </div>
    </footer>
  );
}

/**
 * Spacer component to push content above the fixed footer
 * Use this in layouts to prevent content from going under the footer
 */
export function FooterSpacer() {
  return <div className="h-11" />;
}