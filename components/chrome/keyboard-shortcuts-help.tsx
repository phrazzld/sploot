'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: string;
}

/**
 * Terminal-style keyboard shortcuts help modal
 * Opens with ? key
 */
export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  if (!isOpen) return null;

  const shortcuts: ShortcutItem[] = [
    // Navigation
    { keys: ['⌘', 'K'], description: 'Command Palette', category: 'navigation' },
    { keys: ['/'], description: 'Search', category: 'navigation' },
    { keys: ['?'], description: 'Keyboard Shortcuts', category: 'navigation' },
    { keys: ['esc'], description: 'Close / Clear', category: 'navigation' },

    // View Modes
    { keys: ['1'], description: 'Grid View', category: 'view' },
    { keys: ['2'], description: 'List View', category: 'view' },

    // Navigation in Lists
    { keys: ['↑'], description: 'Navigate Up', category: 'lists' },
    { keys: ['↓'], description: 'Navigate Down', category: 'lists' },
    { keys: ['↵'], description: 'Select / Execute', category: 'lists' },
  ];

  const categories = [
    { id: 'navigation', label: 'NAVIGATION' },
    { id: 'view', label: 'VIEW MODES' },
    { id: 'lists', label: 'LIST NAVIGATION' },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Help Modal */}
      <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
        <div
          className={cn(
            'bg-black border border-[#1A1A1A]',
            'w-full max-w-2xl mx-4',
            'shadow-2xl shadow-[#7C5CFF]/10 animate-scale-in',
            'overflow-hidden'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#1A1A1A]">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-mono text-sm uppercase tracking-wider">
                Keyboard Shortcuts
              </h2>
              <button
                onClick={onClose}
                className="text-[#888888] hover:text-white transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Shortcuts List */}
          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
            {categories.map((category) => {
              const categoryShortcuts = shortcuts.filter(s => s.category === category.id);
              if (categoryShortcuts.length === 0) return null;

              return (
                <div key={category.id} className="mb-6 last:mb-0">
                  <h3 className="text-[#666666] font-mono text-xs uppercase tracking-wider mb-3">
                    {category.label}
                  </h3>
                  <div className="space-y-2">
                    {categoryShortcuts.map((shortcut, index) => (
                      <div
                        key={`${category.id}-${index}`}
                        className="flex items-center justify-between gap-4 py-2 px-3 bg-[#0A0A0A] hover:bg-[#111111] transition-colors"
                      >
                        <span className="text-[#888888] font-mono text-sm flex-1">
                          {shortcut.description}
                        </span>
                        <div className="flex items-center gap-1">
                          {shortcut.keys.map((key, keyIndex) => (
                            <span key={keyIndex} className="flex items-center gap-1">
                              <kbd
                                className={cn(
                                  'inline-flex items-center justify-center',
                                  'min-w-[28px] px-2 py-1',
                                  'bg-black border border-[#1A1A1A]',
                                  'text-white font-mono text-xs',
                                  'shadow-sm'
                                )}
                              >
                                {key}
                              </kbd>
                              {keyIndex < shortcut.keys.length - 1 && (
                                <span className="text-[#333333] font-mono text-xs mx-0.5">+</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-[#1A1A1A]">
            <p className="text-[#666666] font-mono text-xs">
              Press <kbd className="px-1.5 py-0.5 bg-[#0A0A0A] border border-[#1A1A1A] text-[#888888]">esc</kbd> or{' '}
              <kbd className="px-1.5 py-0.5 bg-[#0A0A0A] border border-[#1A1A1A] text-[#888888]">?</kbd> to close
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Hook to manage keyboard shortcuts help modal state
 */
export function useKeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);

  const openHelp = useCallback(() => setIsOpen(true), []);
  const closeHelp = useCallback(() => setIsOpen(false), []);
  const toggleHelp = useCallback(() => setIsOpen(prev => !prev), []);

  return {
    isOpen,
    openHelp,
    closeHelp,
    toggleHelp,
  };
}
