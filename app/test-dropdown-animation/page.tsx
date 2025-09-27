'use client';

import { useState } from 'react';
import { UserAvatar } from '@/components/chrome/user-avatar';
import { SortDropdown } from '@/components/chrome/sort-dropdown';
import { ViewModeDropdown } from '@/components/chrome/view-mode-dropdown';
import { cn } from '@/lib/utils';

export default function TestDropdownAnimationPage() {
  const [animationSpeed, setAnimationSpeed] = useState<'normal' | 'slow' | 'very-slow'>('normal');
  const [viewMode, setViewMode] = useState<'grid' | 'masonry' | 'list'>('grid');
  const [sortValue, setSortValue] = useState<'recent' | 'date' | 'size' | 'name'>('recent');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [dropdownOpenCount, setDropdownOpenCount] = useState(0);

  // Override animation speeds for testing
  const animationClass =
    animationSpeed === 'slow' ? '[&_.dropdown-animate-in]:!duration-[500ms] [&_.dropdown-animate-in-up]:!duration-[500ms]' :
    animationSpeed === 'very-slow' ? '[&_.dropdown-animate-in]:!duration-[1500ms] [&_.dropdown-animate-in-up]:!duration-[1500ms]' :
    '';

  return (
    <div className={cn('min-h-screen bg-[#0A0B0D] text-[#E6E8EB] p-8', animationClass)}>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-4">Dropdown Animation Test</h1>
          <p className="text-[#B3B7BE]">
            Testing 140ms fade-in with 4px translateY animation for dropdown menus
          </p>
        </div>

        {/* Animation Speed Control */}
        <div className="p-4 bg-[#14171A] border border-[#2A2F37] rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Animation Speed (for testing)</h2>
          <div className="flex gap-2">
            {(['normal', 'slow', 'very-slow'] as const).map((speed) => (
              <button
                key={speed}
                onClick={() => setAnimationSpeed(speed)}
                className={cn(
                  'px-3 py-1.5 rounded-lg transition-colors',
                  animationSpeed === speed
                    ? 'bg-[#7C5CFF] text-white'
                    : 'bg-[#1B1F24] hover:bg-[#2A2F37] text-[#B3B7BE]'
                )}
              >
                {speed === 'normal' ? 'Normal (140ms)' :
                 speed === 'slow' ? 'Slow (500ms)' : 'Very Slow (1500ms)'}
              </button>
            ))}
          </div>
        </div>

        {/* Dropdown Examples */}
        <div className="space-y-8">
          {/* User Avatar Dropdown (opens downward) */}
          <section className="p-6 bg-[#14171A] border border-[#2A2F37] rounded-lg">
            <h2 className="text-xl font-semibold mb-4">User Avatar Dropdown</h2>
            <p className="text-sm text-[#B3B7BE] mb-6">Opens downward with translateY(-4px) → 0</p>
            <div
              className="flex justify-center"
              onClick={() => setDropdownOpenCount(c => c + 1)}
            >
              <UserAvatar
                avatarSize="lg"
                showDropdown={true}
                onSignOut={() => console.log('Sign out clicked')}
              />
            </div>
            <div className="mt-4 text-center text-xs text-[#B3B7BE]">
              Click the avatar to see the dropdown animation
            </div>
          </section>

          {/* Sort Dropdown (opens upward from footer) */}
          <section className="p-6 bg-[#14171A] border border-[#2A2F37] rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Sort Dropdown</h2>
            <p className="text-sm text-[#B3B7BE] mb-6">Opens upward with translateY(4px) → 0 (for footer placement)</p>
            <div
              className="flex justify-center"
              onClick={() => setDropdownOpenCount(c => c + 1)}
            >
              <SortDropdown
                value={sortValue}
                direction={sortDirection}
                onChange={(option, dir) => {
                  setSortValue(option);
                  setSortDirection(dir);
                }}
              />
            </div>
            <div className="mt-4 text-center text-xs text-[#B3B7BE]">
              Current: {sortValue} {sortDirection === 'desc' ? '↓' : '↑'}
            </div>
          </section>

          {/* View Mode Dropdown (opens downward) */}
          <section className="p-6 bg-[#14171A] border border-[#2A2F37] rounded-lg">
            <h2 className="text-xl font-semibold mb-4">View Mode Dropdown</h2>
            <p className="text-sm text-[#B3B7BE] mb-6">Opens downward with translateY(-4px) → 0</p>
            <div
              className="flex justify-center"
              onClick={() => setDropdownOpenCount(c => c + 1)}
            >
              <ViewModeDropdown
                value={viewMode}
                onChange={setViewMode}
              />
            </div>
            <div className="mt-4 text-center text-xs text-[#B3B7BE]">
              Current: {viewMode} view
            </div>
          </section>
        </div>

        {/* Stats */}
        <div className="p-4 bg-[#14171A] border border-[#2A2F37] rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Interaction Stats</h2>
          <p className="text-sm text-[#B3B7BE]">
            Dropdown interactions: <span className="text-[#7C5CFF] font-mono">{dropdownOpenCount}</span>
          </p>
        </div>

        {/* Technical Details */}
        <div className="p-6 bg-[#14171A] border border-[#7C5CFF]/30 rounded-lg">
          <h2 className="text-xl font-semibold text-[#7C5CFF] mb-4">Animation Details</h2>
          <div className="space-y-3 text-[#B3B7BE]">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold text-[#E6E8EB]">Duration:</p>
                <code className="text-[#B6FF6E]">140ms</code>
              </div>
              <div>
                <p className="font-semibold text-[#E6E8EB]">Transform:</p>
                <code className="text-[#B6FF6E]">translateY(±4px)</code>
              </div>
              <div>
                <p className="font-semibold text-[#E6E8EB]">Opacity:</p>
                <code className="text-[#B6FF6E]">0 → 1</code>
              </div>
              <div>
                <p className="font-semibold text-[#E6E8EB]">Easing:</p>
                <code className="text-[#B6FF6E]">cubic-bezier(0.16, 1, 0.3, 1)</code>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-[#2A2F37]">
              <p className="text-sm mb-2">Animation Behavior:</p>
              <ul className="ml-4 space-y-1 text-sm list-disc">
                <li><strong>Fade-in:</strong> Opacity transitions from 0 to 1</li>
                <li><strong>Slide:</strong> 4px translateY for subtle motion</li>
                <li><strong>Direction:</strong> Downward for navbar dropdowns, upward for footer</li>
                <li><strong>Speed:</strong> 140ms for snappy, responsive feel</li>
                <li><strong>Easing:</strong> Fast start with gentle ease-out for natural motion</li>
              </ul>
            </div>

            <div className="mt-4 pt-4 border-t border-[#2A2F37]">
              <p className="text-sm mb-2">CSS Classes:</p>
              <ul className="ml-4 space-y-1 text-sm font-mono">
                <li><span className="text-[#B6FF6E]">.dropdown-animate-in</span> - For downward opening menus</li>
                <li><span className="text-[#B6FF6E]">.dropdown-animate-in-up</span> - For upward opening menus (footer)</li>
                <li><span className="text-[#B6FF6E]">.dropdown-animate-out</span> - Reverse animation on close</li>
                <li><span className="text-[#B6FF6E]">.dropdown-animate-out-up</span> - Reverse for upward menus</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}