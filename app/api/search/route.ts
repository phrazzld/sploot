import { NextRequest, NextResponse } from 'next/server';
import { prisma, databaseAvailable, vectorSearch, logSearch } from '@/lib/db';
import { createEmbeddingService, EmbeddingError } from '@/lib/embeddings';
import { createMultiLayerCache, getMultiLayerCache } from '@/lib/multi-layer-cache';
import { getAuthWithUser } from '@/lib/auth/server';
import { isMockMode } from '@/lib/env';
import { mockLogSearch, mockPopularSearches, mockRecentSearches, mockSearchAssets } from '@/lib/mock-store';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let query: string = '';
  let limit: number = 30;
  let threshold: number = 0.6;

  try {
    const { userId } = await getAuthWithUser();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    ({ query, limit = 30, threshold = 0.6 } = body);

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid query parameter' },
        { status: 400 }
      );
    }

    if (query.length > 500) {
      return NextResponse.json(
        { error: 'Query text too long (max 500 characters)' },
        { status: 400 }
      );
    }

    const useMock = isMockMode() || !databaseAvailable || !prisma;

    // Initialize multi-layer cache
    const multiCache = useMock ? null : (getMultiLayerCache() || createMultiLayerCache());

    let cachedResults: any[] | null = null;
    if (multiCache) {
      cachedResults = await multiCache.getSearchResults(
        userId,
        query,
        { limit, threshold }
      );
    }

    if (cachedResults) {
      // Cache hit for search
      return NextResponse.json({
        results: cachedResults,
        query,
        total: cachedResults.length,
        limit,
        threshold,
        processingTime: Date.now() - startTime,
        cached: true,
      });
    }

    if (useMock) {
      const results = mockSearchAssets(userId, query, { limit });
      mockLogSearch(userId, query, results.length);
      return NextResponse.json({
        results,
        query,
        total: results.length,
        limit,
        threshold,
        processingTime: Date.now() - startTime,
        embeddingModel: 'mock/sploot-embedding:local',
        cached: false,
        mock: true,
      });
    }

    // Initialize embedding service
    let embeddingService;
    try {
      embeddingService = createEmbeddingService();
    } catch (error) {
      // Failed to initialize embedding service

      // Return empty results when embedding service is unavailable
      return NextResponse.json({
        results: [],
        query,
        total: 0,
        limit,
        processingTime: Date.now() - startTime,
        error: 'Search is currently unavailable. Please configure Replicate API token.',
      });
    }

    // Generate text embedding for the query
    const embeddingResult = await embeddingService.embedText(query);

    // Perform vector similarity search
    const searchResults = await vectorSearch(
      userId,
      embeddingResult.embedding,
      { limit, threshold }
    );

    // Format results with additional metadata
    const formattedResults = await Promise.all(
      searchResults.map(async (result: any) => {
        // Get tags for each asset
        const assetTags = await prisma.assetTag.findMany({
          where: { assetId: result.id },
          include: { tag: true },
        });

        return {
          id: result.id,
          blobUrl: result.blob_url,
          pathname: result.pathname,
          mime: result.mime,
          width: result.width,
          height: result.height,
          favorite: result.favorite,
          createdAt: result.created_at,
          similarity: result.distance, // 0-1 score, higher is better
          relevance: Math.round(result.distance * 100), // Percentage for UI
          tags: assetTags.map((at: any) => ({
            id: at.tag.id,
            name: at.tag.name,
          })),
        };
      })
    );

    const queryTime = Date.now() - startTime;

    // Cache the search results
    if (formattedResults.length > 0 && multiCache) {
      await multiCache.setSearchResults(
        userId,
        query,
        formattedResults,
        { limit, threshold }
      );
    }

    // Log search for analytics (non-blocking)
    logSearch(userId, query, formattedResults.length, queryTime).catch(error => {
      // Failed to log search
    });

    return NextResponse.json({
      results: formattedResults,
      query,
      total: formattedResults.length,
      limit,
      threshold,
      processingTime: queryTime,
      embeddingModel: embeddingResult.model,
      cached: false,
    });

  } catch (error) {
    // Error performing search

    if (error instanceof EmbeddingError) {
      return NextResponse.json(
        {
          error: error.message,
          results: [],
          query: query || '',
          total: 0,
        },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to perform search',
        results: [],
        query: query || '',
        total: 0,
      },
      { status: 500 }
    );
  }
}

// GET endpoint for search suggestions or recent searches
export async function GET(req: NextRequest) {
  try {
    const { userId } = await getAuthWithUser();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'recent';

    const useMock = isMockMode() || !databaseAvailable || !prisma;

    if (type === 'recent') {
      if (useMock) {
        const searches = mockRecentSearches(userId);
        return NextResponse.json({
          searches: searches.map((log) => ({
            query: log.query,
            resultCount: log.resultCount,
            timestamp: log.createdAt,
          })),
          mock: true,
        });
      }

      const recentSearches = await prisma.searchLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        distinct: ['query'],
      });

      return NextResponse.json({
        searches: recentSearches.map((log: any) => ({
          query: log.query,
          resultCount: log.resultCount,
          timestamp: log.createdAt,
        })),
      });
    }

    if (type === 'popular') {
      if (useMock) {
        const popular = mockPopularSearches();
        return NextResponse.json({
          searches: popular.map(item => ({
            query: item.query,
            count: item.count,
          })),
          mock: true,
        });
      }

      const popularSearches = await prisma.searchLog.groupBy({
        by: ['query'],
        _count: {
          query: true,
        },
        orderBy: {
          _count: {
            query: 'desc',
          },
        },
        take: 10,
      });

      return NextResponse.json({
        searches: popularSearches.map((item: any) => ({
          query: item.query,
          count: item._count.query,
        })),
      });
    }

    return NextResponse.json(
      { error: 'Invalid search type. Use "recent" or "popular".' },
      { status: 400 }
    );

  } catch (error) {
    // Error fetching search suggestions
    return NextResponse.json(
      { error: 'Failed to fetch search suggestions' },
      { status: 500 }
    );
  }
}
