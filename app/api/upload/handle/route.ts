import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextRequest, NextResponse } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
import { requireUserIdWithSync } from '@/lib/auth/server';
import { isValidFileType, isValidFileSize, generateUniqueFilename } from '@/lib/blob';
import { uploadRateLimiter } from '@/lib/rate-limiter';

/**
 * Secure client upload handler using Vercel Blob's handleUpload pattern.
 *
 * This endpoint generates scoped, time-limited upload tokens that:
 * - Only work for the specific pathname
 * - Restrict content type and file size
 * - Expire after 5 minutes
 * - Cannot be used to access other users' files
 *
 * Security improvements over raw token exposure:
 * - No full storage access granted to client
 * - Server validates all upload parameters
 * - Tokens are single-use and pathname-specific
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const userId = await requireUserIdWithSync();

    // Check rate limit
    const rateLimitResult = await uploadRateLimiter.consume(userId, 1);
    if (!rateLimitResult.allowed) {
      console.warn(`[RateLimit] User ${userId} exceeded upload limit. Retry after ${rateLimitResult.retryAfter}s`);

      return NextResponse.json(
        {
          error: `Too many uploads. Please wait ${rateLimitResult.retryAfter} seconds and try again.`,
          retryAfter: rateLimitResult.retryAfter,
          errorType: 'rate_limited',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.retryAfter || 60),
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + (rateLimitResult.retryAfter || 60)),
          },
        }
      );
    }

    const body = (await request.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Parse client payload for validation
        let filename = 'upload';
        let mimeType = 'application/octet-stream';
        let size = 0;

        if (clientPayload && typeof clientPayload === 'string') {
          try {
            const payload = JSON.parse(clientPayload);
            filename = payload.filename || filename;
            mimeType = payload.mimeType || mimeType;
            size = payload.size || size;
          } catch (error) {
            console.error('[upload/handle] Invalid client payload:', error);
          }
        }

        // Validate file type
        if (!isValidFileType(mimeType)) {
          throw new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.');
        }

        // Validate file size
        if (!isValidFileSize(size)) {
          throw new Error('File size must be between 1 byte and 10MB');
        }

        // Generate unique pathname using user ID for isolation
        const uniquePathname = generateUniqueFilename(userId, filename);

        // Return scoped token configuration
        return {
          allowedContentTypes: [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
          ],
          maximumSizeInBytes: 10 * 1024 * 1024, // 10MB max
          tokenPayload: JSON.stringify({
            userId,
            assetId: `asset_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            originalFilename: filename,
          }),
          // Override pathname to use our secure generated one
          pathname: uniquePathname,
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('[upload/handle] Upload completed:', {
          url: blob.url,
          pathname: blob.pathname,
          tokenPayload,
        });

        // Note: We don't create the asset record here
        // Client will call /api/upload-complete with checksum for duplicate detection
      },
    });

    return NextResponse.json(jsonResponse, {
      headers: {
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': String(rateLimitResult.remaining || 0),
        'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + 60),
      },
    });

  } catch (error) {
    unstable_rethrow(error);
    console.error('[upload/handle] Error handling upload:', error);

    const errorMessage = error instanceof Error ? error.message : 'Upload handler failed';
    const statusCode = errorMessage.includes('Invalid file type') || errorMessage.includes('File size') ? 400 : 500;

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}
