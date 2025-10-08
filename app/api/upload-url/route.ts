import { NextRequest, NextResponse } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
import { generateUniqueFilename, isValidFileType, isValidFileSize } from '@/lib/blob';
import { requireUserIdWithSync } from '@/lib/auth/server';
import { blobConfigured } from '@/lib/env';

/**
 * Generates upload credentials for direct client-to-Blob uploads.
 *
 * Returns metadata needed for client to upload directly to Vercel Blob:
 * - assetId: Unique identifier to track this upload
 * - pathname: Unique path in blob storage
 * - token: Blob storage token for uploading
 *
 * This decouples upload from processing:
 * - Client uploads file bytes directly to Blob (network-bound, fast)
 * - Server only handles metadata (no Sharp processing, no timeouts)
 * - Processing happens async in background cron jobs
 */
export async function GET(req: NextRequest) {
  try {
    // Validate authentication
    const userId = await requireUserIdWithSync();

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const filename = searchParams.get('filename');
    const mimeType = searchParams.get('mimeType');
    const size = searchParams.get('size');

    // Validate required parameters
    if (!filename || !mimeType || !size) {
      return NextResponse.json(
        { error: 'Missing required parameters: filename, mimeType, size' },
        { status: 400 }
      );
    }

    const sizeNum = parseInt(size, 10);
    if (isNaN(sizeNum)) {
      return NextResponse.json(
        { error: 'Invalid size parameter' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!isValidFileType(mimeType)) {
      return NextResponse.json(
        {
          error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.',
          errorType: 'invalid_type',
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (!isValidFileSize(sizeNum)) {
      return NextResponse.json(
        {
          error: 'File size must be between 1 byte and 10MB',
          errorType: 'file_too_large',
        },
        { status: 400 }
      );
    }

    // Check blob storage configuration
    if (!blobConfigured) {
      return NextResponse.json(
        { error: 'Blob storage not configured' },
        { status: 500 }
      );
    }

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
      return NextResponse.json(
        { error: 'Blob storage token not configured' },
        { status: 500 }
      );
    }

    // Generate unique pathname for storage
    const pathname = generateUniqueFilename(userId, filename);

    // Generate unique asset ID (client will use this to identify upload)
    const assetId = `asset_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Return upload credentials
    // Client will use Vercel Blob SDK's put() method with these
    return NextResponse.json({
      assetId,
      pathname,
      token: blobToken,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    });

  } catch (error) {
    unstable_rethrow(error);
    console.error('[upload-url] Error generating upload URL:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate upload URL',
      },
      { status: 500 }
    );
  }
}
