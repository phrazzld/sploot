import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { generateUniqueFilename, isValidFileType, isValidFileSize } from '@/lib/blob';
import { requireUserIdWithSync } from '@/lib/auth/server';
import { blobConfigured, isMockMode } from '@/lib/env';
import { prisma, databaseAvailable } from '@/lib/db';
import crypto from 'crypto';

/**
 * Direct file upload endpoint - handles file upload server-side
 * This is more reliable than client-side uploads for the initial implementation
 */
export async function POST(req: NextRequest) {
  try {
    // Check authentication and ensure user exists in database
    const userId = await requireUserIdWithSync();

    // Parse the multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!isValidFileType(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Only JPEG, PNG, WebP, and GIF images are allowed.` },
        { status: 400 }
      );
    }

    // Validate file size
    if (!isValidFileSize(file.size)) {
      return NextResponse.json(
        { error: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds the 10MB limit` },
        { status: 400 }
      );
    }

    // Generate unique filename for storage
    const uniqueFilename = generateUniqueFilename(userId, file.name);

    // Handle mock mode for development
    if (isMockMode() || !blobConfigured) {
      console.log('Mock mode: Simulating file upload');

      // Create mock asset record
      const mockAsset = {
        id: crypto.randomUUID(),
        blobUrl: `https://mock-storage.local/${uniqueFilename}`,
        pathname: uniqueFilename,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        createdAt: new Date().toISOString(),
      };

      return NextResponse.json({
        success: true,
        asset: mockAsset,
        message: 'File uploaded successfully (mock mode)'
      });
    }

    // Upload to Vercel Blob storage
    try {
      const blob = await put(uniqueFilename, file, {
        access: 'public',
        addRandomSuffix: false,
      });

      // Calculate file checksum for deduplication
      const buffer = Buffer.from(await file.arrayBuffer());
      const checksum = crypto
        .createHash('sha256')
        .update(buffer)
        .digest('hex');

      // Create asset record in database (required for the asset to be visible)
      if (!databaseAvailable || !prisma) {
        // Clean up uploaded file if database is not available
        try {
          const { del } = await import('@vercel/blob');
          await del(blob.url);
        } catch (cleanupError) {
          console.error('Failed to cleanup uploaded file:', cleanupError);
        }

        return NextResponse.json(
          { error: 'Database unavailable. Cannot complete upload.' },
          { status: 503 }
        );
      }

      try {
        const asset = await prisma.asset.create({
          data: {
            ownerUserId: userId,
            blobUrl: blob.url,
            pathname: blob.pathname,
            mime: file.type,
            size: file.size,
            checksumSha256: checksum,
            favorite: false,
          },
        });

        return NextResponse.json({
          success: true,
          asset: {
            id: asset.id,
            blobUrl: asset.blobUrl,
            pathname: asset.pathname,
            filename: file.name,
            mimeType: asset.mime,
            size: asset.size,
            checksum: asset.checksumSha256,
            createdAt: asset.createdAt,
          },
          message: 'File uploaded successfully'
        });

      } catch (dbError) {
        console.error('Database error creating asset:', dbError);

        // Clean up uploaded file since database record creation failed
        try {
          const { del } = await import('@vercel/blob');
          await del(blob.url);
        } catch (cleanupError) {
          console.error('Failed to cleanup uploaded file:', cleanupError);
        }

        return NextResponse.json(
          {
            error: 'Failed to save image to database. Upload cancelled.',
            details: process.env.NODE_ENV === 'development' ? String(dbError) : undefined
          },
          { status: 500 }
        );
      }

    } catch (uploadError) {
      console.error('Vercel Blob upload error:', uploadError);

      // Provide detailed error message
      let errorMessage = 'Failed to upload file to storage';

      if (uploadError instanceof Error) {
        if (uploadError.message.includes('Invalid token')) {
          errorMessage = 'Invalid storage token. Please check your BLOB_READ_WRITE_TOKEN.';
        } else if (uploadError.message.includes('Network')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (uploadError.message.includes('quota')) {
          errorMessage = 'Storage quota exceeded. Please upgrade your plan or delete some files.';
        }
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Upload endpoint error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Upload failed',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}

// GET endpoint for checking upload service status
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserIdWithSync();
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    status: 'ready',
    blobConfigured,
    databaseAvailable,
    mockMode: isMockMode(),
    limits: {
      maxFileSize: '10MB',
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    }
  });
}