'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ImageGrid } from '@/components/library/image-grid';

interface Tag {
  id: string;
  name: string;
  color: string | null;
  assetCount: number;
}

interface Asset {
  id: string;
  blobUrl: string;
  thumbnailUrl?: string | null;
  pathname: string;
  filename: string;
  mime: string;
  size: number;
  width?: number | null;
  height?: number | null;
  favorite: boolean;
  createdAt: Date | string;
  tags?: Array<{ id: string; name: string }>;
  embedding?: {
    assetId: string;
    modelName: string;
    modelVersion: string;
    createdAt: Date | string;
  } | null;
}

export default function TagPage({
  params,
}: {
  params: Promise<{ tagId: string }>;
}) {
  const resolvedParams = use(params);
  const [tag, setTag] = useState<Tag | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchTagAndAssets = async () => {
    try {
      // Fetch tag details
      const tagResponse = await fetch('/api/tags');
      if (tagResponse.ok) {
        const tagData = await tagResponse.json();
        const currentTag = tagData.tags?.find((t: Tag) => t.id === resolvedParams.tagId);

        if (!currentTag) {
          router.push('/app');
          return;
        }

        setTag(currentTag);
      } else {
        router.push('/app');
        return;
      }

      // Fetch assets with this tag
      const assetsResponse = await fetch(`/api/assets?tagId=${resolvedParams.tagId}`);
      if (assetsResponse.ok) {
        const assetsData = await assetsResponse.json();
        setAssets(assetsData.assets || []);
      }
    } catch (error) {
      console.error('Failed to fetch tag data:', error);
      router.push('/app');
    } finally {
      setLoading(false);
    }
  };

    fetchTagAndAssets();
  }, [resolvedParams.tagId, router]);

  const handleDelete = async (assetId: string) => {
    try {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setAssets((prev) => prev.filter((asset) => asset.id !== assetId));
      }
    } catch (error) {
      console.error('Failed to delete asset:', error);
    }
  };

  const handleFavorite = (assetId: string, favorite: boolean) => {
    setAssets((prev) =>
      prev.map((asset) =>
        asset.id === assetId ? { ...asset, favorite } : asset
      )
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0C0E] p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-[#1B1F24] rounded w-48 mb-4" />
          <div className="h-4 bg-[#1B1F24] rounded w-32" />
        </div>
      </div>
    );
  }

  if (!tag) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0B0C0E]">
      {/* Header */}
      <header className="bg-[#14171A] border-b border-[#2A2F37] px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-[#E6E8EB]">
                {tag.name}
              </h1>
              {tag.color && (
                <span
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
              )}
            </div>
            <p className="text-[#B3B7BE] text-sm">
              {assets.length} {assets.length === 1 ? 'image' : 'images'}
            </p>
          </div>
        </div>
      </header>

      {/* Assets Grid */}
      <div className="p-8">
        <ImageGrid
          assets={assets}
          onAssetDelete={handleDelete}
          onAssetUpdate={(id, updates) => {
            if ('favorite' in updates) {
              handleFavorite(id, updates.favorite!);
            }
          }}
        />
      </div>
    </div>
  );
}