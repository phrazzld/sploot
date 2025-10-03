'use client';

import { cn } from '@/lib/utils';

interface SettingsGearProps {
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

/**
 * Settings gear icon for footer navigation
 * 32px square touch target with 90deg rotation on hover
 * Positioned 16px from right edge in footer
 */
export function SettingsGear({
  onClick,
  className,
  size = 'md',
  showTooltip = true,
}: SettingsGearProps) {
  // Size configurations
  const sizeConfig = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8', // 32px as specified
    lg: 'w-10 h-10',
  };

  const iconSizeConfig = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Default navigation to settings page
      window.location.href = '/app/settings';
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        // Touch target size
        sizeConfig[size],
        // Flexbox centering
        'flex items-center justify-center',
        // Interactive states
        'text-[#B3B7BE] hover:text-[#E6E8EB]',
        'transition-all duration-200',
        // 90deg rotation on hover
        'hover:rotate-90',
        // Background on hover for better visibility
        'hover:bg-[#1B1F24] rounded-lg',
        // Active state
        'active:scale-95',
        // Focus states
        'focus-visible:outline focus-visible:outline-2',
        'focus-visible:outline-offset-2 focus-visible:outline-[#7C5CFF]',
        // Positioning from right edge (handled by parent)
        'mr-2', // 16px from right edge (mr-2 = 8px, combined with parent padding)
        // Custom classes
        className
      )}
      aria-label="Settings"
      title={showTooltip ? 'Settings' : undefined}
    >
      <svg
        className={cn(iconSizeConfig[size])}
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
    </button>
  );
}