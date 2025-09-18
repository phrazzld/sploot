'use client';

import { useState, useEffect } from 'react';
import { useAssets } from '@/hooks/use-assets';
import { ImageGrid } from '@/components/library/image-grid';
import { SearchBar } from '@/components/search';
import { useRouter } from 'next/navigation';

export default function AppPage() {
  const router = useRouter();
  const {
    assets,
    loading,
    hasMore,
    total,
    loadAssets,
    updateAsset,
    deleteAsset,
  } = useAssets({
    initialLimit: 50,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    autoLoad: true,
  });

  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'masonry' | 'compact'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('viewMode') as 'grid' | 'masonry' | 'compact') || 'grid';
    }
    return 'grid';
  });

  // Save view mode preference to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('viewMode', viewMode);
    }
  }, [viewMode]);

  const handleSearch = (query: string) => {
    router.push(`/app/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 md:p-8 pb-0">
        <header className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[#E6E8EB]">Your Library</h1>
              <p className="text-[#B3B7BE] mt-2">
                {total > 0 ? `${total} ${total === 1 ? 'meme' : 'memes'} in your collection` : 'Start building your meme collection'}
              </p>
            </div>
            {/* View Mode Toggle */}
            <div className="flex gap-1 p-1 bg-[#14171A] border border-[#2A2F37] rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-[#7C5CFF]/20 text-[#7C5CFF]'
                    : 'text-[#B3B7BE] hover:text-[#E6E8EB]'
                }`}
                title="Grid view"
              >
                {/* Grid Icon */}
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <rect x="3" y="3" width="7" height="7" strokeWidth="2" />
                  <rect x="14" y="3" width="7" height="7" strokeWidth="2" />
                  <rect x="3" y="14" width="7" height="7" strokeWidth="2" />
                  <rect x="14" y="14" width="7" height="7" strokeWidth="2" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('masonry')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'masonry'
                    ? 'bg-[#7C5CFF]/20 text-[#7C5CFF]'
                    : 'text-[#B3B7BE] hover:text-[#E6E8EB]'
                }`}
                title="Masonry view"
              >
                {/* Masonry Icon */}
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <rect x="3" y="3" width="7" height="10" strokeWidth="2" />
                  <rect x="14" y="3" width="7" height="6" strokeWidth="2" />
                  <rect x="3" y="17" width="7" height="4" strokeWidth="2" />
                  <rect x="14" y="13" width="7" height="8" strokeWidth="2" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('compact')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'compact'
                    ? 'bg-[#7C5CFF]/20 text-[#7C5CFF]'
                    : 'text-[#B3B7BE] hover:text-[#E6E8EB]'
                }`}
                title="Compact view"
              >
                {/* List/Compact Icon */}
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <line x1="3" y1="6" x2="21" y2="6" strokeWidth="2" strokeLinecap="round" />
                  <line x1="3" y1="12" x2="21" y2="12" strokeWidth="2" strokeLinecap="round" />
                  <line x1="3" y1="18" x2="21" y2="18" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* Search Bar */}
        <div className="mb-6">
          <SearchBar onSearch={handleSearch} />
        </div>

      </div>

      {/* Image Grid - Fills remaining height */}
      <div className="flex-1 px-6 md:px-8 pb-6 md:pb-8 min-h-0">
        <div className="bg-[#14171A] border border-[#2A2F37] rounded-2xl p-6 h-full">
          <div className="h-full" style={{ maxHeight: 'calc(100vh - 320px)' }}>
            <ImageGrid
              assets={assets}
              loading={loading}
              hasMore={hasMore}
              onLoadMore={() => loadAssets()}
              onAssetUpdate={updateAsset}
              onAssetDelete={deleteAsset}
              onAssetSelect={setSelectedAsset}
            />
          </div>
        </div>
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