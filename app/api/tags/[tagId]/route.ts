import { NextRequest, NextResponse } from 'next/server';
import { requireUserIdWithSync } from '@/lib/auth/server';
import { prisma, databaseAvailable } from '@/lib/db';

/**
 * PATCH /api/tags/[tagId] - Update a tag
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tagId: string }> }
) {
  try {
    const { tagId } = await params;
    const userId = await requireUserIdWithSync();
    const { name, color } = await req.json();

    if (!databaseAvailable || !prisma) {
      return NextResponse.json(
        { error: 'Database unavailable' },
        { status: 503 }
      );
    }

    // Verify tag ownership
    const existingTag = await prisma.tag.findFirst({
      where: {
        id: tagId,
        ownerUserId: userId,
      },
    });

    if (!existingTag) {
      return NextResponse.json(
        { error: 'Tag not found' },
        { status: 404 }
      );
    }

    // Check if new name conflicts with existing tag
    if (name && name !== existingTag.name) {
      const conflictingTag = await prisma.tag.findFirst({
        where: {
          ownerUserId: userId,
          name: name.trim().toLowerCase(),
          NOT: {
            id: tagId,
          },
        },
      });

      if (conflictingTag) {
        return NextResponse.json(
          { error: 'Tag with this name already exists' },
          { status: 409 }
        );
      }
    }

    const updatedTag = await prisma.tag.update({
      where: {
        id: tagId,
      },
      data: {
        ...(name && { name: name.trim().toLowerCase() }),
        ...(color !== undefined && { color }),
      },
    });

    return NextResponse.json({
      success: true,
      tag: {
        id: updatedTag.id,
        name: updatedTag.name,
        color: updatedTag.color,
        updatedAt: updatedTag.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating tag:', error);
    return NextResponse.json(
      { error: 'Failed to update tag' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tags/[tagId] - Delete a tag
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tagId: string }> }
) {
  try {
    const { tagId } = await params;
    const userId = await requireUserIdWithSync();

    if (!databaseAvailable || !prisma) {
      return NextResponse.json(
        { error: 'Database unavailable' },
        { status: 503 }
      );
    }

    // Verify tag ownership
    const existingTag = await prisma.tag.findFirst({
      where: {
        id: tagId,
        ownerUserId: userId,
      },
    });

    if (!existingTag) {
      return NextResponse.json(
        { error: 'Tag not found' },
        { status: 404 }
      );
    }

    // Delete tag (cascade will remove AssetTag associations)
    await prisma.tag.delete({
      where: {
        id: tagId,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Tag deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting tag:', error);
    return NextResponse.json(
      { error: 'Failed to delete tag' },
      { status: 500 }
    );
  }
}