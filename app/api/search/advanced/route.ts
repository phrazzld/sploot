import { NextRequest, NextResponse } from 'next/server';
import { prisma, databaseAvailable } from '@/lib/db';
import { createEmbeddingService, EmbeddingError } from '@/lib/embeddings';
import { createMultiLayerCache, getMultiLayerCache } from '@/lib/multi-layer-cache';
import { getAuth } from '@/lib/auth/server';
import { isMockMode } from '@/lib/env';
import { mockLogSearch, mockSearchAssets } from '@/lib/mock-store';

interface SearchFilters {
  favorites?: boolean;
  mimeTypes?: string[];
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
  minWidth?: number;
  minHeight?: number;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let query: string = '';
  let filters: SearchFilters = {};
  let limit: number = 30;
  let offset: number = 0;
  let threshold: number = 0.6;
  let sortBy: string = 'relevance';

  try {
    const { userId } = await getAuth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    ({
      query,
      filters = {} as SearchFilters,
      limit = 30,
      offset = 0,
      threshold = 0.6,
      sortBy = 'relevance', // 'relevance', 'date', 'favorite'
    } = body);

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid query parameter' },
        { status: 400 }
      );
    }

    const useMock = isMockMode() || !databaseAvailable || !prisma;

    if (useMock) {
      const results = mockSearchAssets(userId, query, { limit: limit + offset });
      const filtered = applyMockFilters(results, filters, sortBy);
      const paginated = filtered.slice(offset, offset + limit);

      mockLogSearch(userId, query, paginated.length);

      return NextResponse.json({
        results: paginated,
        query,
        total: filtered.length,
        limit,
        offset,
        processingTime: Date.now() - startTime,
        searchType: 'mock-metadata',
        mock: true,
      });
    }

    // Initialize multi-layer cache
    const multiCache = getMultiLayerCache() || createMultiLayerCache();

    // Check cache for advanced search results
    const cacheKey = {
      filters,
      limit,
      offset,
      threshold,
      sortBy,
    };
    const cachedResults = await multiCache.getSearchResults(userId, query, cacheKey);

    if (cachedResults) {
      // Cache hit for advanced search
      return NextResponse.json({
        results: cachedResults,
        query,
        total: cachedResults.length,
        limit,
        offset,
        processingTime: Date.now() - startTime,
        searchType: 'vector',
        cached: true,
      });
    }

    // Initialize embedding service
    let embeddingService;
    try {
      embeddingService = createEmbeddingService();
    } catch (error) {
      // Failed to initialize embedding service

      // Fallback to metadata-only search when embeddings unavailable
      const assets = await performMetadataSearch(userId, query, filters, limit, offset);

      return NextResponse.json({
        results: assets,
        query,
        total: assets.length,
        limit,
        offset,
        processingTime: Date.now() - startTime,
        searchType: 'metadata',
        error: 'Semantic search unavailable. Showing filename matches.',
      });
    }

    // Generate text embedding
    const embeddingResult = await embeddingService.embedText(query);
    const embeddingStr = `[${embeddingResult.embedding.join(',')}]`;

    // Build WHERE clause with filters
    const whereConditions = [
      `a.owner_user_id = '${userId}'`,
      `a.deleted_at IS NULL`,
      `1 - (ae.image_embedding <=> '${embeddingStr}'::vector) > ${threshold}`
    ];

    if (filters.favorites === true) {
      whereConditions.push(`a.favorite = true`);
    }

    if (filters.mimeTypes && filters.mimeTypes.length > 0) {
      const mimeList = filters.mimeTypes.map((m: string) => `'${m}'`).join(',');
      whereConditions.push(`a.mime IN (${mimeList})`);
    }

    if (filters.dateFrom) {
      whereConditions.push(`a.created_at >= '${filters.dateFrom}'::timestamp`);
    }

    if (filters.dateTo) {
      whereConditions.push(`a.created_at <= '${filters.dateTo}'::timestamp`);
    }

    if (filters.minWidth) {
      whereConditions.push(`a.width >= ${filters.minWidth}`);
    }

    if (filters.minHeight) {
      whereConditions.push(`a.height >= ${filters.minHeight}`);
    }

    // Build ORDER BY clause
    let orderByClause = '';
    switch (sortBy) {
      case 'date':
        orderByClause = 'a.created_at DESC';
        break;
      case 'favorite':
        orderByClause = 'a.favorite DESC, ae.image_embedding <=> ${embeddingStr}::vector';
        break;
      case 'relevance':
      default:
        orderByClause = 'ae.image_embedding <=> ${embeddingStr}::vector';
        break;
    }

    // Execute advanced search query
    const searchQuery = `
      SELECT
        a.id,
        a.blob_url,
        a.pathname,
        a.filename,
        a.mime,
        a.size,
        a.width,
        a.height,
        a.favorite,
        a.created_at,
        a.updated_at,
        1 - (ae.image_embedding <=> '${embeddingStr}'::vector) as similarity,
        COUNT(*) OVER() as total_count
      FROM assets a
      INNER JOIN asset_embeddings ae ON a.id = ae.asset_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ${orderByClause}
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const results = await prisma!.$queryRawUnsafe<Array<{
      id: string;
      blob_url: string;
      pathname: string;
      filename: string;
      mime: string;
      size: number;
      width: number | null;
      height: number | null;
      favorite: boolean;
      created_at: Date;
      updated_at: Date;
      similarity: number;
      total_count: bigint;
    }>>(searchQuery);

    // Handle tag filtering if specified
    let filteredResults = results;
    if (filters.tags && filters.tags.length > 0) {
      const assetIds = results.map(r => r.id);
      const assetsWithTags = await prisma!.asset.findMany({
        where: {
          id: { in: assetIds },
          tags: {
            some: {
              tag: {
                name: { in: filters.tags },
              },
            },
          },
        },
        select: { id: true },
      });

      const taggedAssetIds = new Set(assetsWithTags.map((a: any) => a.id));
      filteredResults = results.filter((r: any) => taggedAssetIds.has(r.id));
    }

    // Get tags for all results
    const resultIds = filteredResults.map((r: any) => r.id);
    const allTags = await prisma.assetTag.findMany({
      where: { assetId: { in: resultIds } },
      include: { tag: true },
    });

    // Group tags by asset
    const tagsByAsset = allTags.reduce((acc: any, at: any) => {
      if (!acc[at.assetId]) acc[at.assetId] = [];
      acc[at.assetId].push({
        id: at.tag.id,
        name: at.tag.name,
      });
      return acc;
    }, {} as Record<string, Array<{ id: string; name: string }>>);

    // Format results
    const formattedResults = filteredResults.map((result: any) => ({
      id: result.id,
      blobUrl: result.blob_url,
      pathname: result.pathname,
      filename: result.filename,
      mime: result.mime,
      size: result.size,
      width: result.width,
      height: result.height,
      favorite: result.favorite,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      similarity: result.similarity,
      relevance: Math.round(result.similarity * 100),
      tags: tagsByAsset[result.id] || [],
    }));

    const queryTime = Date.now() - startTime;
    const totalCount = results.length > 0 ? Number(results[0].total_count) : 0;

    // Cache the search results
    if (formattedResults.length > 0) {
      const cacheKey = {
        filters,
        limit,
        offset,
        threshold,
        sortBy,
      };
      await multiCache.setSearchResults(userId, query, formattedResults, cacheKey);
    }

    // Log search
    prisma.searchLog.create({
      data: {
        userId,
        query,
        resultCount: formattedResults.length,
        queryTime,
      },
    }).catch(() => {});

    return NextResponse.json({
      results: formattedResults,
      query,
      filters,
      sortBy,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
      processingTime: queryTime,
      embeddingModel: embeddingResult.model,
      searchType: 'semantic',
      cached: false,
    });

  } catch (error) {
    // Error performing advanced search

    if (error instanceof EmbeddingError) {
      return NextResponse.json(
        {
          error: error.message,
          results: [],
          query: query || '',
          pagination: { total: 0, limit: limit || 30, offset: offset || 0, hasMore: false },
        },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to perform advanced search',
        results: [],
        query: query || '',
        pagination: { total: 0, limit: limit || 30, offset: offset || 0, hasMore: false },
      },
      { status: 500 }
    );
  }
}

// Fallback metadata search when embeddings are unavailable
async function performMetadataSearch(
  userId: string,
  query: string,
  filters: SearchFilters,
  limit: number,
  offset: number
) {
  const where: any = {
    ownerUserId: userId,
    deletedAt: null,
    filename: {
      contains: query,
      mode: 'insensitive',
    },
  };

  if (filters.favorites === true) {
    where.favorite = true;
  }

  if (filters.mimeTypes && filters.mimeTypes.length > 0) {
    where.mime = { in: filters.mimeTypes };
  }

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
  }

  if (filters.minWidth) {
    where.width = { gte: filters.minWidth };
  }

  if (filters.minHeight) {
    where.height = { gte: filters.minHeight };
  }

  const assets = await prisma.asset.findMany({
    where,
    take: limit,
    skip: offset,
    orderBy: { createdAt: 'desc' },
    include: {
      tags: {
        include: {
          tag: true,
        },
      },
    },
  });

  return assets.map((asset: any) => ({
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
    similarity: 0,
    relevance: 0,
    tags: asset.tags.map((at: any) => ({
      id: at.tag.id,
      name: at.tag.name,
    })),
  }));
}

function applyMockFilters(results: any[], filters: SearchFilters, sortBy: string) {
  let filtered = [...results];

  if (filters.favorites === true) {
    filtered = filtered.filter(item => item.favorite);
  }

  if (filters.mimeTypes && filters.mimeTypes.length > 0) {
    filtered = filtered.filter(item => filters.mimeTypes!.includes(item.mime));
  }

  if (filters.tags && filters.tags.length > 0) {
    filtered = filtered.filter(item =>
      item.tags?.some((tag: any) => filters.tags!.includes(tag.name))
    );
  }

  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom);
    filtered = filtered.filter(item => new Date(item.createdAt) >= from);
  }

  if (filters.dateTo) {
    const to = new Date(filters.dateTo);
    filtered = filtered.filter(item => new Date(item.createdAt) <= to);
  }

  if (filters.minWidth) {
    filtered = filtered.filter(item => (item.width ?? 0) >= filters.minWidth!);
  }

  if (filters.minHeight) {
    filtered = filtered.filter(item => (item.height ?? 0) >= filters.minHeight!);
  }

  switch (sortBy) {
    case 'date':
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    case 'favorite':
      filtered.sort((a, b) => Number(b.favorite) - Number(a.favorite));
      break;
    case 'relevance':
    default:
      filtered.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
      break;
  }

  return filtered;
}
