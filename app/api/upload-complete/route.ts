import { NextRequest, NextResponse } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
import { requireUserIdWithSync } from '@/lib/auth/server';
import { prisma, assetExists } from '@/lib/db';
import { del } from '@vercel/blob';
import crypto from 'crypto';

/**
 * Finalizes a client-side upload by creating the asset record in database.
 *
 * This endpoint completes the direct-to-Blob upload flow:
 * 1. Client uploaded file directly to Blob
 * 2. Client calls this endpoint with blob URL and metadata
 * 3. Server fetches blob, calculates checksum, checks for duplicates
 * 4. Server creates asset record with processed=false, embedded=false
 * 5. Background cron jobs handle image processing + embedding generation
 *
 * Fast path: <200ms (no Sharp processing, no Replicate API calls)
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Validate authentication
    const userId = await requireUserIdWithSync();

    // Parse request body
    const body = await req.json();
    const { assetId, blobUrl, pathname, filename, size, mimeType, checksum } = body;

    // Validate required fields
    if (!assetId || !blobUrl || !pathname || !filename || !size || !mimeType || !checksum) {
      return NextResponse.json(
        {
          error: 'Missing required fields: assetId, blobUrl, pathname, filename, size, mimeType, checksum',
        },
        { status: 400 }
      );
    }

    // Validate checksum format (64 hex characters for SHA-256)
    if (!/^[a-f0-9]{64}$/.test(checksum)) {
      return NextResponse.json(
        { error: 'Invalid checksum format. Expected 64 hex characters (SHA-256)' },
        { status: 400 }
      );
    }

    console.log(`[upload-complete] Processing upload with checksum: ${checksum} (${Date.now() - startTime}ms)`);

    if (!prisma) {
      return NextResponse.json(
        { error: 'Database unavailable' },
        { status: 503 }
      );
    }

    // Check for duplicate via checksum
    const existingAsset = await assetExists(userId, checksum, {
      includeEmbedding: true,
    });

    if (existingAsset) {
      console.log(`[upload-complete] Duplicate detected: ${existingAsset.id} (${Date.now() - startTime}ms)`);

      // Delete the duplicate blob we just uploaded
      try {
        await del(blobUrl);
        console.log(`[upload-complete] Deleted duplicate blob: ${blobUrl}`);
      } catch (delError) {
        console.error('[upload-complete] Failed to delete duplicate blob:', delError);
        // Continue even if deletion fails - not critical
      }

      // Return existing asset
      return NextResponse.json({
        success: true,
        isDuplicate: true,
        asset: {
          id: existingAsset.id,
          blobUrl: existingAsset.blobUrl,
          pathname: existingAsset.pathname,
          mimeType: existingAsset.mime,
          size: existingAsset.size,
          checksum: existingAsset.checksumSha256,
          createdAt: existingAsset.createdAt,
          processed: false, // Existing assets created before this change won't have this flag
          embedded: existingAsset.hasEmbedding,
        },
      });
    }

    // Create new asset record
    // DO NOT process image or generate embeddings here
    // Background cron jobs will handle those asynchronously
    const asset = await prisma.asset.create({
      data: {
        ownerUserId: userId,
        blobUrl,
        pathname,
        mime: mimeType,
        size,
        checksumSha256: checksum,
        // Processing state flags (new fields from schema change)
        processed: false, // Image processing pending
        embedded: false, // Embedding generation pending
      },
    });

    console.log(`[upload-complete] Created asset ${asset.id} in ${Date.now() - startTime}ms`);

    return NextResponse.json({
      success: true,
      isDuplicate: false,
      asset: {
        id: asset.id,
        blobUrl: asset.blobUrl,
        pathname: asset.pathname,
        mimeType: asset.mime,
        size: asset.size,
        checksum: asset.checksumSha256,
        createdAt: asset.createdAt,
        processed: false,
        embedded: false,
        needsProcessing: true, // Signal to client that background jobs will process
      },
    });

  } catch (error) {
    unstable_rethrow(error);
    console.error('[upload-complete] Error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to complete upload',
      },
      { status: 500 }
    );
  }
}
