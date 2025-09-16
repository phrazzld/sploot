'use client';

import { useState } from 'react';
import { useAuthActions, useAuthUser } from '@/lib/auth/client';
import { cn } from '@/lib/utils';

interface UserMenuProps {
  variant?: 'desktop' | 'mobile';
}

export function UserMenu({ variant = 'desktop' }: UserMenuProps) {
  const { signOut } = useAuthActions();
  const { user } = useAuthUser();
  const [isOpen, setIsOpen] = useState(false);

  const handleSignOut = () => {
    signOut();
  };

  if (variant === 'mobile') {
    return (
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
      >
        <div className="w-8 h-8 rounded-full bg-[#7C5CFF] flex items-center justify-center text-white font-medium text-sm">
          {user?.firstName?.[0] || user?.username?.[0] || '?'}
        </div>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute right-0 top-10 w-48 bg-[#14171A] border border-[#2A2F37] rounded-lg shadow-lg z-50">
              <div className="p-3 border-b border-[#2A2F37]">
                <p className="text-[#E6E8EB] text-sm font-medium truncate">
                  {user?.emailAddresses?.[0]?.emailAddress}
                </p>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full text-left px-3 py-2 text-[#B3B7BE] hover:text-[#E6E8EB] hover:bg-[#1B1F24] transition-colors text-sm"
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
          'hover:bg-[#1B1F24] group'
        )}
      >
        <div className="w-8 h-8 rounded-full bg-[#7C5CFF] flex items-center justify-center text-white font-medium text-sm">
          {user?.firstName?.[0] || user?.username?.[0] || '?'}
        </div>
        <div className="flex-1 text-left">
          <p className="text-[#E6E8EB] text-sm font-medium">
            {user?.firstName || user?.username || 'User'}
          </p>
          <p className="text-[#B3B7BE] text-xs truncate">
            {user?.emailAddresses?.[0]?.emailAddress}
          </p>
        </div>
        <svg
          className={cn(
            'w-4 h-4 text-[#B3B7BE] transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#14171A] border border-[#2A2F37] rounded-lg shadow-lg z-50">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-[#B3B7BE] hover:text-[#E6E8EB] hover:bg-[#1B1F24] transition-colors rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="text-sm font-medium">Sign out</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
