/**
 * Temporary container component for all navigation elements
 * Consolidates desktop and mobile navigation layouts
 * This will be replaced with navbar/footer architecture in Phase 3
 */

import { ReactNode } from 'react';
import { DesktopSidebar } from './desktop-sidebar';
import { MobileHeader } from './mobile-header';
import { MobileNav } from './mobile-nav';

interface NavigationContainerProps {
  children: ReactNode;
}

export function NavigationContainer({ children }: NavigationContainerProps) {
  return (
    <>
      {/* Desktop Layout */}
      <div className="hidden md:flex">
        {/* Sidebar Navigation */}
        <DesktopSidebar />

        {/* Main Content */}
        <main className="flex-1 ml-64">
          <div className="min-h-screen">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden flex flex-col h-screen">
        {/* Mobile Header */}
        <MobileHeader />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto pb-20">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <MobileNav />
      </div>
    </>
  );
}