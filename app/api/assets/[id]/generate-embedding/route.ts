import { NextRequest, NextResponse } from 'next/server';
import { prisma, databaseAvailable, upsertAssetEmbedding } from '@/lib/db';
import { createEmbeddingService, EmbeddingError } from '@/lib/embeddings';
import { getAuth } from '@/lib/auth/server';
import { isMockMode } from '@/lib/env';
import { mockGenerateEmbedding } from '@/lib/mock-store';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getAuth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (isMockMode() || !databaseAvailable || !prisma) {
      const asset = mockGenerateEmbedding(userId, id);
      if (!asset) {
        return NextResponse.json(
          { error: 'Asset not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Embedding generated successfully',
        embedding: {
          modelName: 'mock/sploot-embedding:local',
          dimension: asset.embedding?.length ?? 32,
          processingTime: 1,
          createdAt: asset.updatedAt,
        },
        mock: true,
      });
    }

    const asset = await prisma.asset.findFirst({
      where: {
        id,
        ownerUserId: userId,
        deletedAt: null,
      },
      include: {
        embedding: true,
      },
    });

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Check if embedding already exists
    if (asset.embedding) {
      return NextResponse.json({
        message: 'Embedding already exists',
        embedding: {
          modelName: asset.embedding.modelName,
          dimension: asset.embedding.dim,
          createdAt: asset.embedding.createdAt,
        },
      });
    }

    // Generate embedding
    let embeddingService;
    try {
      embeddingService = createEmbeddingService();
    } catch (error) {
      // Failed to initialize embedding service
      return NextResponse.json(
        {
          error: 'Embedding service not configured',
          details: 'Replicate API token not set. Please configure REPLICATE_API_TOKEN in your environment variables.'
        },
        { status: 503 }
      );
    }

    const result = await embeddingService.embedImage(asset.blobUrl, asset.checksumSha256);

    // Store embedding in database
    const embedding = await upsertAssetEmbedding({
      assetId: asset.id,
      modelName: result.model,
      modelVersion: result.model,
      dim: result.dimension,
      embedding: result.embedding,
    });

    if (!embedding) {
      throw new Error('Failed to persist embedding record');
    }

    return NextResponse.json({
      success: true,
      message: 'Embedding generated successfully',
      embedding: {
        modelName: embedding.modelName,
        dimension: embedding.dim,
        processingTime: result.processingTime,
        createdAt: embedding.createdAt,
      },
    });
  } catch (error) {
    // Error generating embedding

    if (error instanceof EmbeddingError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate embedding' },
      { status: 500 }
    );
  }
}
