'use client';

interface SearchLoadingScreenProps {
  query: string;
}

export function SearchLoadingScreen({ query }: SearchLoadingScreenProps) {
  return (
    <div className="flex-1 overflow-hidden px-6 pb-8 pt-6 md:px-10">
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden border border-[#333333] bg-black">
        {/* Header showing what's being searched */}
        <div className="border-b border-[#333333] bg-black px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <svg
                className="animate-spin h-5 w-5 text-[var(--color-terminal-green)]"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="font-mono text-sm uppercase text-[#888888]">Searching for</span>
            </div>
            <span className="font-mono text-sm text-[#E6E8EB]">&ldquo;{query}&rdquo;</span>
          </div>
        </div>

        {/* Skeleton grid */}
        <div className="flex-1 overflow-hidden p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5">
            {/* Generate skeleton items */}
            {Array.from({ length: 20 }).map((_, index) => (
              <div
                key={index}
                className="relative aspect-square"
              >
                {/* Skeleton card */}
                <div className="h-full w-full bg-[#0F1012] border border-[#333333]" />
              </div>
            ))}
          </div>

          {/* Progress indicator */}
          <div className="mt-8 flex flex-col items-center justify-center gap-4">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 bg-[var(--color-terminal-green)] animate-pulse" />
              <div className="h-2 w-2 bg-[var(--color-terminal-green)] animate-pulse" style={{ animationDelay: '150ms' }} />
              <div className="h-2 w-2 bg-[var(--color-terminal-green)] animate-pulse" style={{ animationDelay: '300ms' }} />
            </div>
            <p className="font-mono text-sm uppercase text-[#888888]">
              Finding your memes...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}