import { NextRequest, NextResponse } from 'next/server';
import { createEmbeddingService, EmbeddingError } from '@/lib/embeddings';
import { prisma, databaseAvailable } from '@/lib/db';
import { getAuth } from '@/lib/auth/server';
import { isMockMode } from '@/lib/env';
import { mockGenerateEmbedding, mockGetAsset } from '@/lib/mock-store';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await getAuth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { imageUrl, assetId } = body;

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid imageUrl parameter' },
        { status: 400 }
      );
    }

    if (assetId) {
      if (isMockMode() || !databaseAvailable || !prisma) {
        const mockAsset = mockGetAsset(userId, assetId);
        if (!mockAsset) {
          return NextResponse.json(
            { error: 'Asset not found or not authorized' },
            { status: 404 }
          );
        }
      } else {
        const asset = await prisma.asset.findFirst({
          where: {
            id: assetId,
            ownerUserId: userId,
            deletedAt: null,
          },
        });

        if (!asset) {
          return NextResponse.json(
            { error: 'Asset not found or not authorized' },
            { status: 404 }
          );
        }
      }
    }

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

    const result = await embeddingService.embedImage(imageUrl);

    if (assetId) {
      if (isMockMode() || !databaseAvailable || !prisma) {
        mockGenerateEmbedding(userId, assetId);
      } else {
        const existingEmbedding = await prisma.assetEmbedding.findUnique({
          where: { assetId },
        });

        if (existingEmbedding) {
          // @ts-ignore - Prisma doesn't handle vector type properly
          await prisma.assetEmbedding.update({
            where: { assetId },
            data: {
              imageEmbedding: result.embedding as any,
              modelName: result.model,
              dimension: result.dimension,
              updatedAt: new Date(),
            },
          });
        } else {
          // @ts-ignore - Prisma doesn't handle vector type properly
          await prisma.assetEmbedding.create({
            data: {
              assetId,
              imageEmbedding: result.embedding as any,
              modelName: result.model,
              dimension: result.dimension,
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      embedding: result.embedding,
      model: result.model,
      dimension: result.dimension,
      processingTime: result.processingTime,
      assetId: assetId || null,
    });

  } catch (error) {
    // Error generating image embedding

    if (error instanceof EmbeddingError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate image embedding' },
      { status: 500 }
    );
  }
}
