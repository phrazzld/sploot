import crypto from 'crypto';
import { isMockMode } from './env';

export interface MockAsset {
  id: string;
  ownerUserId: string;
  blobUrl: string;
  pathname: string;
  filename: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  checksumSha256: string;
  favorite: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  tags: string[];
  embedding?: number[];
}

interface AssetOptions {
  width?: number | null;
  height?: number | null;
  tags?: string[];
}

const mockAssets = new Map<string, MockAsset>();
const userAssets = new Map<string, Set<string>>();
const searchLogs: Array<{ userId: string; query: string; resultCount: number; createdAt: Date }> = [];
let seeded = false;

function ensureSeedData() {
  if (seeded || !isMockMode()) {
    return;
  }

  const seedUser = 'mock-user-id';
  const samples = [
    {
      filename: 'distracted-boyfriend.jpg',
      mime: 'image/jpeg',
      blobUrl: 'https://images.unsplash.com/photo-1521292270410-a8c08e04aa90?auto=format&fit=crop&w=1200&q=80',
      tags: ['relationship', 'classic'],
      checksum: crypto.createHash('sha256').update('distracted').digest('hex'),
    },
    {
      filename: 'drake-hotline-bling.png',
      mime: 'image/png',
      blobUrl: 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=1200&q=80',
      tags: ['approval', 'reaction'],
      checksum: crypto.createHash('sha256').update('drake').digest('hex'),
    },
    {
      filename: 'crying-cat.webp',
      mime: 'image/webp',
      blobUrl: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=1200&q=80',
      tags: ['cat', 'sad'],
      checksum: crypto.createHash('sha256').update('cat').digest('hex'),
    },
    {
      filename: 'surprised-pikachu.gif',
      mime: 'image/gif',
      blobUrl: 'https://media.giphy.com/media/l0MYF5sY0SS2h0vI4/giphy.gif',
      tags: ['surprised', 'reaction'],
      checksum: crypto.createHash('sha256').update('pikachu').digest('hex'),
    },
  ];

  for (const sample of samples) {
    const id = crypto.randomUUID();
    const asset: MockAsset = {
      id,
      ownerUserId: seedUser,
      blobUrl: sample.blobUrl,
      pathname: `${seedUser}/${sample.filename}`,
      filename: sample.filename,
      mime: sample.mime,
      size: 512 * 1024,
      width: 1024,
      height: 768,
      checksumSha256: sample.checksum,
      favorite: sample.filename.includes('drake'),
      createdAt: new Date(Date.now() - Math.random() * 86400000),
      updatedAt: new Date(),
      deletedAt: null,
      tags: sample.tags,
      embedding: buildDeterministicVector(sample.filename),
    };
    mockAssets.set(id, asset);
    if (!userAssets.has(seedUser)) {
      userAssets.set(seedUser, new Set());
    }
    userAssets.get(seedUser)!.add(id);
  }

  seeded = true;
}

function buildDeterministicVector(seed: string): number[] {
  const vectorLength = 32;
  const vector = new Array(vectorLength).fill(0);
  for (let i = 0; i < seed.length; i++) {
    const charCode = seed.charCodeAt(i);
    vector[i % vectorLength] += charCode / 255;
  }
  const max = Math.max(...vector, 1);
  return vector.map(v => Number((v / max).toFixed(4)));
}

export function mockListAssets(
  userId: string,
  options: { limit: number; offset: number; favorite?: boolean; sortBy: string; sortOrder: 'asc' | 'desc' }
) {
  ensureSeedData();
  const ids = userAssets.get(userId) ?? new Set<string>();
  let assets = Array.from(ids)
    .map(id => mockAssets.get(id)!)
    .filter(asset => !asset.deletedAt);

  if (options.favorite !== undefined) {
    assets = assets.filter(asset => asset.favorite === options.favorite);
  }

  assets.sort((a, b) => {
    const dir = options.sortOrder === 'asc' ? 1 : -1;
    if (options.sortBy === 'size') {
      return (a.size - b.size) * dir;
    }
    if (options.sortBy === 'favorite') {
      return (Number(a.favorite) - Number(b.favorite)) * dir;
    }
    return ((a.createdAt?.valueOf?.() ?? 0) - (b.createdAt?.valueOf?.() ?? 0)) * dir;
  });

  const paginated = assets.slice(options.offset, options.offset + options.limit);
  return {
    assets: paginated.map(stripMockAsset),
    total: assets.length,
    hasMore: options.offset + paginated.length < assets.length,
  };
}

