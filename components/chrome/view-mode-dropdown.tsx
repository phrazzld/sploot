'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ViewMode } from './view-mode-toggle';
import { cn } from '@/lib/utils';

interface ViewModeDropdownProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

/**
 * Dropdown menu for view mode selection on mobile
 * Collapses three view options into a single dropdown
 */
export function ViewModeDropdown({
  value,
  onChange,
  className,
}: ViewModeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const viewModes: Array<{
    value: ViewMode;
    label: string;
    icon: React.ReactElement;
  }> = [
    {
      value: 'grid',
      label: 'Grid View',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
    {
      value: 'masonry',
      label: 'Masonry View',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 13a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z" />
        </svg>
      ),
    },
    {
      value: 'list',
      label: 'List View',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      ),
    },
  ];

  const currentMode = viewModes.find(m => m.value === value);

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      {/* Dropdown trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2',
          'bg-[#1B1F24] hover:bg-[#2A2F37]',
          'text-[#B3B7BE] hover:text-[#E6E8EB]',
          'rounded-lg transition-all duration-200',
          'min-w-[120px]'
        )}
        aria-label="View mode menu"
        aria-expanded={isOpen}
      >
        {currentMode?.icon}
        <span className="text-sm">{currentMode?.label}</span>
        <svg
          className={cn(
            'w-4 h-4 ml-auto transition-transform',
            isOpen && 'rotate-180'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className={cn(
          'absolute top-full mt-1 left-0 right-0',
          'bg-[#1B1F24] border border-[#2A2F37]',
          'rounded-lg shadow-lg',
          'py-1',
          'z-50',
          'min-w-[150px]',
          'dropdown-animate-in'
        )}>
          {viewModes.map((mode) => {
            const isActive = value === mode.value;
            return (
              <button
                key={mode.value}
                onClick={() => {
                  onChange(mode.value);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2',
                  'transition-colors duration-200',
                  'text-left',
                  isActive
                    ? 'bg-[#7C5CFF]/10 text-[#7C5CFF]'
                    : 'text-[#B3B7BE] hover:text-[#E6E8EB] hover:bg-[#2A2F37]'
                )}
              >
                {mode.icon}
                <span className="text-sm">{mode.label}</span>
                {isActive && (
                  <svg className="w-4 h-4 ml-auto text-[#7C5CFF]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}