import { redirect } from 'next/navigation';
import { AppNav } from '@/components/navigation/app-nav';
import { MobileNav } from '@/components/navigation/mobile-nav';
import { UserMenu } from '@/components/navigation/user-menu';
import { TagFilter } from '@/components/navigation/tag-filter';
import { OfflineProvider } from '@/components/offline/offline-provider';
import { getAuthWithUser } from '@/lib/auth/server';
import { PerformanceProfilerUI } from '@/components/debug/performance-profiler-ui';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await getAuthWithUser();

  if (!userId) {
    redirect('/sign-in');
  }

  return (
    <OfflineProvider>
      <div className="min-h-screen bg-[#0B0C0E]">
      {/* Desktop Layout */}
      <div className="hidden md:flex">
        {/* Sidebar Navigation */}
        <aside className="fixed left-0 top-0 h-full w-64 bg-[#14171A] border-r border-[#2A2F37]">
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="p-6 border-b border-[#2A2F37]">
              <h1 className="text-2xl font-bold text-[#E6E8EB] tracking-wider lowercase">
                sploot
              </h1>
              <p className="text-xs text-[#B3B7BE] mt-1">Your meme library</p>
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
        <header className="bg-[#14171A] border-b border-[#2A2F37] px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-[#E6E8EB] tracking-wider lowercase">
            sploot
          </h1>
          <UserMenu variant="mobile" />
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto pb-20">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <MobileNav />
      </div>

      <PerformanceProfilerUI />
    </div>
    </OfflineProvider>
  );
}
