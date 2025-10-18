'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useSpringScale } from '@/hooks/use-spring-animation';

interface UploadButtonProps {
  onClick?: () => void;
  isActive?: boolean;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Upload button component for the navbar
 * Fixed 100px width with primary accent background
 */
export function UploadButton({
  onClick,
  isActive = false,
  className,
  showLabel = true,
  size = 'md',
}: UploadButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  // Spring physics for scale animation
  const scale = useSpringScale(isHovered, isPressed);

  const sizeConfig = {
    sm: {
      height: 'h-8',
      padding: showLabel ? 'px-3' : 'px-2',
      icon: 'w-4 h-4',
      gap: 'gap-1.5',
      fontSize: 'text-xs',
    },
    md: {
      height: 'h-9',
      padding: showLabel ? 'px-4' : 'px-3',
      icon: 'w-5 h-5',
      gap: 'gap-2',
      fontSize: 'text-sm',
    },
    lg: {
      height: 'h-10',
      padding: showLabel ? 'px-6' : 'px-4',
      icon: 'w-5 h-5',
      gap: 'gap-2',
      fontSize: 'text-sm',
    },
  };

  const config = sizeConfig[size];

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      style={{
        transform: `scale(${scale})`,
      }}
      className={cn(
        // Base styles
        'group relative flex items-center justify-center',
        'rounded-md font-medium transition-colors duration-200',

        // Fixed width as specified
        showLabel && 'w-[100px]',

        // Size
        config.height,
        config.padding,

        // Colors - Primary accent (#B6FF6E) background
        isActive
          ? 'bg-[#B6FF6E]/20 text-[#B6FF6E] ring-1 ring-[#B6FF6E]/40'
          : 'bg-[#B6FF6E] text-[#0B0C0E] hover:bg-[#C5FF85] active:bg-[#A8F060]',

        // Shadow effects (keep transition for shadow)
        'hover:shadow-lg hover:shadow-[#B6FF6E]/20',

        // Focus states
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        'focus-visible:outline-[#B6FF6E]',

        // Touch optimization
        'touch-manipulation',

        // Custom classes
        className
      )}
      aria-label={showLabel ? undefined : 'Upload'}
      title={showLabel ? undefined : 'Upload new meme'}
    >
      {/* Upload icon */}
      <svg
        className={cn(
          config.icon,
          showLabel && '-ml-0.5'
        )}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 4v16m8-8H4"
        />
      </svg>

      {showLabel && (
        <span className={cn(config.fontSize, 'font-semibold')}>
          upload
        </span>
      )}

      {/* Pulse animation when active */}
      {isActive && (
        <div className="absolute inset-0 bg-[#B6FF6E]/10 animate-pulse" />
      )}
    </button>
  );
}

/**
 * Floating upload button for mobile or alternative layouts
 * Can be positioned absolutely or fixed
 */
export function UploadButtonFloating({
  onClick,
  className,
}: {
  onClick?: () => void;
  className?: string;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  // Spring physics with slightly bouncier config for floating button
  const scale = useSpringScale(isHovered, isPressed, {
    stiffness: 350,
    damping: 20,
    mass: 0.8,
  });

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      style={{
        transform: `scale(${scale})`,
      }}
      className={cn(
        'flex items-center justify-center',
        'w-14 h-14 rounded-md',
        'bg-[#B6FF6E] text-[#0B0C0E]',
        'hover:bg-[#C5FF85] active:bg-[#A8F060]',
        'shadow-lg hover:shadow-xl',
        'transition-colors transition-shadow duration-200',
        'group',
        className
      )}
      aria-label="Upload new meme"
    >
      <svg
        className="w-7 h-7 transition-transform duration-200 group-hover:rotate-90"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 4v16m8-8H4"
        />
      </svg>
    </button>
  );
}