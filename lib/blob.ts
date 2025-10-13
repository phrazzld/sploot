import { put, del, list } from '@vercel/blob';

// Allowed file types for upload
export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
];

// Max file size: 10MB
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export interface UploadResult {
  url: string;
  downloadUrl: string;
  pathname: string;
  contentType: string;
  contentDisposition: string;
}

/**
 * Validates if the file type is allowed for upload.
 * Supports JPEG, PNG, WebP, and GIF images.
 */
export function isValidFileType(mimeType: string): boolean {
  return ALLOWED_FILE_TYPES.includes(mimeType.toLowerCase());
}

/**
 * Validates if the file size is within limits.
 * Maximum allowed size is 10MB.
 */
export function isValidFileSize(size: number): boolean {
  return size > 0 && size <= MAX_FILE_SIZE;
}

/**
 * Generates a unique filename for storage.
 * Format: userId/timestamp-random.extension
 */
export function generateUniqueFilename(
  userId: string,
  originalFilename: string
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  const extension = originalFilename.split('.').pop()?.toLowerCase() || 'jpg';
  return `${userId}/${timestamp}-${random}.${extension}`;
}

/**
 * Uploads a file to Vercel Blob storage.
 * Files are stored publicly with optional cache control.
 */
export async function uploadToBlob(
  file: File | Blob,
  pathname: string,
  options?: {
    addRandomSuffix?: boolean;
    cacheControlMaxAge?: number;
  }
): Promise<UploadResult> {
  const blob = await put(pathname, file, {
    access: 'public',
    addRandomSuffix: options?.addRandomSuffix ?? false,
    cacheControlMaxAge: options?.cacheControlMaxAge,
  });

  return {
    url: blob.url,
    downloadUrl: blob.downloadUrl,
    pathname: blob.pathname,
    contentType: blob.contentType,
    contentDisposition: blob.contentDisposition,
  };
}

/**
 * Deletes a file from Vercel Blob storage.
 * Permanent deletion, cannot be undone.
 * @throws Error if deletion fails
 */
export async function deleteFromBlob(url: string): Promise<void> {
  await del(url);
}

/**
 * Lists all files in Vercel Blob storage for a specific user.
 * Returns up to 1000 most recent files.
 */
export async function listUserBlobs(userId: string) {
  const blobs = await list({
    prefix: `${userId}/`,
    limit: 1000,
  });

  return blobs.blobs;
}

/**
 * Constructs the blob URL from a pathname.
 * Returns placeholder URL in development mode.
 */
export function getBlobUrl(pathname: string): string {
  // In production, this will be your actual blob URL
  // For development, we'll use a placeholder
  const baseUrl = process.env.NEXT_PUBLIC_BLOB_BASE_URL || 'https://your-blob-store.vercel-storage.com';
  return `${baseUrl}/${pathname}`;
}

/**
 * Validates that a blob URL is legitimate and belongs to the authenticated user.
 *
 * Security: Prevents SSRF attacks by ensuring URLs:
 * - Are from Vercel Blob storage (not arbitrary external/internal URLs)
 * - Match the expected pathname
 * - Belong to the authenticated user's directory
 *
 * @param blobUrl - URL returned from client (untrusted input)
 * @param pathname - Expected pathname (from server-generated credentials)
 * @param userId - Authenticated user ID (for path isolation)
 * @returns Validation result with error message if invalid
 */
export function validateBlobUrl(
  blobUrl: string,
  pathname: string,
  userId: string
): { valid: boolean; error?: string } {
  try {
    const url = new URL(blobUrl);

    // 1. Validate protocol (only HTTPS allowed)
    if (url.protocol !== 'https:') {
      return {
        valid: false,
        error: `Invalid protocol: ${url.protocol}. Only HTTPS URLs are allowed.`,
      };
    }

    // 2. Validate domain is Vercel Blob storage
    // Allow: *.blob.vercel-storage.com or *.public.blob.vercel-storage.com
    const hostname = url.hostname.toLowerCase();
    const isVercelBlob =
      hostname.endsWith('.blob.vercel-storage.com') ||
      hostname.endsWith('.public.blob.vercel-storage.com') ||
      hostname === 'blob.vercel-storage.com' ||
      hostname === 'public.blob.vercel-storage.com';

    if (!isVercelBlob) {
      return {
        valid: false,
        error: `Invalid domain: ${hostname}. URL must be from Vercel Blob storage.`,
      };
    }

    // 3. Reject internal/private network addresses
    // Prevent SSRF to internal services
    const privatePatterns = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./, // AWS metadata
      /^0\.0\.0\.0$/,
      /^::1$/, // IPv6 localhost
      /^fe80:/i, // IPv6 link-local
    ];

    if (privatePatterns.some(pattern => pattern.test(hostname))) {
      return {
        valid: false,
        error: `Blocked internal/private address: ${hostname}`,
      };
    }

    // 4. Extract pathname from URL and validate it matches expected pathname
    // URL pathname includes leading slash, our pathname doesn't
    const urlPathname = url.pathname.startsWith('/')
      ? url.pathname.slice(1)
      : url.pathname;

    if (urlPathname !== pathname) {
      return {
        valid: false,
        error: `Pathname mismatch. Expected: ${pathname}, Got: ${urlPathname}`,
      };
    }

    // 5. Validate pathname belongs to authenticated user (isolation)
    // Format: userId/timestamp-random.ext
    if (!pathname.startsWith(`${userId}/`)) {
      return {
        valid: false,
        error: `Pathname must start with user directory: ${userId}/`,
      };
    }

    // All validations passed
    return { valid: true };
  } catch (error) {
    // Invalid URL format
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid URL format',
    };
  }
}