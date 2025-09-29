'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

export type EmptyStateVariant = 'first-use' | 'filtered' | 'search';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  onUploadClick?: () => void;
  searchQuery?: string;
  className?: string;
}

/**
 * Empty state component for the library
 * Displays contextual messaging when no assets are available
 */
export function EmptyState({
  variant = 'first-use',
  onUploadClick,
  searchQuery,
  className,
}: EmptyStateProps) {
  // Determine message based on variant
  const getMessage = () => {
    switch (variant) {
      case 'search':
        return {
          title: 'no results found',
          description: searchQuery
            ? `No memes match "${searchQuery}". Try different search terms or browse your full library.`
            : 'No memes match your search. Try different terms or browse your full library.',
        };
      case 'filtered':
        return {
          title: 'no memes match these filters',
          description: 'Try adjusting your filters or clearing them to see all your memes.',
        };
      case 'first-use':
      default:
        return {
          title: 'drop files here',
          description: 'drag and drop images into your library or start an upload to see them appear instantly.',
        };
    }
  };

  const message = getMessage();
  const showUploadButton = variant === 'first-use';

  return (
    <div className={cn('flex h-full items-center justify-center py-16', className)}>
      <div className="flex w-full max-w-lg flex-col items-center gap-6 rounded-3xl border border-dashed border-[#2A2F37] bg-[#14171A] p-10 text-center">
        {/* Icon */}
        <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-[#1B1F24]">
          <svg
            className="h-14 w-14 text-[#7C5CFF]"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <rect
              x="8"
              y="12"
              width="48"
              height="40"
              rx="6"
              stroke="currentColor"
              strokeWidth="2.5"
              opacity="0.9"
            />
            <path
              d="M18 39l9.5-11a2 2 0 013 0l6 7.2a2 2 0 003.1.1L44 30"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.9"
            />
            <circle cx="42" cy="23" r="3.5" fill="currentColor" opacity="0.9" />
          </svg>
        </div>

        {/* Message */}
        <div>
          <h3 className="text-xl font-semibold text-[#E6E8EB]">{message.title}</h3>
          <p className="mt-2 text-sm text-[#B3B7BE]">{message.description}</p>
        </div>

        {/* Upload button (only for first-use variant) */}
        {showUploadButton && (
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <span className="text-xs uppercase tracking-wide text-[#7C5CFF]">or</span>
            {onUploadClick ? (
              <button
                onClick={onUploadClick}
                className="inline-flex items-center gap-2 rounded-lg bg-[#7C5CFF] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#6B4FE0]"
                aria-label="Upload images"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M10 4v12M4 10h12"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                upload images
              </button>
            ) : (
              <Link
                href="/app?upload=1"
                className="inline-flex items-center gap-2 rounded-lg bg-[#7C5CFF] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#6B4FE0]"
                aria-label="Upload images"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M10 4v12M4 10h12"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                upload images
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}