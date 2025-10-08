'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export type ViewMode = 'grid' | 'list';

interface ViewModeToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
  buttonClassName?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
}

/**
 * View mode toggle component with grid and list icons
 * Each button is a 40x40px touch target with accent color active state
 */
export function ViewModeToggle({
  value,
  onChange,
  className,
  buttonClassName,
  size = 'md',
  showLabels = false,
}: ViewModeToggleProps) {
  const sizeConfig = {
    sm: {
      button: 'w-8 h-8',
      icon: 'w-4 h-4',
      gap: 'gap-0.5',
      fontSize: 'text-xs',
    },
    md: {
      button: 'w-10 h-10', // 40x40px as specified
      icon: 'w-5 h-5',
      gap: 'gap-1',
      fontSize: 'text-sm',
    },
    lg: {
      button: 'w-12 h-12',
      icon: 'w-6 h-6',
      gap: 'gap-1.5',
      fontSize: 'text-base',
    },
  };

  const config = sizeConfig[size];

  const viewModes: Array<{
    value: ViewMode;
    label: string;
    icon: React.ReactElement;
  }> = [
    {
      value: 'grid',
      label: 'Grid',
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
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
      ),
    },
    {
      value: 'list',
      label: 'List',
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
            d="M4 6h16M4 12h16M4 18h16"
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
        'bg-black border border-[#333333] p-0.5',
        className
      )}
      role="radiogroup"
      aria-label="View mode"
    >
      {viewModes.map((mode) => {
        const isActive = value === mode.value;

        return (
          <button
            key={mode.value}
            onClick={() => onChange(mode.value)}
            className={cn(
              // Base styles
              'flex items-center justify-center',
              'group relative',

              // Size
              config.button,

              // Colors and states
              isActive
                ? 'bg-[var(--color-terminal-green)] text-black'
                : 'text-[#888888] hover:text-[var(--color-terminal-green)] hover:bg-[#0F1012]',

              // Touch target optimization
              'touch-manipulation',

              // Custom classes
              buttonClassName
            )}
            role="radio"
            aria-checked={isActive}
            aria-label={mode.label}
            title={mode.label}
          >
            {mode.icon}

            {showLabels && (
              <span className={cn('ml-1.5 font-mono uppercase', config.fontSize)}>
                {mode.label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Compact view mode toggle for mobile or space-constrained layouts
 * Shows as a single button that cycles through modes
 */
export function ViewModeCycle({
  value,
  onChange,
  className,
  size = 'md',
}: {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const modes: ViewMode[] = ['grid', 'list'];
  const currentIndex = modes.indexOf(value);

  const handleClick = () => {
    const nextIndex = (currentIndex + 1) % modes.length;
    onChange(modes[nextIndex]);
  };

  const sizeConfig = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  const icons = {
    grid: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    masonry: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 13a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z" />
      </svg>
    ),
    list: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    ),
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex items-center justify-center',
        'bg-black border border-[#333333]',
        'text-[#888888] hover:text-[var(--color-terminal-green)] hover:bg-[#0F1012]',
        'group',
        sizeConfig[size],
        className
      )}
      aria-label={`View mode: ${value}`}
      title={`View mode: ${value} (click to cycle)`}
    >
      {icons[value]}
    </button>
  );
}