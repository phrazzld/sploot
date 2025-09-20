'use client';

import { useState } from 'react';
import { useAuthUser, useAuthActions } from '@/lib/auth/client';
import { usePwaInstallPrompt } from '@/hooks/use-pwa-install';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const { user } = useAuthUser();
  const { signOut } = useAuthActions();
  const { installable, installed, promptInstall } = usePwaInstallPrompt();
  const [signOutLoading, setSignOutLoading] = useState(false);

  const handleSignOut = async () => {
    setSignOutLoading(true);
    try {
      await signOut();
    } finally {
      setSignOutLoading(false);
    }
  };

  const handleInstall = async () => {
    await promptInstall();
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-3xl mx-auto">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold text-[#E6E8EB]">Settings</h1>
        <p className="text-[#B3B7BE] text-sm">
          Tune your meme bunker vibes, manage your login, and flex the PWA drip.
        </p>
      </header>

      <section className="bg-[#14171A] border border-[#2A2F37] rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-[#E6E8EB]">Account lore</h2>
          <p className="text-[#B3B7BE] text-sm mt-1">
            Signed in as <span className="text-[#E6E8EB]">{user?.emailAddresses?.[0]?.emailAddress ?? 'unknown gremlin'}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSignOut}
            disabled={signOutLoading}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              'bg-[#FF4D4D]/20 text-[#FF8686] hover:bg-[#FF4D4D]/30',
              signOutLoading && 'opacity-60 cursor-not-allowed'
            )}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {signOutLoading ? 'Yeeting…' : 'Sign out'}
          </button>
        </div>
      </section>

      <section className="bg-[#14171A] border border-[#2A2F37] rounded-2xl p-5 space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-[#E6E8EB]">Install as app</h2>
          <p className="text-[#B3B7BE] text-sm mt-1">
            Add Sploot to your home screen so the memes hit quicker than doomscroll déjà vu.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleInstall}
            disabled={!installable}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              installable
                ? 'bg-[#7C5CFF] text-white hover:bg-[#6B4FE6]'
                : 'bg-[#1B1F24] text-[#6A6E78] cursor-not-allowed'
            )}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8l-8-8-8 8" />
            </svg>
            {installed ? 'Already installed 🔒' : 'Install Sploot PWA'}
          </button>

          {!installable && !installed && (
            <span className="text-xs text-[#B3B7BE]">
              Browser not vibing? Try in Chrome/Edge/Android for install button energy.
            </span>
          )}

          {installed && (
            <span className="text-xs text-[#B6FF6E]">
              You already pinned the app. Absolute W.
            </span>
          )}
        </div>
      </section>

      <section className="bg-[#14171A] border border-[#2A2F37] rounded-2xl p-5 space-y-3">
        <h2 className="text-lg font-semibold text-[#E6E8EB]">Coming soon™</h2>
        <p className="text-[#B3B7BE] text-sm">
          Theme switching, notification spam, and squad-sharing are on the roadmap. Ping us with your wildest feature dreams.
        </p>
      </section>
    </div>
  );
}
