'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

export type SortOption = 'recent' | 'date' | 'size' | 'name';
export type SortDirection = 'asc' | 'desc';

interface SortDropdownProps {
  value?: SortOption;
  direction?: SortDirection;
  onChange?: (option: SortOption, direction: SortDirection) => void;
  className?: string;
}

/**
 * Sort dropdown component for the footer
 * Displays "recent ↓" by default with options for date/size/name sorting
 */
export function SortDropdown({
  value = 'recent',
  direction = 'desc',
  onChange,
  className,
}: SortDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentSort, setCurrentSort] = useState(value);
  const [currentDirection, setCurrentDirection] = useState(direction);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sort option configurations
  const sortOptions: Array<{ value: SortOption; label: string }> = [
    { value: 'recent', label: 'Recent' },
    { value: 'date', label: 'Date Added' },
    { value: 'size', label: 'File Size' },
    { value: 'name', label: 'Name' },
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Handle sort option selection
  const handleSortChange = (option: SortOption) => {
    // If selecting the same option, toggle direction
    // Otherwise, use default direction for that option
    const newDirection =
      option === currentSort
        ? currentDirection === 'desc' ? 'asc' : 'desc'
        : option === 'name' ? 'asc' : 'desc'; // Name defaults to A-Z, others to newest/largest first

    setCurrentSort(option);
    setCurrentDirection(newDirection);
    setIsOpen(false);

    if (onChange) {
      onChange(option, newDirection);
    }
  };

  // Get display label for current sort
  const getCurrentLabel = () => {
    const option = sortOptions.find((o) => o.value === currentSort);
    return option ? option.label : 'Recent';
  };

  // Get arrow icon for current direction
  const getArrowIcon = () => {
    return currentDirection === 'desc' ? '↓' : '↑';
  };

  return (
    <div className={cn('relative', className)}>
      {/* Trigger button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          // Base styles
          'flex items-center gap-1',
          'px-3 py-1.5',
          'text-sm text-[#B3B7BE]',
          'hover:text-[#E6E8EB]',
          // Background
          'bg-[#1B1F24] hover:bg-[#242931]',
          'border border-[#2A2F37]',
          'rounded-md',
          // Transitions
          'transition-all duration-200',
          // Focus states
          'focus-visible:outline focus-visible:outline-2',
          'focus-visible:outline-offset-2 focus-visible:outline-[#7C5CFF]'
        )}
        aria-label="Sort options"
        title={`Sort by ${getCurrentLabel()}`}
      >
        <span>{getCurrentLabel()}</span>
        <span className="text-xs">{getArrowIcon()}</span>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className={cn(
            // Position above the button (footer is at bottom)
            'absolute bottom-full right-0',
            'mb-1', // 4px gap
            // Styling
            'bg-[#14171A] border border-[#2A2F37]',
            'rounded-lg shadow-xl',
            'min-w-[140px]',
            // Animation
            'dropdown-animate-in-up',
            // Z-index
            'z-50'
          )}
        >
          {/* Sort options */}
          <div className="py-1">
            {sortOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSortChange(option.value)}
                className={cn(
                  'w-full flex items-center justify-between',
                  'px-3 py-2',
                  'text-sm',
                  'transition-colors',
                  // Highlight current option
                  currentSort === option.value
                    ? 'text-[#7C5CFF] bg-[#7C5CFF]/10'
                    : 'text-[#B3B7BE] hover:text-[#E6E8EB] hover:bg-[#1B1F24]'
                )}
              >
                <span>{option.label}</span>
                {currentSort === option.value && (
                  <span className="text-xs ml-2">
                    {currentDirection === 'desc' ? '↓' : '↑'}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Direction toggle hint */}
          <div className="px-3 py-2 border-t border-[#2A2F37]">
            <p className="text-xs text-[#888C96]">
              Click again to reverse order
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact sort button for mobile/compact layouts
 * Shows only icon with current sort direction
 */
export function SortButtonCompact({
  value = 'recent',
  direction = 'desc',
  onClick,
  className,
}: {
  value?: SortOption;
  direction?: SortDirection;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        // 32px square touch target
        'w-8 h-8',
        'flex items-center justify-center',
        'text-[#B3B7BE] hover:text-[#E6E8EB]',
        'hover:bg-[#1B1F24] rounded-md',
        'transition-colors duration-200',
        className
      )}
      aria-label={`Sort by ${value}`}
      title={`Sort by ${value}`}
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        {direction === 'desc' ? (
          // Sort descending icon
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4h13M3 8h9m-9 4h6m4 0l4 4m0 0l4-4m-4 4V8"
          />
        ) : (
          // Sort ascending icon
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4"
          />
        )}
      </svg>
    </button>
  );
}