'use client';

import { ReactNode, useState, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Navbar } from './navbar';
import { Footer } from './footer';
import { NavbarSpacer, FooterSpacer } from './chrome-spacers';
import { useFilter } from '@/contexts/filter-context';
import { useSortPreferences } from '@/hooks/use-sort-preferences';
import { useAssets } from '@/hooks/use-assets';
import { useAuthActions } from '@/lib/auth/client';
import type { ViewMode } from './view-mode-toggle';
import type { FilterType } from './filter-chips';
import type { SortOption, SortDirection } from './sort-dropdown';

interface AppChromeProps {
  children: ReactNode;
}

/**
 * App chrome wrapper with navbar and footer
 * Replaces the old NavigationContainer with sidebar
 * This is a smart component that manages its own state
 */
export function AppChrome({ children }: AppChromeProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { signOut } = useAuthActions();

  // View mode from URL
  const viewModeParam = searchParams.get('view') as ViewMode | null;
  const viewMode = viewModeParam || 'grid';

  // Filter state from context
  const { filterType, setFilterType } = useFilter();

  // Sort preferences with localStorage
  const { sortBy, direction: sortDirection, handleSortChange } = useSortPreferences();

  // Upload state
  const [isUploadActive, setIsUploadActive] = useState(false);

  // Get assets data for stats
  const { assets } = useAssets();
  const totalAssets = assets?.length || 0;
  const favoriteCount = assets?.filter(a => a.isFavorite).length || 0;
  const totalSizeBytes = assets?.reduce((sum, a) => sum + (a.size || 0), 0) || 0;

  // Handle view mode change
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', mode);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, searchParams, router]);

  // Handle upload click
  const handleUploadClick = useCallback(() => {
    setIsUploadActive(true);
    // The actual upload will be handled by the upload zone in the main page
    // This just triggers the UI state
    window.dispatchEvent(new CustomEvent('open-upload-panel'));
  }, []);

  // Handle filter change
  const handleFilterChange = useCallback((filter: FilterType) => {
    setFilterType(filter);
  }, [setFilterType]);

  // Handle sort change (maps to the existing sort preferences)
  const handleSortChangeWrapper = useCallback((option: SortOption, direction: SortDirection) => {
    handleSortChange(option, direction);
  }, [handleSortChange]);

  // Handle settings click
  const handleSettingsClick = useCallback(() => {
    router.push('/app/settings');
  }, [router]);

  // Handle sign out
  const handleSignOut = useCallback(async () => {
    await signOut();
    router.push('/');
  }, [signOut, router]);
  return (
    <>
      {/* Fixed Navbar */}
      <Navbar
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onUploadClick={handleUploadClick}
        isUploadActive={isUploadActive}
        onSignOut={handleSignOut}
      />

      {/* Spacer for navbar height */}
      <NavbarSpacer />

      {/* Main content */}
      <main className="min-h-[calc(100vh-100px)]">
        {children}
      </main>

      {/* Fixed Footer */}
      <Footer
        totalAssets={totalAssets}
        favoriteCount={favoriteCount}
        totalSizeBytes={totalSizeBytes}
        activeFilter={filterType as FilterType}
        onFilterChange={handleFilterChange}
        sortValue={sortBy as SortOption}
        sortDirection={sortDirection as SortDirection}
        onSortChange={handleSortChangeWrapper}
        showSettings={true}
        onSettingsClick={handleSettingsClick}
      />

      {/* Spacer for footer height */}
      <FooterSpacer />
    </>
  );
}