import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AppChrome } from '@/components/chrome/app-chrome';
import { OfflineProvider } from '@/components/offline/offline-provider';
import { FilterProvider } from '@/contexts/filter-context';
import { getAuthWithUser } from '@/lib/auth/server';

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
      <Suspense fallback={
        <div className="min-h-screen bg-[#0B0C0E]">
          <div className="flex h-screen items-center justify-center">
            <div className="text-[#B3B7BE]">Loading...</div>
          </div>
        </div>
      }>
        <FilterProvider>
          <div className="min-h-screen bg-[#0B0C0E]">
            <AppChrome>
              {children}
            </AppChrome>
          </div>
        </FilterProvider>
      </Suspense>
    </OfflineProvider>
  );
}
