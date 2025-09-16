import { NextRequest, NextResponse } from 'next/server';
import { generateUniqueFilename, isValidFileType, isValidFileSize } from '@/lib/blob';
import { getAuth } from '@/lib/auth/server';

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await getAuth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { filename, mimeType, size } = body;

    // Validate request parameters
    if (!filename || !mimeType || !size) {
      return NextResponse.json(
        { error: 'Missing required parameters: filename, mimeType, size' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!isValidFileType(mimeType)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (!isValidFileSize(size)) {
      return NextResponse.json(
        { error: 'File size must be between 1 byte and 10MB' },
        { status: 400 }
      );
    }

    // Generate unique filename for storage
    const uniqueFilename = generateUniqueFilename(userId, filename);

    // For client-side uploads, we return the upload configuration
    // The actual upload will happen directly from the client to Vercel Blob
    const uploadUrl = await generateUploadUrl(uniqueFilename);

    return NextResponse.json({
      uploadUrl,
      pathname: uniqueFilename,
      method: 'PUT',
      headers: {
        'content-type': mimeType,
      }
    });

  } catch (error) {
    // Error generating upload URL
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}

/**
 * Generates a pre-signed upload URL for client-side uploads
 * In production, this will use Vercel Blob's client upload feature
 */
async function generateUploadUrl(pathname: string): Promise<string> {
  // Check if we have a blob token configured
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

  if (!blobToken || blobToken === 'your_blob_token_here') {
    // Return a mock URL for development
    // Blob storage not configured. Using mock upload URL.
    return `https://mock-blob-storage.local/upload/${pathname}`;
  }

  // In production with Vercel Blob configured, you would generate
  // a pre-signed URL here. For now, we'll return a placeholder
  // that indicates the blob storage is ready to be configured

  // When properly configured with Vercel Blob, this would use:
  // const { url } = await put(pathname, { access: 'public', token: blobToken });

  return `https://your-project.vercel-storage.com/upload/${pathname}`;
}
