'use client';

import { useEffect, useState, useRef } from 'react';
import { useOffline } from '@/hooks/use-offline';
import { cn } from '@/lib/utils';

export function OfflineStatusBar() {
  const { isOffline, wasOffline, isSlowConnection } = useOffline();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const collapseTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const startAutoCollapse = () => {
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
    }
    collapseTimeoutRef.current = setTimeout(() => {
      setIsExpanded(false);
    }, 5000);
  };

  // Auto-expand when going offline
  useEffect(() => {
    if (isOffline && !wasOffline) {
      setIsExpanded(true);
      startAutoCollapse();
    }
  }, [isOffline, wasOffline]);

  // Show success toast when coming back online
  useEffect(() => {
    if (wasOffline && !isOffline) {
      setShowSuccessToast(true);
      const timer = setTimeout(() => {
        setShowSuccessToast(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOffline, wasOffline]);

  const handleMouseEnter = () => {
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
    }
    setIsExpanded(true);
  };

  const handleMouseLeave = () => {
    startAutoCollapse();
  };

  const handleClick = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      startAutoCollapse();
    }
  };

  // Don't show anything if online and no slow connection
  if (!isOffline && !isSlowConnection && !showSuccessToast) {
    return null;
  }

  return (
    <>
      {/* Status Bar */}
      {(isOffline || isSlowConnection) && (
        <div
          className={cn(
            'fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ease-out cursor-pointer',
            isExpanded ? 'h-6' : 'h-1'
          )}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          role="status"
          aria-live="polite"
          aria-label={isOffline ? 'You are offline' : 'Slow connection detected'}
        >
          {/* Background bar */}
          <div
            className={cn(
              'h-full w-full transition-colors duration-300',
              isOffline
                ? 'bg-gradient-to-r from-[#FF4D4D] via-[#FF6B6B] to-[#FF4D4D]'
                : 'bg-gradient-to-r from-[#FFA500] via-[#FFB520] to-[#FFA500]',
              !isExpanded && 'animate-pulse'
            )}
          >
            {/* Content - only visible when expanded */}
            {isExpanded && (
              <div className="h-full flex items-center justify-center px-4 animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  {/* Icon */}
                  {isOffline ? (
                    <svg
                      className="w-3.5 h-3.5 text-white/90"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-3.5 h-3.5 text-white/90"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                      />
                    </svg>
                  )}

                  {/* Text */}
                  <span className="text-xs font-medium text-white/90 lowercase">
                    {isOffline ? 'offline - uploads queued' : 'slow connection'}
                  </span>

                  {/* Hint */}
                  <span className="text-[10px] text-white/60 ml-2 hidden sm:inline">
                    (click to {isExpanded ? 'collapse' : 'expand'})
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Success Toast - when coming back online */}
      {showSuccessToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="bg-[#14171A] border border-[#B6FF6E]/30 rounded-full px-4 py-2 shadow-2xl">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#B6FF6E] rounded-full animate-pulse" />
              <span className="text-xs font-medium text-[#B6FF6E] lowercase">
                back online
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}