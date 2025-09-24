'use client';

import React from 'react';
import { useCircuitBreakerStats } from '@/lib/circuit-breaker';

/**
 * Circuit Breaker Status Indicator
 * Shows circuit breaker state and blocks UI when circuit is open
 */
export function CircuitBreakerIndicator() {
  const { state, isOpen, timeUntilClose, stats } = useCircuitBreakerStats();

  if (process.env.NODE_ENV !== 'development' && !isOpen) {
    return null;
  }

  // Only show indicator if circuit is not closed or in dev mode with failures
  if (state === 'closed' && (!stats || stats.failures === 0)) {
    return null;
  }

  const stateColors: Record<string, string> = {
    closed: 'text-[#B6FF6E]',
    open: 'text-[#FF4D4D]',
    'half-open': 'text-[#FFB020]',
  };

  const stateEmojis: Record<string, string> = {
    closed: '✅',
    open: '🛑',
    'half-open': '⚠️',
  };

  return (
    <>
      {/* Circuit Open Overlay - Shows in production when circuit is open */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center">
          <div className="bg-[#0F1012] border border-[#FF4D4D]/50 rounded-lg p-8 max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-4xl animate-pulse">🛑</div>
              <div>
                <h2 className="text-xl font-semibold text-[#FF4D4D]">
                  Connection Circuit Breaker Activated
                </h2>
                <p className="text-gray-400 text-sm">
                  Too many connection failures detected
                </p>
              </div>
            </div>

            <div className="mb-6 p-4 bg-[#FF4D4D]/10 rounded">
              <p className="text-sm text-gray-300 mb-2">
                The system has temporarily paused requests to prevent browser crashes.
                This is a protective measure against connection exhaustion.
              </p>
              <p className="text-xs text-gray-500">
                Circuit will attempt recovery in {Math.ceil(timeUntilClose / 1000)} seconds...
              </p>
            </div>

            {/* Recovery Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Recovery Progress</span>
                <span>{Math.round((1 - timeUntilClose / 30000) * 100)}%</span>
              </div>
              <div className="h-2 bg-gray-800 rounded overflow-hidden">
                <div
                  className="h-full bg-[#7C5CFF] transition-all duration-1000"
                  style={{
                    width: `${(1 - timeUntilClose / 30000) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* Stats */}
            {stats && (
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="text-gray-500">Total Failures</div>
                  <div className="text-[#FF4D4D] font-mono">{stats.totalFailures}</div>
                </div>
                <div>
                  <div className="text-gray-500">Consecutive Failures</div>
                  <div className="text-[#FFB020] font-mono">{stats.consecutiveFailures}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Development Mode Indicator */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="bg-black/90 rounded-lg p-3 border border-[#7C5CFF]/20">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className={stateColors[state]}>
                {stateEmojis[state]}
              </span>
              <span className="text-gray-400">Circuit:</span>
              <span className={stateColors[state]}>
                {state.toUpperCase()}
              </span>
              {stats && stats.failures > 0 && (
                <>
                  <span className="text-gray-600">|</span>
                  <span className="text-gray-400">
                    Failures: {stats.failures}/{5}
                  </span>
                </>
              )}
            </div>

            {/* Show countdown when circuit is open */}
            {isOpen && (
              <div className="mt-2 text-[10px] text-[#FFB020]">
                Recovery in {Math.ceil(timeUntilClose / 1000)}s...
              </div>
            )}

            {/* Show half-open testing state */}
            {state === 'half-open' && (
              <div className="mt-2 text-[10px] text-[#FFB020] animate-pulse">
                Testing recovery...
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}