import { NextRequest, NextResponse } from 'next/server';
import { isValidFileType, isValidFileSize } from '@/lib/blob';
import { createEmbeddingService, EmbeddingError } from '@/lib/embeddings';
import crypto from 'crypto';
import { getMultiLayerCache, createMultiLayerCache } from '@/lib/multi-layer-cache';
import { getAuthWithUser, requireUserIdWithSync } from '@/lib/auth/server';
import { prisma, upsertAssetEmbedding } from '@/lib/db';
import logger from '@/lib/logger';
import { logError } from '@/lib/vercel-logger';
import { createErrorResponse } from '@/lib/error-response';

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const userId = await requireUserIdWithSync();

    const body = await req.json();
    const {
      blobUrl,
      pathname,
      filename,
      mimeType,
      size,
      checksum,
      width,
      height,
    } = body;

    if (!blobUrl || !pathname || !filename || !mimeType || !size) {
      return NextResponse.json(
        { error: 'Missing required parameters: blobUrl, pathname, filename, mimeType, size' },
        { status: 400 }
      );
    }

    if (!isValidFileType(mimeType)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.' },
        { status: 400 }
      );
    }

    if (!isValidFileSize(size)) {
      return NextResponse.json(
        { error: 'File size must be between 1 byte and 10MB' },
        { status: 400 }
      );
    }

    const checksumSha256 = checksum || crypto.randomBytes(32).toString('hex');

    if (!prisma) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const existingAsset = await prisma.asset.findFirst({
      where: {
        ownerUserId: userId,
        checksumSha256: checksumSha256,
        deletedAt: null,
      },
    });

    if (existingAsset) {
      return NextResponse.json({
        asset: {
          id: existingAsset.id,
          blobUrl: existingAsset.blobUrl,
          pathname: existingAsset.pathname,
          filename: existingAsset.pathname.split('/').pop() || existingAsset.pathname,
          mime: existingAsset.mime,
          size: existingAsset.size,
          width: existingAsset.width,
          height: existingAsset.height,
          favorite: existingAsset.favorite,
          createdAt: existingAsset.createdAt,
        },
        message: 'Asset already exists',
        duplicate: true,
      });
    }

    const asset = await prisma.asset.create({
      data: {
        ownerUserId: userId,
        blobUrl,
        pathname,
        mime: mimeType,
        size,
        checksumSha256,
        width: width || null,
        height: height || null,
        favorite: false,
      },
      include: {
        embedding: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    // Generate embedding asynchronously (non-blocking)
    let embeddingStatus = 'pending';
    let embeddingError = null;

    try {
      const embeddingService = createEmbeddingService();

      // Start embedding generation in background
      generateEmbeddingAsync(asset.id, blobUrl, checksumSha256, embeddingService).catch(error => {
        // Failed to generate embedding
      });

      embeddingStatus = 'processing';
    } catch (error) {
      // Embedding service not configured - continue without embeddings
      // Embedding service not available
      embeddingStatus = 'unavailable';
      embeddingError = error instanceof EmbeddingError ? error.message : 'Embedding service not configured';
    }

    // Invalidate user cache after creating new asset
    const multiCache = getMultiLayerCache() || createMultiLayerCache();
    await multiCache.invalidateUserData(userId);

    return NextResponse.json({
      asset: {
        id: asset.id,
        blobUrl: asset.blobUrl,
        pathname: asset.pathname,
        filename: asset.pathname,
        mime: asset.mime,
        size: asset.size,
        width: asset.width,
        height: asset.height,
        favorite: asset.favorite,
        createdAt: asset.createdAt,
        embedding: asset.embedding,
        embeddingStatus,
        embeddingError,
        tags: asset.tags.map((at: any) => ({
          id: at.tag.id,
          name: at.tag.name,
        })),
      },
      message: 'Asset created successfully',
    });
  } catch (error) {
    logError('POST /api/assets', error, { requestId });
    return createErrorResponse(
      'Failed to create asset',
      requestId,
      req,
      error instanceof Error ? error.message : undefined
    );
  }
}

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();

  // Declare params outside try block so they're accessible in catch for logging
  let limit = 50;
  let offset = 0;
  let sortBy: 'createdAt' | 'updatedAt' = 'createdAt';
  let sortOrder: 'asc' | 'desc' = 'desc';
  let favorite: string | null = null;
  let tagId: string | null = null;

  try {
    // Parse query params INSIDE try block to catch URL parsing errors
    const { searchParams } = new URL(req.url);
    limit = parseInt(searchParams.get('limit') || '50', 10);
    offset = parseInt(searchParams.get('offset') || '0', 10);

    // Validate and type-cast sortBy to valid Prisma field names
    const sortByParam = searchParams.get('sortBy') || 'createdAt';
    const validSortFields = ['createdAt', 'updatedAt'] as const;
    sortBy = validSortFields.includes(sortByParam as any)
      ? (sortByParam as 'createdAt' | 'updatedAt')
      : 'createdAt';

    // Validate and type-cast sortOrder to Prisma's expected literal type
    const sortOrderParam = searchParams.get('sortOrder') || 'desc';
    sortOrder = sortOrderParam === 'asc' ? 'asc' : 'desc';

    favorite = searchParams.get('favorite');
    tagId = searchParams.get('tagId');

    const { userId } = await getAuthWithUser();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const where = {
      ownerUserId: userId,
      deletedAt: null,
      ...(favorite !== null && { favorite: favorite === 'true' }),
      ...(tagId && {
        tags: {
          some: {
            tagId: tagId,
          },
        },
      }),
    };

    if (!prisma) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: sortBy === 'createdAt'
          ? { createdAt: sortOrder }
          : { updatedAt: sortOrder },
        include: {
          embedding: true,
          tags: {
            include: {
              tag: true,
            },
          },
        },
      }),
      prisma.asset.count({ where }),
    ]);

    const formattedAssets = assets.map((asset: any) => ({
      id: asset.id,
      blobUrl: asset.blobUrl,
      pathname: asset.pathname,
      filename: asset.pathname,
      mime: asset.mime,
      size: asset.size,
      width: asset.width,
      height: asset.height,
      favorite: asset.favorite,
      createdAt: asset.createdAt,
      embedding: asset.embedding,
      tags: asset.tags.map((at: any) => ({
        id: at.tag.id,
        name: at.tag.name,
      })),
    }));

    return NextResponse.json({
      assets: formattedAssets,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    logError('GET /api/assets', error, {
      requestId,
      params: { limit, offset, sortBy, sortOrder, favorite, tagId },
    });
    return createErrorResponse(
      'Failed to fetch assets',
      requestId,
      req,
      error instanceof Error ? error.message : undefined
    );
  }
}

// Async function to generate embeddings without blocking the upload
async function generateEmbeddingAsync(
  assetId: string,
  imageUrl: string,
  checksum: string,
  embeddingService: any
): Promise<void> {
  if (!prisma) {
    return;
  }

  try {
    // Generate the embedding
    const result = await embeddingService.embedImage(imageUrl, checksum);

    // Check if embedding already exists
    const existingEmbedding = await prisma.assetEmbedding.findUnique({
      where: { assetId },
    });

    await upsertAssetEmbedding({
      assetId,
      modelName: result.model,
      modelVersion: result.model,
      dim: result.dimension,
      embedding: result.embedding,
    });

    // Successfully generated embedding
  } catch (error) {
    // Failed to generate embedding
    // Could update a status field in the asset table to mark embedding as failed
    // For now, we just log the error
  }
}
