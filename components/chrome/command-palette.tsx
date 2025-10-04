'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface CommandItem {
  id: string;
  label: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload?: () => void;
  onSignOut?: () => void;
}

/**
 * Command palette for quick actions
 * Opens with ⌘K / Ctrl+K
 */
export function CommandPalette({
  isOpen,
  onClose,
  onUpload,
  onSignOut,
}: CommandPaletteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Define commands
  const allCommands: CommandItem[] = [
    {
      id: 'upload',
      label: 'Upload Images',
      shortcut: 'U',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      ),
      action: () => {
        onClose();
        if (onUpload) {
          onUpload();
        } else {
          router.push('/app/upload');
        }
      },
    },
    {
      id: 'settings',
      label: 'Settings',
      shortcut: 'S',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      action: () => {
        onClose();
        router.push('/app/settings');
      },
    },
    {
      id: 'search',
      label: 'Search',
      shortcut: '/',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
      action: () => {
        onClose();
        // Focus search bar after closing
        setTimeout(() => {
          const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
          searchInput?.focus();
        }, 100);
      },
    },
    {
      id: 'home',
      label: 'Go to Home',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      action: () => {
        onClose();
        router.push('/app');
      },
    },
    {
      id: 'signout',
      label: 'Sign Out',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      ),
      action: () => {
        onClose();
        if (onSignOut) {
          onSignOut();
        } else {
          // Default sign out behavior
          window.location.href = '/api/auth/signout';
        }
      },
    },
  ];

  // Filter commands based on search query
  const filteredCommands = allCommands.filter((cmd) =>
    cmd.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Reset selected index when search query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Focus input when palette opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setSearchQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
          }
          break;
        default:
          // Handle shortcut keys
          if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
            const command = allCommands.find(
              (cmd) => cmd.shortcut?.toLowerCase() === e.key.toLowerCase()
            );
            if (command) {
              e.preventDefault();
              command.action();
            }
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, filteredCommands, selectedIndex, allCommands]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Command palette */}
      <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]">
        <div
          className={cn(
            'bg-black border border-[#1A1A1A]',
            'w-full max-w-lg mx-4',
            'shadow-2xl shadow-[#7C5CFF]/10 animate-scale-in',
            'overflow-hidden'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search input */}
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none font-mono text-[var(--color-terminal-green)]">
              &gt;
            </div>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type a command or search..."
              className={cn(
                'w-full px-8 py-4',
                'bg-transparent text-white font-mono',
                'placeholder:text-[#888888]',
                'focus:outline-none',
                'text-sm'
              )}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          {/* Divider */}
          <div className="h-px bg-[#1A1A1A]" />

          {/* Commands list */}
          <div className="max-h-96 overflow-y-auto py-2">
            {filteredCommands.length > 0 ? (
              filteredCommands.map((command, index) => (
                <button
                  key={command.id}
                  onClick={command.action}
                  className={cn(
                    'w-full px-4 py-2.5',
                    'flex items-center gap-3',
                    'text-left transition-colors font-mono text-sm',
                    selectedIndex === index
                      ? 'bg-[var(--color-terminal-green)]/10 text-white border-l-2 border-[var(--color-terminal-green)]'
                      : 'text-[#888888] hover:text-white hover:bg-[#0A0A0A] border-l-2 border-transparent'
                  )}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span className={cn(
                    'flex-shrink-0 hidden',
                    selectedIndex === index && 'text-[var(--color-terminal-green)]'
                  )}>
                    {command.icon}
                  </span>
                  <span className="flex-1">{command.label}</span>
                  {command.shortcut && (
                    <span className={cn(
                      'flex-shrink-0 text-xs',
                      'px-2 py-0.5',
                      'text-[#666666]',
                      'font-mono'
                    )}>
                      {command.shortcut}
                    </span>
                  )}
                </button>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-[#888888] text-sm font-mono">
                No commands found
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="h-px bg-[#1A1A1A]" />
          <div className="px-4 py-3 flex items-center justify-between text-xs text-[#666666] font-mono">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[#0A0A0A] border border-[#1A1A1A] text-[#888888]">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-[#0A0A0A] border border-[#1A1A1A] text-[#888888]">↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[#0A0A0A] border border-[#1A1A1A] text-[#888888]">↵</kbd>
                select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[#0A0A0A] border border-[#1A1A1A] text-[#888888]">esc</kbd>
                close
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Hook to manage command palette state
 */
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  const openPalette = useCallback(() => setIsOpen(true), []);
  const closePalette = useCallback(() => setIsOpen(false), []);
  const togglePalette = useCallback(() => setIsOpen(prev => !prev), []);

  return {
    isOpen,
    openPalette,
    closePalette,
    togglePalette,
  };
}