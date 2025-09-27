'use client';

import { ReactNode } from 'react';
import { LogoWordmark } from './logo-wordmark';
import { SearchBarElastic } from './search-bar-elastic';
import { cn } from '@/lib/utils';

interface NavbarProps {
  children?: ReactNode;
  className?: string;
}

/**
 * Fixed navbar component for the new architecture
 * Height: 56px (14 * 4px base unit)
 * Position: Fixed top
 * Z-index: 50 (stays above main content)
 */
export function Navbar({ children, className }: NavbarProps) {
  return (
    <nav
      className={cn(
        // Fixed positioning
        'fixed top-0 left-0 right-0',
        // Z-index to stay above content
        'z-50',
        // Height: 56px
        'h-14',
        // Background and border
        'bg-[#14171A] border-b border-[#2A2F37]',
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
      {/* Container for navbar content */}
      <div className="flex items-center justify-between w-full max-w-screen-2xl mx-auto">
        {/* Left section: Logo/Wordmark */}
        <div className="flex items-center gap-4">
          <LogoWordmark
            variant="default"
            size="md"
            showTagline={false}
          />
        </div>

        {/* Center section: Search bar */}
        <div className="flex-1 flex items-center justify-center px-4">
          <SearchBarElastic
            collapsedWidth={200}
            expandedWidth={400}
            placeholder="Search your memes..."
            className="max-w-xl"
          />
        </div>

        {/* Right section: Actions and user menu */}
        <div className="flex items-center gap-3">
          {/* View mode toggles will go here */}

          {/* Upload button will go here */}

          {/* User avatar/menu will go here */}
        </div>

        {/* Allow children to be passed for flexibility during development */}
        {children}
      </div>
    </nav>
  );
}

/**
 * Spacer component to push content below the fixed navbar
 * Use this in layouts to prevent content from going under the navbar
 */
export function NavbarSpacer() {
  return <div className="h-14" />;
}