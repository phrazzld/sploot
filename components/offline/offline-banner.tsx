'use client';

import { useEffect, useState } from 'react';
import { useOffline } from '@/hooks/use-offline';

export function OfflineBanner() {
  const { isOffline, wasOffline, isSlowConnection, connectionType } = useOffline();
  const [showBanner, setShowBanner] = useState(false);
  const [showBackOnline, setShowBackOnline] = useState(false);

  useEffect(() => {
    if (isOffline) {
      setShowBanner(true);
      setShowBackOnline(false);
    } else if (wasOffline && !isOffline) {
      // Just came back online
      setShowBanner(false);
      setShowBackOnline(true);
      // Hide "back online" message after 3 seconds
      const timer = setTimeout(() => {
        setShowBackOnline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOffline, wasOffline]);

  if (!showBanner && !showBackOnline && !isSlowConnection) {
    return null;
  }

  return (
    <>
      {/* Offline Banner */}
      {showBanner && (
        <div className="fixed top-16 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 animate-in slide-in-from-top-2 duration-300">
          <div className="bg-[#14171A] border border-[#FF4D4D]/20 rounded-2xl p-4 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-[#FF4D4D]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-[#FF4D4D]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
                  />
                </svg>
              </div>

              <div className="flex-1">
                <h3 className="text-[#E6E8EB] font-semibold mb-1">
                  You&apos;re Offline
                </h3>
                <p className="text-[#B3B7BE] text-sm">
                  Some features may be limited. Uploads will be queued and processed when you&apos;re back online.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Back Online Banner */}
      {showBackOnline && (
        <div className="fixed top-16 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 animate-in slide-in-from-top-2 duration-300">
          <div className="bg-[#14171A] border border-[#B6FF6E]/20 rounded-2xl p-4 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-[#B6FF6E]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-[#B6FF6E]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
                  />
                </svg>
              </div>

              <div className="flex-1">
                <h3 className="text-[#E6E8EB] font-semibold mb-1">
                  Back Online!
                </h3>
                <p className="text-[#B3B7BE] text-sm">
                  Your connection has been restored. Processing queued uploads...
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slow Connection Warning */}
      {isSlowConnection && !isOffline && (
        <div className="fixed top-16 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 animate-in slide-in-from-top-2 duration-300">
          <div className="bg-[#14171A] border border-[#FFA500]/20 rounded-2xl p-4 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-[#FFA500]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-[#FFA500]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>

              <div className="flex-1">
                <h3 className="text-[#E6E8EB] font-semibold mb-1">
                  Slow Connection
                </h3>
                <p className="text-[#B3B7BE] text-sm">
                  {connectionType && `Connected via ${connectionType}. `}
                  Uploads may take longer than usual.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}