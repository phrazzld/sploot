/**
 * Temporary holding component for desktop sidebar navigation
 * This extracts all sidebar logic from the layout to prepare for navbar/footer migration
 */

import Link from 'next/link';
import { AppNav } from './app-nav';
import { TagFilter } from './tag-filter';
import { UserMenu } from './user-menu';

export function DesktopSidebar() {
  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-[#14171A] border-r border-[#2A2F37]">
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="p-6 border-b border-[#2A2F37]">
          <Link href="/app" className="block">
            <h1 className="text-2xl font-bold text-[#E6E8EB] tracking-wider lowercase hover:text-[#7C5CFF] transition-colors">
              sploot
            </h1>
            <p className="text-xs text-[#B3B7BE] mt-1">Your meme library</p>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <AppNav />
          <TagFilter />
        </nav>

        {/* User Menu */}
        <div className="p-4 border-t border-[#2A2F37]">
          <UserMenu />
        </div>
      </div>
    </aside>
  );
}