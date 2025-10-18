'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LayoutGrid, List } from 'lucide-react';

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
 * Two-button toggle group with active state highlighting
 */
export function ViewModeToggle({
  value,
  onChange,
  className,
  buttonClassName,
  size = 'md',
  showLabels = false,
}: ViewModeToggleProps) {
  const viewModes: Array<{
    value: ViewMode;
    label: string;
    icon: typeof LayoutGrid;
  }> = [
    {
      value: 'grid',
      label: 'Grid',
      icon: LayoutGrid,
    },
    {
      value: 'list',
      label: 'List',
      icon: List,
    },
  ];

  // Map custom size to Button size prop
  const buttonSize = size === 'md' ? 'default' : size === 'lg' ? 'lg' : size;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 p-0.5 bg-muted rounded-md',
        className
      )}
      role="radiogroup"
      aria-label="View mode"
    >
      {viewModes.map((mode) => {
        const isActive = value === mode.value;
        const Icon = mode.icon;

        return (
          <Button
            key={mode.value}
            variant={isActive ? 'default' : 'ghost'}
            size={buttonSize}
            onClick={() => onChange(mode.value)}
            className={cn(
              'gap-1.5',
              isActive && 'shadow-sm',
              !showLabels && 'w-10 px-0',
              buttonClassName
            )}
            role="radio"
            aria-checked={isActive}
            aria-label={mode.label}
            title={mode.label}
          >
            <Icon className="h-4 w-4" />
            {showLabels && <span>{mode.label}</span>}
          </Button>
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

  // Map custom size to Button size prop
  const buttonSize = size === 'md' ? 'icon' : size === 'sm' ? 'icon-sm' : 'icon-lg';

  const Icon = value === 'grid' ? LayoutGrid : List;

  return (
    <Button
      variant="outline"
      size={buttonSize}
      onClick={handleClick}
      className={className}
      aria-label={`View mode: ${value}`}
      title={`View mode: ${value} (click to cycle)`}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
