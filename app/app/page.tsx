'use client';

import { useState } from 'react';
import { useAssets } from '@/hooks/use-assets';
import { ImageGrid } from '@/components/library/image-grid';
import { SearchBar } from '@/components/search';
import Link from 'next/link';
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

  const favoriteCount = assets.filter(a => a.favorite).length;

  const handleSearch = (query: string) => {
    router.push(`/app/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 md:p-8 pb-0">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-[#E6E8EB]">Your Library</h1>
          <p className="text-[#B3B7BE] mt-2">
            {total > 0 ? `${total} memes in your collection` : 'Start building your meme collection'}
          </p>
        </header>

        {/* Search Bar */}
        <div className="mb-6">
          <SearchBar onSearch={handleSearch} />
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 mb-6">
          <div className="bg-[#14171A] border border-[#2A2F37] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#7C5CFF]/20 rounded-lg flex items-center justify-center">
                <span className="text-[#7C5CFF]">📁</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-[#E6E8EB]">{total}</p>
                <p className="text-xs text-[#B3B7BE]">Total</p>
              </div>
            </div>
          </div>

          <div className="bg-[#14171A] border border-[#2A2F37] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#B6FF6E]/20 rounded-lg flex items-center justify-center">
                <span className="text-[#B6FF6E]">⭐</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-[#E6E8EB]">{favoriteCount}</p>
                <p className="text-xs text-[#B3B7BE]">Favorites</p>
              </div>
            </div>
          </div>

          <Link href="/app/upload" className="bg-[#14171A] border border-[#2A2F37] rounded-xl p-4 hover:border-[#7C5CFF] transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#7C5CFF]/20 rounded-lg flex items-center justify-center">
                <span className="text-[#7C5CFF]">📤</span>
              </div>
              <div>
                <p className="text-lg font-bold text-[#E6E8EB]">Upload</p>
                <p className="text-xs text-[#B3B7BE]">Add memes</p>
              </div>
            </div>
          </Link>

          <Link href="/app/search" className="bg-[#14171A] border border-[#2A2F37] rounded-xl p-4 hover:border-[#7C5CFF] transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#7C5CFF]/20 rounded-lg flex items-center justify-center">
                <span className="text-[#7C5CFF]">🔍</span>
              </div>
              <div>
                <p className="text-lg font-bold text-[#E6E8EB]">Search</p>
                <p className="text-xs text-[#B3B7BE]">Find memes</p>
              </div>
            </div>
          </Link>
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