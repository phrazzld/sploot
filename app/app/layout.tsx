import { redirect } from 'next/navigation';
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
      <FilterProvider>
        <div className="min-h-screen bg-[#0B0C0E]">
          <AppChrome>
            {children}
          </AppChrome>
        </div>
      </FilterProvider>
    </OfflineProvider>
  );
}
