'use client';

import { ReactNode, useState } from 'react';
import { LogoWordmark } from './logo-wordmark';
import { SearchBarElastic, SearchTrigger } from './search-bar-elastic';
import { ViewModeToggle, type ViewMode } from './view-mode-toggle';
import { ViewModeDropdown } from './view-mode-dropdown';
import { SearchOverlay } from './search-overlay';
import { UploadButton } from './upload-button';
import { UserAvatar } from './user-avatar';
import { cn } from '@/lib/utils';

interface NavbarProps {
  children?: ReactNode;
  className?: string;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  showViewToggle?: boolean;
  onUploadClick?: () => void;
  isUploadActive?: boolean;
  showUploadButton?: boolean;
  showUserAvatar?: boolean;
  onSignOut?: () => void;
}

/**
 * Fixed navbar component for the new architecture
 * Height: 56px (14 * 4px base unit)
 * Position: Fixed top
 * Z-index: 50 (stays above main content)
 */
export function Navbar({
  children,
  className,
  viewMode = 'grid',
  onViewModeChange,
  showViewToggle = true,
  onUploadClick,
  isUploadActive = false,
  showUploadButton = true,
  showUserAvatar = true,
  onSignOut,
}: NavbarProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <>
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
        // Padding - progressive increase for larger screens
        'px-4 md:px-6 lg:px-8',
        // Custom classes
        className
      )}
    >
      {/* Container for navbar content */}
      <div className="flex items-center justify-between w-full max-w-screen-2xl mx-auto">
        {/* Left section: Logo/Wordmark */}
        <div className="flex items-center gap-4">
          {/* Mobile: Compact logo */}
          <div className="block sm:hidden">
            <LogoWordmark
              variant="compact"
              size="sm"
              showTagline={false}
            />
          </div>
          {/* Desktop: Full logo */}
          <div className="hidden sm:block">
            <LogoWordmark
              variant="default"
              size="md"
              showTagline={false}
              className="lg:scale-110" // Slightly larger on desktop
            />
          </div>
        </div>

        {/* Center section: Search bar - hidden on mobile, visible on tablets+ */}
        <div className="hidden sm:flex flex-1 items-center justify-center px-4">
          <SearchBarElastic
            collapsedWidth={200}
            expandedWidth={400}
            placeholder="Search your memes..."
            className="max-w-xl md:max-w-2xl lg:max-w-3xl" // Progressive max-width increase
          />
        </div>

        {/* Mobile: Search trigger icon */}
        <div className="flex sm:hidden flex-1 items-center justify-center">
          <SearchTrigger
            onClick={() => setIsSearchOpen(true)}
          />
        </div>

        {/* Right section: Actions and user menu */}
        <div className="flex items-center gap-3">
          {/* Desktop: View mode toggles */}
          {showViewToggle && onViewModeChange && (
            <>
              {/* Desktop view toggles - hidden on mobile */}
              <div className="hidden sm:block">
                <ViewModeToggle
                  value={viewMode}
                  onChange={onViewModeChange}
                  size="md"
                  className="lg:scale-110" // Slightly larger on desktop for better visibility
                />
              </div>

              {/* Mobile view dropdown - visible only on mobile */}
              <div className="block sm:hidden">
                <ViewModeDropdown
                  value={viewMode}
                  onChange={onViewModeChange}
                />
              </div>
            </>
          )}

          {/* Upload button */}
          {showUploadButton && (
            <>
              {/* Mobile: Icon only */}
              <div className="block sm:hidden">
                <UploadButton
                  onClick={onUploadClick}
                  isActive={isUploadActive}
                  size="md"
                  showLabel={false}
                />
              </div>
              {/* Desktop: With label */}
              <div className="hidden sm:block">
                <UploadButton
                  onClick={onUploadClick}
                  isActive={isUploadActive}
                  size="md"
                  showLabel={true}
                />
              </div>
            </>
          )}

          {/* User avatar - 32px circle with 8px margin from right edge */}
          {showUserAvatar && (
            <UserAvatar
              className="mr-2"  // 8px margin from right edge
              avatarSize="md"   // 32px size
              showDropdown={true}
              onSignOut={onSignOut}
            />
          )}
        </div>

        {/* Allow children to be passed for flexibility during development */}
        {children}
      </div>
    </nav>

      {/* Search overlay for mobile */}
      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </>
  );
}

/**
 * Spacer component to push content below the fixed navbar
 * Use this in layouts to prevent content from going under the navbar
 */
export function NavbarSpacer() {
  return <div className="h-14" />;
}