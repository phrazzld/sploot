/**
 * Backward-compatible wrapper for AppNav
 * Uses the flexible AppNav internally with sidebar defaults
 * This ensures existing usages continue to work unchanged
 */

import { AppNavFlexible } from './app-nav-flexible';

export function AppNav() {
  return (
    <AppNavFlexible
      direction="vertical"
      size="md"
      displayMode="full"
      showActiveIndicator={true}
    />
  );
}
