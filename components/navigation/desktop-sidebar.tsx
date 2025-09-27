/**
 * Temporary holding component for desktop sidebar navigation
 * This extracts all sidebar logic from the layout to prepare for navbar/footer migration
 */

import { AppNav } from './app-nav';
import { TagFilter } from './tag-filter';
import { UserMenu } from './user-menu';
import { LogoWordmark } from '../chrome/logo-wordmark';

export function DesktopSidebar() {
  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-[#14171A] border-r border-[#2A2F37]">
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="p-6 border-b border-[#2A2F37]">
          <LogoWordmark
            variant="default"
            size="md"
            showTagline={true}
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <AppNav />
          <TagFilter />
        </nav>

        {/* User Menu */}
        <div className="p-4 border-t border-[#2A2F37]">
          <UserMenu position="sidebar" />
        </div>
      </div>
    </aside>
  );
}