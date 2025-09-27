/**
 * Backward-compatible wrapper for TagFilter
 * Uses the flexible TagFilter internally with sidebar defaults
 * This ensures existing usages continue to work unchanged
 */

import { TagFilterFlexible } from './tag-filter-flexible';

export function TagFilter() {
  return (
    <TagFilterFlexible
      position="sidebar"
      displayMode="full"
      showHeader={true}
      expandable={true}
    />
  );
}
