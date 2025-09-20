'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSearchAssets } from '@/hooks/use-assets';
import { ImageGrid } from '@/components/library/image-grid';
import { ImageGridErrorBoundary } from '@/components/library/image-grid-error-boundary';
import { SearchBar } from '@/components/search';
import Link from 'next/link';

function SearchContent() {
  const searchParams = useSearchParams();
  const queryParam = searchParams.get('q') || '';

  const [query, setQuery] = useState(queryParam);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);

  const {
    assets,
    loading,
    error,
    total,
    updateAsset,
    deleteAsset,
    metadata,
  } = useSearchAssets(query, { limit: 50, threshold: 0.2 });

  // Update query when URL changes
  useEffect(() => {
    setQuery(queryParam);
  }, [queryParam]);

  const handleSearch = (newQuery: string) => {
    setQuery(newQuery);
    // Update URL without navigation
    const params = new URLSearchParams();
    if (newQuery) {
      params.set('q', newQuery);
    }
    window.history.replaceState({}, '', `/app/search${params.toString() ? `?${params.toString()}` : ''}`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 md:p-8 pb-0">
        <header className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/app"
              className="p-2 rounded-lg bg-[#14171A] border border-[#2A2F37] hover:border-[#7C5CFF]/50 transition-colors"
              aria-label="Back to library"
            >
              <svg className="w-5 h-5 text-[#B3B7BE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-[#E6E8EB]">Search</h1>
              <p className="text-[#B3B7BE] mt-1">
                Find memes with natural language
              </p>
            </div>
          </div>
        </header>

        {/* Search Bar */}
        <div className="mb-6">
          <SearchBar
            placeholder="Describe what you're looking for..."
            onSearch={handleSearch}
            autoFocus
          />
        </div>

        {/* Search Results Info */}
        {query && !loading && !error && (
          <div className="mb-4 p-4 bg-[#14171A] border border-[#2A2F37] rounded-xl">
            <div className="flex flex-col gap-2 text-sm text-[#B3B7BE]">
              <p>
                Found <span className="text-[#B6FF6E] font-semibold">{total}</span> results
                for &ldquo;<span className="text-[#E6E8EB] font-medium">{query}</span>&rdquo;
              </p>
              {metadata?.thresholdFallback && (
                <p className="text-xs text-[#FFAA5C]">
                  Showing additional matches below {Math.round((metadata.requestedThreshold ?? 0) * 100)}% similarity so you still see the closest memes.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-[#FF4D4D]/10 border border-[#FF4D4D]/20 rounded-xl">
            <p className="text-sm text-[#FF4D4D]">
              {error}
            </p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="mb-4 p-4 bg-[#14171A] border border-[#2A2F37] rounded-xl">
            <div className="flex items-center gap-3">
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
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <p className="text-sm text-[#B3B7BE]">Searching for &ldquo;{query}&rdquo;...</p>
            </div>
          </div>
        )}
      </div>

      {/* Results Grid */}
      <div className="flex-1 px-6 md:px-8 pb-6 md:pb-8 min-h-0">
        {query ? (
          <div className="bg-[#14171A] border border-[#2A2F37] rounded-2xl p-6 h-full">
            <div className="h-full" style={{ maxHeight: 'calc(100vh - 320px)' }}>
              <ImageGridErrorBoundary onRetry={() => handleSearch(query)}>
                <ImageGrid
                  assets={assets}
                  loading={loading}
                  hasMore={false} // Search results don't have pagination yet
                  onLoadMore={() => {}}
                  onAssetUpdate={updateAsset}
                  onAssetDelete={deleteAsset}
                  onAssetSelect={setSelectedAsset}
                />
              </ImageGridErrorBoundary>
            </div>
          </div>
        ) : (
          <div className="bg-[#14171A] border border-[#2A2F37] rounded-2xl p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 bg-[#7C5CFF]/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-[#7C5CFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-[#E6E8EB] mb-3">Start Searching</h2>
              <p className="text-[#B3B7BE] mb-6">
                Use natural language to find memes. Try searching for emotions, situations, or specific text.
              </p>
              <div className="text-left space-y-2">
                <p className="text-sm text-[#6A6E78]">Example searches:</p>
                <div className="space-y-2">
                  <button
                    onClick={() => handleSearch('surprised pikachu')}
                    className="w-full text-left px-4 py-2 bg-[#1B1F24] rounded-lg hover:bg-[#2A2F37] transition-colors"
                  >
                    <span className="text-[#B3B7BE]">&ldquo;surprised pikachu&rdquo;</span>
                  </button>
                  <button
                    onClick={() => handleSearch('feeling awkward')}
                    className="w-full text-left px-4 py-2 bg-[#1B1F24] rounded-lg hover:bg-[#2A2F37] transition-colors"
                  >
                    <span className="text-[#B3B7BE]">&ldquo;feeling awkward&rdquo;</span>
                  </button>
                  <button
                    onClick={() => handleSearch('this is fine')}
                    className="w-full text-left px-4 py-2 bg-[#1B1F24] rounded-lg hover:bg-[#2A2F37] transition-colors"
                  >
                    <span className="text-[#B3B7BE]">&ldquo;this is fine&rdquo;</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      {selectedAsset && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedAsset(null)}
        >
          <div
            className="max-w-4xl max-h-[90vh] relative"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedAsset.blobUrl}
              alt={selectedAsset.filename}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <button
              onClick={() => setSelectedAsset(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="absolute bottom-4 left-4 right-4 bg-black/50 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white font-medium">{selectedAsset.filename}</p>
              <p className="text-white/80 text-sm mt-1">
                {selectedAsset.width}×{selectedAsset.height} • {selectedAsset.mime.split('/')[1].toUpperCase()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <div className="text-[#B3B7BE]">Loading search...</div>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
