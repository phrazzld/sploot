'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuthActions, useAuthUser } from '@/lib/auth/client';
import { cn } from '@/lib/utils';
import { usePwaInstallPrompt } from '@/hooks/use-pwa-install';

type Position = 'sidebar' | 'navbar' | 'header' | 'footer';
type DropdownDirection = 'up' | 'down' | 'auto';
type DisplayMode = 'full' | 'compact' | 'avatar-only';

interface UserMenuFlexibleProps {
  position?: Position;
  dropdownDirection?: DropdownDirection;
  displayMode?: DisplayMode;
  className?: string;
}

export function UserMenuFlexible({
  position = 'sidebar',
  dropdownDirection = 'auto',
  displayMode = 'full',
  className,
}: UserMenuFlexibleProps) {
  const { signOut } = useAuthActions();
  const { user } = useAuthUser();
  const [isOpen, setIsOpen] = useState(false);
  const [actualDirection, setActualDirection] = useState<'up' | 'down'>('down');
  const { installable, promptInstall } = usePwaInstallPrompt();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auto-detect dropdown direction based on available space
  useEffect(() => {
    if (!isOpen || dropdownDirection !== 'auto' || !buttonRef.current) {
      if (dropdownDirection !== 'auto') {
        setActualDirection(dropdownDirection);
      }
      return;
    }

    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Default to down unless we're near the bottom or explicitly in footer
    if (position === 'footer' || (spaceBelow < 200 && spaceAbove > spaceBelow)) {
      setActualDirection('up');
    } else {
      setActualDirection('down');
    }
  }, [isOpen, dropdownDirection, position]);

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

  const handleSignOut = () => {
    signOut();
  };

  const handleInstallClick = async () => {
    const outcome = await promptInstall();
    if (outcome !== 'unavailable') {
      setIsOpen(false);
    }
  };

  // Determine button layout based on position and display mode
  const getButtonLayout = () => {
    const isHorizontal = position === 'navbar' || position === 'header';
    const showFullInfo = displayMode === 'full' && !isHorizontal;
    const showCompactInfo = displayMode === 'compact';

    return {
      isHorizontal,
      showFullInfo,
      showCompactInfo,
      showAvatarOnly: displayMode === 'avatar-only' || (displayMode === 'full' && isHorizontal),
    };
  };

  const layout = getButtonLayout();

  // Dropdown position classes
  const getDropdownClasses = () => {
    const base = 'absolute z-50 bg-[#14171A] border border-[#2A2F37] rounded-lg shadow-lg min-w-[200px]';

    if (actualDirection === 'up') {
      return cn(base, 'bottom-full mb-2', {
        'left-0': position === 'sidebar',
        'right-0': position === 'navbar' || position === 'header',
      });
    } else {
      return cn(base, 'top-full mt-2', {
        'left-0': position === 'sidebar',
        'right-0': position === 'navbar' || position === 'header',
      });
    }
  };

  // Button classes based on position
  const getButtonClasses = () => {
    return cn(
      'relative flex items-center gap-3 rounded-lg transition-all duration-200',
      'hover:bg-[#1B1F24] group',
      {
        'w-full px-3 py-2.5': position === 'sidebar',
        'px-2 py-1.5': position === 'navbar' || position === 'header',
        'px-3 py-2': position === 'footer',
      },
      className
    );
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={getButtonClasses()}
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-[#7C5CFF] flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
          {user?.firstName?.[0] || user?.username?.[0] || '?'}
        </div>

        {/* User info - only show in certain modes */}
        {(layout.showFullInfo || layout.showCompactInfo) && (
          <div className="flex-1 text-left min-w-0">
            <p className="text-[#E6E8EB] text-sm font-medium truncate">
              {user?.firstName || user?.username || 'User'}
            </p>
            {layout.showFullInfo && (
              <p className="text-[#B3B7BE] text-xs truncate">
                {user?.emailAddresses?.[0]?.emailAddress}
              </p>
            )}
          </div>
        )}

        {/* Dropdown arrow - only for full/compact modes */}
        {!layout.showAvatarOnly && (
          <svg
            className={cn(
              'w-4 h-4 text-[#B3B7BE] transition-transform duration-200 flex-shrink-0',
              isOpen && actualDirection === 'down' && 'rotate-180',
              isOpen && actualDirection === 'up' && 'rotate-180'
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={actualDirection === 'up' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
            />
          </svg>
        )}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div ref={dropdownRef} className={getDropdownClasses()}>
          {/* User email header */}
          <div className="p-3 border-b border-[#2A2F37]">
            <p className="text-[#E6E8EB] text-sm font-medium">
              {user?.firstName || user?.username || 'User'}
            </p>
            <p className="text-[#B3B7BE] text-xs truncate">
              {user?.emailAddresses?.[0]?.emailAddress}
            </p>
          </div>

          {/* Install app option */}
          {installable && (
            <button
              onClick={handleInstallClick}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-[#B3B7BE] hover:text-[#E6E8EB] hover:bg-[#1B1F24] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v9m0 0l-3-3m3 3l3-3m6 4v4a1 1 0 01-1 1H6a1 1 0 01-1-1v-4" />
              </svg>
              <span className="text-sm">Install app</span>
            </button>
          )}

          {/* Sign out option */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-[#B3B7BE] hover:text-[#E6E8EB] hover:bg-[#1B1F24] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="text-sm">Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}