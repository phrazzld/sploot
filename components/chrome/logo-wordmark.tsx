'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

interface LogoWordmarkProps {
  variant?: 'default' | 'compact' | 'icon-only';
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  className?: string;
  linkClassName?: string;
}

/**
 * Logo/Wordmark component for sploot
 * Consistent branding across navbar, sidebar, and other locations
 */
export function LogoWordmark({
  variant = 'default',
  size = 'md',
  showTagline = false,
  className,
  linkClassName,
}: LogoWordmarkProps) {
  // Size configurations
  const sizeConfig = {
    sm: {
      icon: 'w-6 h-6',
      text: 'text-xl',
      tagline: 'text-[10px]',
      gap: 'gap-1.5',
    },
    md: {
      icon: 'w-8 h-8',
      text: 'text-2xl',
      tagline: 'text-xs',
      gap: 'gap-2',
    },
    lg: {
      icon: 'w-10 h-10',
      text: 'text-3xl',
      tagline: 'text-sm',
      gap: 'gap-3',
    },
  };

  const config = sizeConfig[size];

  // Icon SVG component (can be replaced with actual logo)
  const LogoIcon = () => (
    <div
      className={cn(
        'flex items-center justify-center rounded-lg',
        'bg-gradient-to-br from-[#7C5CFF] to-[#B6FF6E]',
        config.icon
      )}
    >
      <span className="text-white font-bold text-xs">S</span>
    </div>
  );

  // Render based on variant
  const renderLogo = () => {
    switch (variant) {
      case 'icon-only':
        return (
          <div className={cn('flex items-center', className)}>
            <LogoIcon />
          </div>
        );

      case 'compact':
        return (
          <div className={cn('flex items-center', config.gap, className)}>
            <LogoIcon />
            <span
              className={cn(
                'font-bold text-[#E6E8EB] tracking-wider lowercase',
                config.text
              )}
            >
              s
            </span>
          </div>
        );

      default:
        return (
          <div className={cn('flex items-center', config.gap, className)}>
            <LogoIcon />
            <div className="flex flex-col">
              <span
                className={cn(
                  'font-bold text-[#E6E8EB] tracking-wider lowercase leading-tight',
                  config.text,
                  'hover:text-[#7C5CFF] transition-colors'
                )}
              >
                sploot
              </span>
              {showTagline && (
                <span className={cn('text-[#B3B7BE] mt-0.5', config.tagline)}>
                  Your meme library
                </span>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <Link
      href="/app"
      className={cn(
        'inline-flex items-center group',
        'transition-all duration-200',
        'hover:opacity-90',
        linkClassName
      )}
      aria-label="Sploot - Home"
    >
      {renderLogo()}
    </Link>
  );
}

/**
 * Standalone logo icon component
 * Useful for loading states, favicons, or icon-only contexts
 */
export function LogoIcon({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-lg',
        'bg-gradient-to-br from-[#7C5CFF] to-[#B6FF6E]',
        className
      )}
      style={{ width: size, height: size }}
    >
      <span
        className="text-white font-bold"
        style={{ fontSize: size * 0.4 }}
      >
        S
      </span>
    </div>
  );
}