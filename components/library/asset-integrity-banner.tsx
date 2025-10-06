'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface AssetIntegrityBannerProps {
  onAudit: () => void;
}

export function AssetIntegrityBanner({ onAudit }: AssetIntegrityBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="animate-slide-down flex items-center justify-center gap-3 bg-gradient-to-r from-yellow-500/15 via-orange-500/15 to-yellow-500/15 px-4 py-2.5 backdrop-blur-sm border-b border-yellow-500/20">
      {/* Warning icon */}
      <svg className="h-4 w-4 flex-shrink-0 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>

      {/* Message */}
      <p className="flex-1 text-xs text-[#E6E8EB]">
        <span className="font-medium text-yellow-400">Data integrity warning:</span>
        {' '}
        Some assets may have broken storage links.
      </p>

      {/* Audit button */}
      <button
        type="button"
        onClick={onAudit}
        className={cn(
          'inline-flex items-center gap-1.5  px-2.5 py-1 text-xs font-medium transition-colors',
          'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
          'hover:bg-yellow-500/30 hover:border-yellow-500/50',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-500'
        )}
        title="Run asset audit"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
        Run Audit
      </button>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-[#B3B7BE] hover:text-[#E6E8EB] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-500"
        title="Dismiss warning"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}