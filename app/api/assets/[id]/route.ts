import { NextRequest, NextResponse } from 'next/server';
import { getMultiLayerCache, createMultiLayerCache } from '@/lib/multi-layer-cache';
import { getAuth } from '@/lib/auth/server';
import { prisma, databaseAvailable } from '@/lib/db';
import { isMockMode } from '@/lib/env';
import { mockDeleteAsset, mockGetAsset, mockUpdateAsset } from '@/lib/mock-store';

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
      const asset = mockGetAsset(userId, id);

      if (!asset) {
        return NextResponse.json(
          { error: 'Asset not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ asset, mock: true });
    }

    const asset = await prisma.asset.findFirst({
      where: {
        id,
        ownerUserId: userId,
        deletedAt: null,
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

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

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
        updatedAt: asset.updatedAt,
        embedding: asset.embedding,
        tags: asset.tags.map((at: any) => ({
          id: at.tag.id,
          name: at.tag.name,
        })),
      },
    });
  } catch (error) {
    // Error fetching asset
    return NextResponse.json(
      { error: 'Failed to fetch asset' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const body = await req.json();
    const { favorite, tags } = body;

    if (isMockMode() || !databaseAvailable || !prisma) {
      const updated = mockUpdateAsset(userId, id, {
        favorite,
        tags: Array.isArray(tags) ? tags : undefined,
      });

      if (!updated) {
        return NextResponse.json(
          { error: 'Asset not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        asset: updated,
        message: 'Asset updated successfully',
        mock: true,
      });
    }

    const existingAsset = await prisma.asset.findFirst({
      where: {
        id,
        ownerUserId: userId,
        deletedAt: null,
      },
    });

    if (!existingAsset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    const updateData: any = {};
    if (favorite !== undefined) {
      updateData.favorite = favorite;
    }

    const asset = await prisma.asset.update({
      where: { id },
      data: updateData,
      include: {
        embedding: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (tags && Array.isArray(tags)) {
      await prisma.assetTag.deleteMany({
        where: { assetId: id },
      });

      for (const tagName of tags) {
        const tag = await prisma.tag.upsert({
          where: {
            unique_user_tag: {
              ownerUserId: userId,
              name: tagName,
            },
          },
          update: {},
          create: {
            ownerUserId: userId,
            name: tagName,
          },
        });

        await prisma.assetTag.create({
          data: {
            assetId: id,
            tagId: tag.id,
          },
        });
      }
    }

    const updatedAsset = await prisma.asset.findUnique({
      where: { id },
      include: {
        embedding: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    // Invalidate user cache after update (favorites affect search results)
    if (favorite !== undefined) {
      const multiCache = getMultiLayerCache() || createMultiLayerCache();
      await multiCache.invalidateUserData(userId);
    }

    return NextResponse.json({
      asset: {
        id: updatedAsset!.id,
        blobUrl: updatedAsset!.blobUrl,
        pathname: updatedAsset!.pathname,
        filename: updatedAsset!.pathname,
        mime: updatedAsset!.mime,
        size: updatedAsset!.size,
        width: updatedAsset!.width,
        height: updatedAsset!.height,
        favorite: updatedAsset!.favorite,
        createdAt: updatedAsset!.createdAt,
        updatedAt: updatedAsset!.updatedAt,
        embedding: updatedAsset!.embedding,
        tags: updatedAsset!.tags.map((at: any) => ({
          id: at.tag.id,
          name: at.tag.name,
        })),
      },
      message: 'Asset updated successfully',
    });
  } catch (error) {
    // Error updating asset
    return NextResponse.json(
      { error: 'Failed to update asset' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    const { searchParams } = new URL(req.url);
    const permanent = searchParams.get('permanent') === 'true';

    if (isMockMode() || !databaseAvailable || !prisma) {
      const asset = mockGetAsset(userId, id);
      if (!asset) {
        return NextResponse.json(
          { error: 'Asset not found' },
          { status: 404 }
        );
      }

      mockDeleteAsset(userId, id, permanent);
      return NextResponse.json({
        message: permanent ? 'Asset permanently deleted' : 'Asset soft deleted',
        mock: true,
      });
    }

    const existingAsset = await prisma.asset.findFirst({
      where: {
        id,
        ownerUserId: userId,
      },
    });

    if (!existingAsset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    if (permanent) {
      await prisma.assetTag.deleteMany({
        where: { assetId: id },
      });

      await prisma.assetEmbedding.deleteMany({
        where: { assetId: id },
      });

      await prisma.asset.delete({
        where: { id },
      });

      // Invalidate user cache after deletion
      const multiCache = getMultiLayerCache() || createMultiLayerCache();
      await multiCache.invalidateUserData(userId);

      return NextResponse.json({
        message: 'Asset permanently deleted',
      });
    } else {
      const asset = await prisma.asset.update({
        where: { id },
        data: {
          deletedAt: new Date(),
        },
      });

      // Invalidate user cache after soft deletion
      const multiCache = getMultiLayerCache() || createMultiLayerCache();
      await multiCache.invalidateUserData(userId);

      return NextResponse.json({
        message: 'Asset soft deleted',
        asset: {
          id: asset.id,
          deletedAt: asset.deletedAt,
        },
      });
    }
  } catch (error) {
    // Error deleting asset
    return NextResponse.json(
      { error: 'Failed to delete asset' },
      { status: 500 }
    );
  }
}
