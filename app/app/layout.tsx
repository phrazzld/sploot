import { redirect } from 'next/navigation';
import { NavigationContainer } from '@/components/navigation/navigation-container';
import { OfflineProvider } from '@/components/offline/offline-provider';
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
      <div className="min-h-screen bg-[#0B0C0E]">
        <NavigationContainer>
          {children}
        </NavigationContainer>

        <PerformanceProfilerUI />
        <ViewportAnalyzerUI />
        <NavigationAuditUI />
        <MobilePerformanceUI />
      </div>
    </OfflineProvider>
  );
}
