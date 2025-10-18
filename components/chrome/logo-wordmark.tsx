'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

interface LogoWordmarkProps {
  className?: string;
}

/**
 * Logo/Wordmark component for sploot
 * Simplified - just SVG + text, responsive sizing via Tailwind
 */
export function LogoWordmark({ className }: LogoWordmarkProps) {
  return (
    <Link
      href="/app"
      className={cn('inline-flex items-center gap-2', className)}
      aria-label="Sploot - Home"
    >
      {/* Logo icon */}
      <div className="flex items-center justify-center size-8 bg-primary border border-primary rounded-lg">
        <span className="font-mono font-bold text-primary-foreground text-xs">
          S
        </span>
      </div>

      {/* Wordmark - hidden on mobile */}
      <div className="hidden sm:flex flex-col">
        <span className="font-mono font-bold uppercase text-foreground tracking-wider leading-tight text-2xl hover:text-primary transition-colors">
          sploot
        </span>
      </div>

      {/* Mobile - just show 's' */}
      <span className="sm:hidden font-mono font-bold uppercase text-foreground tracking-wider text-xl">
        s
      </span>
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
        'flex items-center justify-center bg-primary border border-primary rounded-lg',
        className
      )}
      style={{ width: size, height: size }}
    >
      <span
        className="font-mono font-bold text-primary-foreground"
        style={{ fontSize: size * 0.4 }}
      >
        S
      </span>
    </div>
  );
}
