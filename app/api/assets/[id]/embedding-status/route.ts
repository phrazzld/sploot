import { NextRequest, NextResponse } from 'next/server';
import { prisma, databaseAvailable } from '@/lib/db';
import { getAuth } from '@/lib/auth/server';
import { isMockMode } from '@/lib/env';
import { mockEmbeddingStatus, mockGetAsset } from '@/lib/mock-store';

export async function GET(
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
      const status = mockEmbeddingStatus(userId, id);
      const asset = mockGetAsset(userId, id);
      if (!asset) {
        return NextResponse.json(
          { error: 'Asset not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        assetId: asset.id,
        status: status.status === 'ready' ? 'completed' : 'pending',
        hasEmbedding: status.status === 'ready',
        embedding: status.status === 'ready'
          ? {
              modelName: 'mock/sploot-embedding:local',
              dimension: asset.embedding?.length ?? 32,
              createdAt: asset.createdAt,
            }
          : null,
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

    // Determine embedding status
    let status: 'pending' | 'completed' | 'failed' | 'unavailable';

    if (asset.embedding) {
      status = 'completed';
    } else {
      // Check if Replicate is configured
      const replicateConfigured = process.env.REPLICATE_API_TOKEN &&
                                  process.env.REPLICATE_API_TOKEN !== 'your_replicate_token_here';

      if (!replicateConfigured) {
        status = 'unavailable';
      } else {
        status = 'pending';
      }
    }

    return NextResponse.json({
      assetId: asset.id,
      status,
      hasEmbedding: !!asset.embedding,
      embedding: asset.embedding ? {
        modelName: asset.embedding.modelName,
        dimension: asset.embedding.dim,
        createdAt: asset.embedding.createdAt,
      } : null,
    });
  } catch (error) {
    // Error checking embedding status
    return NextResponse.json(
      { error: 'Failed to check embedding status' },
      { status: 500 }
    );
  }
}
