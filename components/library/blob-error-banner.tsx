'use client';

import { useBlobCircuitBreaker } from '@/contexts/blob-circuit-breaker-context';
import { cn } from '@/lib/utils';

export function BlobErrorBanner() {
  const { isOpen, timeUntilClose, reset } = useBlobCircuitBreaker();

  if (!isOpen) return null;

  const secondsRemaining = Math.ceil(timeUntilClose / 1000);

  return (
    <div className="animate-slide-down fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-3 bg-gradient-to-r from-orange-500/20 via-red-500/20 to-orange-500/20 px-4 py-3 backdrop-blur-sm border-b border-red-500/30">
      {/* Warning icon */}
      <svg className="h-5 w-5 flex-shrink-0 text-orange-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>

      {/* Message */}
      <p className="flex-1 text-sm text-[#E6E8EB] font-medium">
        <span className="font-semibold text-orange-400">Storage connection issue detected.</span>
        {' '}
        Retrying in {secondsRemaining}s...
      </p>

      {/* Manual retry button */}
      <button
        type="button"
        onClick={reset}
        className={cn(
          'inline-flex items-center gap-1.5  px-3 py-1.5 text-xs font-medium transition-colors',
          'bg-[#7C5CFF]/20 text-[#7C5CFF] border border-[#7C5CFF]/40',
          'hover:bg-[#7C5CFF]/30 hover:border-[#7C5CFF]/60',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C5CFF]'
        )}
        title="Reset circuit breaker and retry now"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        Retry Now
      </button>
    </div>
  );
}