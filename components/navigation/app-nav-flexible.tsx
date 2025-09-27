'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  {
    label: 'Dashboard',
    href: '/app',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h7v9H3zM14 3h7v5h-7zM14 11h7v10h-7zM3 15h7v6H3z" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    href: '/app/settings',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export type AppNavDirection = 'vertical' | 'horizontal';
export type AppNavSize = 'sm' | 'md' | 'lg';
export type AppNavDisplayMode = 'full' | 'compact' | 'icon-only';

interface AppNavFlexibleProps {
  direction?: AppNavDirection;
  size?: AppNavSize;
  displayMode?: AppNavDisplayMode;
  className?: string;
  itemClassName?: string;
  showActiveIndicator?: boolean;
}

export function AppNavFlexible({
  direction = 'vertical',
  size = 'md',
  displayMode = 'full',
  className,
  itemClassName,
  showActiveIndicator = true,
}: AppNavFlexibleProps) {
  const pathname = usePathname();

  // Size configurations
  const sizeConfig = {
    sm: {
      padding: 'px-2 py-1.5',
      iconSize: 'w-4 h-4',
      gap: 'gap-2',
      fontSize: 'text-sm',
    },
    md: {
      padding: 'px-3 py-2.5',
      iconSize: 'w-5 h-5',
      gap: 'gap-3',
      fontSize: 'text-base',
    },
    lg: {
      padding: 'px-4 py-3',
      iconSize: 'w-6 h-6',
      gap: 'gap-4',
      fontSize: 'text-lg',
    },
  };

  const config = sizeConfig[size];

  // Container classes based on direction
  const containerClasses = cn(
    direction === 'vertical'
      ? 'space-y-1'
      : 'flex items-center space-x-2',
    className
  );

  // Icon-only mode adjustments
  const isIconOnly = displayMode === 'icon-only';
  const iconOnlyPadding = size === 'sm' ? 'p-1.5' : size === 'md' ? 'p-2' : 'p-2.5';

  return (
    <nav className={containerClasses}>
      {navItems.map((item) => {
        const isActive = pathname === item.href ||
                        (item.href !== '/app' && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center rounded-lg transition-all duration-200',
              'hover:bg-[#1B1F24] group',
              isIconOnly ? iconOnlyPadding : `${config.padding} ${config.gap}`,
              direction === 'vertical' && !isIconOnly && 'w-full',
              // Add relative positioning for absolute indicator
              (isIconOnly || direction === 'horizontal') && 'relative',
              isActive ?
                'bg-[#7C5CFF] text-white hover:bg-[#7C5CFF]/90' :
                'text-[#B3B7BE] hover:text-[#E6E8EB]',
              itemClassName
            )}
            title={isIconOnly ? item.label : undefined}
          >
            <span className={cn(
              'transition-colors flex-shrink-0',
              config.iconSize,
              isActive ? 'text-white' : 'text-[#B3B7BE] group-hover:text-[#7C5CFF]'
            )}>
              {item.icon}
            </span>

            {!isIconOnly && displayMode !== 'compact' && (
              <span className={cn('font-medium', config.fontSize)}>
                {item.label}
              </span>
            )}

            {displayMode === 'compact' && !isIconOnly && (
              <span className={cn('font-medium text-xs')}>
                {item.label.slice(0, 3)}
              </span>
            )}

            {showActiveIndicator && isActive && !isIconOnly && direction === 'vertical' && (
              <div className="ml-auto w-1 h-4 bg-[#B6FF6E] rounded-full" />
            )}

            {showActiveIndicator && isActive && (isIconOnly || direction === 'horizontal') && (
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-4 h-0.5 bg-[#B6FF6E] rounded-full" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}