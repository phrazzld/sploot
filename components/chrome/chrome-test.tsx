'use client';

import { useState } from 'react';
import { Navbar, NavbarSpacer } from './navbar';
import { Footer, FooterSpacer } from './footer';
import { ViewMode } from './view-mode-toggle';
import { cn } from '@/lib/utils';

/**
 * Test component to visualize and verify the new chrome architecture
 * This component can be used to test the navbar/footer layout
 */
export function ChromeTest() {
  const [showChrome, setShowChrome] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isUploadActive, setIsUploadActive] = useState(false);

  return (
    <div className="min-h-screen bg-[#0B0C0E]">
      {/* Toggle button */}
      <div className="fixed top-4 right-4 z-[60] bg-[#14171A] p-2 rounded-lg border border-[#2A2F37]">
        <button
          onClick={() => setShowChrome(!showChrome)}
          className={cn(
            'px-4 py-2 rounded text-sm font-medium transition-all',
            showChrome
              ? 'bg-[#7C5CFF] text-white'
              : 'bg-[#1B1F24] text-[#B3B7BE] hover:bg-[#2A2F37]'
          )}
        >
          {showChrome ? 'Hide' : 'Show'} New Chrome
        </button>
      </div>

      {showChrome && (
        <>
          {/* Navbar */}
          <Navbar
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            showViewToggle={true}
            onUploadClick={() => setIsUploadActive(!isUploadActive)}
            isUploadActive={isUploadActive}
            showUploadButton={true}
            showUserAvatar={true}
            onSignOut={() => console.log('Sign out clicked')}
          />
          <NavbarSpacer />

          {/* Main content area */}
          <main
            className={cn(
              'min-h-[calc(100vh-100px)]', // 56px navbar + 44px footer = 100px
              'bg-[#0B0C0E]',
              'px-4 py-8'
            )}
          >
            <div className="max-w-screen-2xl mx-auto">
              <div className="space-y-8">
                {/* Chrome info */}
                <div className="bg-[#14171A] rounded-lg border border-[#2A2F37] p-6">
                  <h2 className="text-xl font-bold text-[#E6E8EB] mb-4">
                    New Chrome Architecture
                  </h2>
                  <div className="space-y-2 text-sm text-[#B3B7BE]">
                    <p>✓ Navbar: Fixed top, 56px height, z-50</p>
                    <p>✓ Footer: Fixed bottom, 44px height, z-50</p>
                    <p>✓ Content area: Full width, proper spacing</p>
                    <p>✓ Total chrome: 100px (vs 256px sidebar)</p>
                    <p>✓ View mode toggles: {viewMode} view active</p>
                    <p>✓ Upload button: {isUploadActive ? 'Active' : 'Ready'}</p>
                  </div>
                </div>

                {/* Grid demo */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {Array.from({ length: 20 }, (_, i) => (
                    <div
                      key={i}
                      className="aspect-square bg-[#1B1F24] rounded-lg border border-[#2A2F37] flex items-center justify-center text-[#B3B7BE]"
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </main>

          {/* Footer */}
          <FooterSpacer />
          <Footer />
        </>
      )}

      {!showChrome && (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold text-[#E6E8EB]">
              Chrome Architecture Test
            </h1>
            <p className="text-[#B3B7BE]">
              Click the toggle to preview the new navbar/footer layout
            </p>
          </div>
        </div>
      )}
    </div>
  );
}