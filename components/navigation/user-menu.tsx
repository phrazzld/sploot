'use client';

import { UserMenuFlexible } from './user-menu-flexible';

interface UserMenuProps {
  variant?: 'desktop' | 'mobile';
  position?: 'sidebar' | 'navbar' | 'header' | 'footer';
  className?: string;
}

/**
 * Backward-compatible UserMenu component
 * Delegates to UserMenuFlexible with appropriate settings based on variant
 */
export function UserMenu({ variant = 'desktop', position, className }: UserMenuProps) {
  // Map old variant prop to new position-agnostic props
  if (variant === 'mobile') {
    return (
      <UserMenuFlexible
        position={position || 'header'}
        displayMode="avatar-only"
        dropdownDirection="down"
        className={className}
      />
    );
  }

  // Desktop variant - defaults to sidebar behavior
  return (
    <UserMenuFlexible
      position={position || 'sidebar'}
      displayMode="full"
      dropdownDirection="auto"
      className={className}
    />
  );
}
