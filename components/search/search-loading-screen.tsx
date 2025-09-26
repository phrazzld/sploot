'use client';

interface SearchLoadingScreenProps {
  query: string;
}

export function SearchLoadingScreen({ query }: SearchLoadingScreenProps) {
  return (
    <div className="flex-1 overflow-hidden px-6 pb-8 pt-6 md:px-10">
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-[#1F2328] bg-[#101319]">
        {/* Header showing what's being searched */}
        <div className="border-b border-[#1F2328] bg-[#0A0B0D] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <svg
                className="animate-spin h-5 w-5 text-[#7C5CFF]"
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
              <span className="text-sm text-[#B3B7BE]">Searching for</span>
            </div>
            <span className="text-sm font-medium text-[#E6E8EB]">&ldquo;{query}&rdquo;</span>
          </div>
        </div>

        {/* Skeleton grid */}
        <div className="flex-1 overflow-hidden p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5">
            {/* Generate skeleton items */}
            {Array.from({ length: 20 }).map((_, index) => (
              <div
                key={index}
                className="relative aspect-square animate-pulse"
                style={{
                  animationDelay: `${index * 50}ms`,
                }}
              >
                {/* Skeleton card */}
                <div className="h-full w-full rounded-2xl bg-[#1C1F26] border border-[#2A2F37]">
                  {/* Shimmer effect overlay */}
                  <div
                    className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-[#2A2F37]/30 to-transparent"
                    style={{
                      animation: 'shimmer 1.5s infinite',
                      backgroundSize: '200% 100%',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Progress indicator */}
          <div className="mt-8 flex flex-col items-center justify-center gap-4">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-[#7C5CFF] animate-pulse" />
              <div className="h-2 w-2 rounded-full bg-[#7C5CFF] animate-pulse" style={{ animationDelay: '150ms' }} />
              <div className="h-2 w-2 rounded-full bg-[#7C5CFF] animate-pulse" style={{ animationDelay: '300ms' }} />
            </div>
            <p className="text-sm text-[#6A6E78]">
              Finding your memes...
            </p>
          </div>
        </div>
      </div>

      {/* Add shimmer animation keyframes */}
      <style jsx>{`
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
      `}</style>
    </div>
  );
}