export function mockCreateAsset(
  userId: string,
  data: {
    blobUrl: string;
    pathname: string;
    filename: string;
    mime: string;
    size: number;
    checksumSha256: string;
  } & AssetOptions
) {
  ensureSeedData();

  const existing = findByChecksum(userId, data.checksumSha256);
  if (existing) {
    return { asset: stripMockAsset(existing), duplicate: true };
  }

  const id = crypto.randomUUID();
  const asset: MockAsset = {
    id,
    ownerUserId: userId,
    blobUrl: data.blobUrl,
    pathname: data.pathname,
    filename: data.filename,
    mime: data.mime,
    size: data.size,
    checksumSha256: data.checksumSha256,
    width: data.width ?? null,
    height: data.height ?? null,
    favorite: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    tags: data.tags ?? [],
    embedding: buildDeterministicVector(data.filename),
  };

  mockAssets.set(id, asset);
  if (!userAssets.has(userId)) {
    userAssets.set(userId, new Set());
  }
  userAssets.get(userId)!.add(id);

  return { asset: stripMockAsset(asset), duplicate: false };
}

export function mockGetAsset(userId: string, id: string) {
  ensureSeedData();
  const asset = mockAssets.get(id);
  if (!asset || asset.ownerUserId !== userId || asset.deletedAt) {
    return null;
  }
  return stripMockAsset(asset);
}

export function mockUpdateAsset(
  userId: string,
  id: string,
  updates: Partial<Pick<MockAsset, 'favorite' | 'tags'>>
) {
  ensureSeedData();
  const asset = mockAssets.get(id);
  if (!asset || asset.ownerUserId !== userId || asset.deletedAt) {
    return null;
  }

  if (typeof updates.favorite === 'boolean') {
    asset.favorite = updates.favorite;
  }
  if (updates.tags) {
    asset.tags = updates.tags;
  }
  asset.updatedAt = new Date();

  return stripMockAsset(asset);
}

export function mockDeleteAsset(userId: string, id: string, permanent = false) {
  ensureSeedData();
  const asset = mockAssets.get(id);
  if (!asset || asset.ownerUserId !== userId) {
    return false;
  }

  if (permanent) {
    mockAssets.delete(id);
    userAssets.get(userId)?.delete(id);
  } else {
    asset.deletedAt = new Date();
  }
  return true;
}

function stripMockAsset(asset: MockAsset) {
  return {
    id: asset.id,
    blobUrl: asset.blobUrl,
    pathname: asset.pathname,
    filename: asset.filename,
    mime: asset.mime,
    size: asset.size,
    width: asset.width,
    height: asset.height,
    favorite: asset.favorite,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    tags: asset.tags.map((name, idx) => ({ id: `${asset.id}-tag-${idx}`, name })),
    embedding: asset.embedding,
  };
}

function findByChecksum(userId: string, checksum: string) {
  const ids = userAssets.get(userId);
  if (!ids) return null;
  for (const id of ids) {
    const asset = mockAssets.get(id);
    if (asset && asset.checksumSha256 === checksum && !asset.deletedAt) {
      return asset;
    }
  }
  return null;
}

export function mockSearchAssets(
  userId: string,
  query: string,
  options: { limit: number; favorite?: boolean }
) {
  ensureSeedData();
  const normalized = query.toLowerCase();
  const ids = userAssets.get(userId) ?? new Set<string>();
  const matches = Array.from(ids)
    .map(id => mockAssets.get(id)!)
    .filter(asset => !asset.deletedAt)
    .filter(asset => {
      if (options.favorite !== undefined && asset.favorite !== options.favorite) {
        return false;
      }
      const haystack = `${asset.filename} ${asset.tags.join(' ')}`.toLowerCase();
      return haystack.includes(normalized);
    })
    .map(asset => ({
      ...stripMockAsset(asset),
      similarity: Number((0.6 + Math.random() * 0.4).toFixed(2)),
      relevance: Math.floor(60 + Math.random() * 40),
    }));

  return matches.slice(0, options.limit);
}

export function mockLogSearch(userId: string, query: string, resultCount: number) {
  ensureSeedData();
  searchLogs.push({ userId, query, resultCount, createdAt: new Date() });
  if (searchLogs.length > 50) {
    searchLogs.shift();
  }
}

export function mockRecentSearches(userId: string, limit = 10) {
  ensureSeedData();
  return searchLogs
    .filter(log => log.userId === userId)
    .slice(-limit)
    .reverse();
}

export function mockPopularSearches(limit = 10) {
  ensureSeedData();
  const counts = new Map<string, number>();
  for (const log of searchLogs) {
    counts.set(log.query, (counts.get(log.query) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([query, count]) => ({ query, count }));
}

export function mockEmbeddingStatus(userId: string, id: string) {
  ensureSeedData();
  const asset = mockAssets.get(id);
  if (!asset || asset.ownerUserId !== userId || asset.deletedAt) {
    return { status: 'missing' };
  }
  return asset.embedding ? { status: 'ready' } : { status: 'pending' };
}

export function mockGenerateEmbedding(userId: string, id: string) {
  ensureSeedData();
  const asset = mockAssets.get(id);
  if (!asset || asset.ownerUserId !== userId || asset.deletedAt) {
    return null;
  }
  asset.embedding = buildDeterministicVector(asset.filename);
  asset.updatedAt = new Date();
  return stripMockAsset(asset);
}

export function resetMockStore() {
  mockAssets.clear();
  userAssets.clear();
  searchLogs.length = 0;
  seeded = false;
}
