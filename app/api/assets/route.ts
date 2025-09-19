import { NextRequest, NextResponse } from 'next/server';
import { isValidFileType, isValidFileSize } from '@/lib/blob';
import { createEmbeddingService, EmbeddingError } from '@/lib/embeddings';
import crypto from 'crypto';
import { getMultiLayerCache, createMultiLayerCache } from '@/lib/multi-layer-cache';
import { getAuthWithUser, requireUserIdWithSync } from '@/lib/auth/server';
import { prisma, databaseAvailable } from '@/lib/db';
import { isMockMode } from '@/lib/env';
import {
  mockCreateAsset,
  mockListAssets,
} from '@/lib/mock-store';

export async function POST(req: NextRequest) {
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

    if (isMockMode() || !databaseAvailable || !prisma) {
      const mockResult = mockCreateAsset(userId, {
        blobUrl: blobUrl || `https://mock-blob-storage.local/${pathname}`,
        pathname,
        filename: filename || pathname,
        mime: mimeType,
        size,
        checksumSha256,
        width: width ?? null,
        height: height ?? null,
      });

      if (mockResult.duplicate) {
        return NextResponse.json({
          asset: mockResult.asset,
          message: 'Asset already exists',
          duplicate: true,
          mock: true,
        });
      }

      return NextResponse.json({
        asset: mockResult.asset,
        message: 'Asset created successfully',
        mock: true,
      });
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
    // Error creating asset
    return NextResponse.json(
      { error: 'Failed to create asset' },
      { status: 500 }
    );
  }
}

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
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const favorite = searchParams.get('favorite');
    const tagId = searchParams.get('tagId');

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

    if (isMockMode() || !databaseAvailable || !prisma) {
      const result = mockListAssets(userId, {
        limit,
        offset,
        favorite: favorite !== null ? favorite === 'true' : undefined,
        sortBy,
        sortOrder: sortOrder as 'asc' | 'desc',
      });

      return NextResponse.json({
        assets: result.assets,
        pagination: {
          limit,
          offset,
          total: result.total,
          hasMore: result.hasMore,
        },
        mock: true,
      });
    }

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: {
          [sortBy]: sortOrder,
        },
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
    // Error fetching assets
    return NextResponse.json(
      { error: 'Failed to fetch assets' },
      { status: 500 }
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
  if (!prisma || isMockMode()) {
    return;
  }

  try {
    // Generate the embedding
    const result = await embeddingService.embedImage(imageUrl, checksum);

    // Check if embedding already exists
    const existingEmbedding = await prisma.assetEmbedding.findUnique({
      where: { assetId },
    });

    if (existingEmbedding) {
      // Update existing embedding
      // @ts-ignore - Prisma doesn't handle vector type properly
      await prisma.assetEmbedding.update({
        where: { assetId },
        data: {
          imageEmbedding: result.embedding as any,
          modelName: result.model,
          modelVersion: result.model,
          dim: result.dimension,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new embedding
      // @ts-ignore - Prisma doesn't handle vector type properly
      await prisma.assetEmbedding.create({
        data: {
          assetId,
          imageEmbedding: result.embedding as any,
          modelName: result.model,
          modelVersion: result.model,
          dim: result.dimension,
        },
      });
    }

    // Successfully generated embedding
  } catch (error) {
    // Failed to generate embedding
    // Could update a status field in the asset table to mark embedding as failed
    // For now, we just log the error
  }
}
