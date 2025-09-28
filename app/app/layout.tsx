import { redirect } from 'next/navigation';
import { AppChrome } from '@/components/chrome/app-chrome';
import { OfflineProvider } from '@/components/offline/offline-provider';
import { FilterProvider } from '@/contexts/filter-context';
import { getAuthWithUser } from '@/lib/auth/server';
import { PerformanceProfilerUI } from '@/components/debug/performance-profiler-ui';
import { ViewportAnalyzerUI } from '@/components/debug/viewport-analyzer-ui';
import { NavigationAuditUI } from '@/components/debug/navigation-audit-ui';
import { MobilePerformanceUI } from '@/components/debug/mobile-performance-ui';

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
      <FilterProvider>
        <div className="min-h-screen bg-[#0B0C0E]">
          <AppChrome>
            {children}
          </AppChrome>

          <PerformanceProfilerUI />
          <ViewportAnalyzerUI />
          <NavigationAuditUI />
          <MobilePerformanceUI />
        </div>
      </FilterProvider>
    </OfflineProvider>
  );
}
