'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuthActions, useAuthUser } from '@/lib/auth/client';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  className?: string;
  avatarSize?: 'sm' | 'md' | 'lg';
  showDropdown?: boolean;
  onSignOut?: () => void;
}

/**
 * User avatar component for the navbar
 * 32px circle with dropdown functionality
 */
export function UserAvatar({
  className,
  avatarSize = 'md',
  showDropdown = true,
  onSignOut,
}: UserAvatarProps) {
  const { signOut } = useAuthActions();
  const { user } = useAuthUser();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Avatar size configurations
  const sizeConfig = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-8 h-8 text-sm', // 32px as specified
    lg: 'w-10 h-10 text-base',
  };

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

  const handleSignOut = async () => {
    setIsOpen(false);
    if (onSignOut) {
      onSignOut();
    } else {
      await signOut();
    }
  };

  const getUserInitial = () => {
    return user?.firstName?.[0] || user?.username?.[0] || '?';
  };

  const getUserDisplay = () => {
    return user?.firstName || user?.username || 'User';
  };

  const getUserEmail = () => {
    return user?.emailAddresses?.[0]?.emailAddress || '';
  };

  return (
    <div className={cn('relative', className)}>
      <button
        ref={buttonRef}
        onClick={() => showDropdown && setIsOpen(!isOpen)}
        className={cn(
          // Avatar square
          'bg-[var(--color-terminal-green)] border border-[var(--color-terminal-green)]',
          'flex items-center justify-center',
          'font-mono text-black font-bold',
          'focus-visible:outline focus-visible:outline-2',
          'focus-visible:outline-offset-2 focus-visible:outline-[var(--color-terminal-green)]',
          sizeConfig[avatarSize],
          showDropdown && 'cursor-pointer'
        )}
        aria-label="User menu"
        title={getUserDisplay()}
      >
        {getUserInitial()}
      </button>

      {/* Dropdown menu */}
      {showDropdown && isOpen && (
        <div
          ref={dropdownRef}
          className={cn(
            'absolute right-0 z-50',
            'mt-1', // 4px gap
            'bg-black border border-[#333333]',
            'min-w-[200px]'
          )}
        >
          {/* User info header */}
          <div className="p-3 border-b border-[#333333]">
            <p className="font-mono text-sm uppercase text-[#E6E8EB]">
              {getUserDisplay()}
            </p>
            <p className="font-mono text-xs text-[#888888] truncate">
              {getUserEmail()}
            </p>
          </div>

          {/* Menu items */}
          <div className="py-1">
            {/* Settings */}
            <button
              onClick={() => {
                setIsOpen(false);
                // Navigate to settings
                window.location.href = '/app/settings';
              }}
              className={cn(
                'w-full flex items-center gap-3',
                'px-3 py-2',
                'font-mono text-xs uppercase text-[#888888]',
                'hover:text-[var(--color-terminal-green)] hover:bg-[#0F1012]'
              )}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span>Settings</span>
            </button>

            {/* Sign out */}
            <button
              onClick={handleSignOut}
              className={cn(
                'w-full flex items-center gap-3',
                'px-3 py-2',
                'font-mono text-xs uppercase text-[#888888]',
                'hover:text-[var(--color-terminal-red)] hover:bg-[#0F1012]'
              )}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Simple avatar display without dropdown
 * Useful for displaying user avatar in other contexts
 */
export function AvatarDisplay({
  size = 'md',
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const { user } = useAuthUser();

  const sizeConfig = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  };

  const getUserInitial = () => {
    return user?.firstName?.[0] || user?.username?.[0] || '?';
  };

  return (
    <div
      className={cn(
        'bg-[var(--color-terminal-green)] border border-[var(--color-terminal-green)]',
        'flex items-center justify-center',
        'font-mono text-black font-bold',
        sizeConfig[size],
        className
      )}
    >
      {getUserInitial()}
    </div>
  );
}