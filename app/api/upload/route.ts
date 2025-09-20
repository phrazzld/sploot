import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { waitUntil } from '@vercel/functions';
import { generateUniqueFilename, isValidFileType, isValidFileSize } from '@/lib/blob';
import { requireUserIdWithSync } from '@/lib/auth/server';
import { blobConfigured, isMockMode } from '@/lib/env';
import { prisma, databaseAvailable, assetExists, findOrCreateAsset, ExistingAssetMetadata } from '@/lib/db';
import crypto from 'crypto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { createEmbeddingService, EmbeddingError } from '@/lib/embeddings';
import { processUploadedImage } from '@/lib/image-processing';

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
    const tagsData = formData.get('tags') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Parse tags from JSON string
    let tags: string[] = [];
    if (tagsData) {
      try {
        tags = JSON.parse(tagsData);
        if (!Array.isArray(tags)) {
          tags = [];
        }
      } catch (e) {
        console.error('Failed to parse tags:', e);
        tags = [];
      }
    }

    // Validate file type
    if (!isValidFileType(file.type)) {
      return NextResponse.json(
        {
          error: `Invalid file type: ${file.type}. Only JPEG, PNG, WebP, and GIF images are allowed.`,
          errorType: 'invalid_type',
          userMessage: 'File type not supported. Use JPEG, PNG, WebP, or GIF'
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (!isValidFileSize(file.size)) {
      return NextResponse.json(
        {
          error: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds the 10MB limit`,
          errorType: 'file_too_large',
          userMessage: `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 10MB`
        },
        { status: 400 }
      );
    }

    // Calculate file checksum and process image
    const buffer = Buffer.from(await file.arrayBuffer());
    const checksum = crypto
      .createHash('sha256')
      .update(buffer)
      .digest('hex');

    // Process image to create optimized versions
    let processedImages;
    try {
      processedImages = await processUploadedImage(buffer, file.type);
    } catch (error) {
      console.error('Image processing failed:', error);
      // Fall back to original image if processing fails
      processedImages = null;
    }

    // Check if asset already exists with this checksum
    if (databaseAvailable && prisma) {
      const existingAsset = await assetExists(userId, checksum, {
        includeEmbedding: true,
      });
      if (existingAsset) {
        // Generate embeddings for existing asset if missing
        // This ensures old uploads get embeddings too
        if (!existingAsset.hasEmbedding) {
          generateEmbeddingAsync(existingAsset.id, existingAsset.blobUrl, existingAsset.checksumSha256);
        }

        // Add tags to existing asset if provided
        if (tags.length > 0) {
          try {
            await prisma.$transaction(async (tx) => {
              for (const tagName of tags) {
                // Find or create tag
                let tag = await tx.tag.findFirst({
                  where: {
                    ownerUserId: userId,
                    name: tagName,
                  },
                });

                if (!tag) {
                  tag = await tx.tag.create({
                    data: {
                      ownerUserId: userId,
                      name: tagName,
                    },
                  });
                }

                // Create association if it doesn't exist
                const existingAssociation = await tx.assetTag.findFirst({
                  where: {
                    assetId: existingAsset.id,
                    tagId: tag.id,
                  },
                });

                if (!existingAssociation) {
                  await tx.assetTag.create({
                    data: {
                      assetId: existingAsset.id,
                      tagId: tag.id,
                    },
                  });
                }
              }
            });
          } catch (tagError) {
            console.error('Failed to add tags to existing asset:', tagError);
            // Continue without tags - not critical
          }
        }

        // Return existing asset with duplicate indicator
        return NextResponse.json({
          success: true,
          isDuplicate: true,
          asset: {
            id: existingAsset.id,
            blobUrl: existingAsset.blobUrl,
            pathname: existingAsset.pathname,
            filename: file.name,
            mimeType: existingAsset.mime,
            size: existingAsset.size,
            checksum: existingAsset.checksumSha256,
            createdAt: existingAsset.createdAt,
          },
          message: 'This image already exists in your library'
        });
      }
    }

    // Generate unique filenames for storage
    const uniqueFilename = generateUniqueFilename(userId, file.name);
    const thumbnailFilename = uniqueFilename.replace(/\.(\w+)$/, '-thumb.$1');

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
      // Upload main image (processed or original)
      const mainBuffer = processedImages ? processedImages.main.buffer : buffer;
      const blob = await put(uniqueFilename, mainBuffer, {
        access: 'public',
        addRandomSuffix: false,
      });

      // Upload thumbnail if processing succeeded
      let thumbnailBlob = null;
      if (processedImages) {
        try {
          thumbnailBlob = await put(thumbnailFilename, processedImages.thumbnail.buffer, {
            access: 'public',
            addRandomSuffix: false,
          });
        } catch (thumbError) {
          console.error('Failed to upload thumbnail:', thumbError);
          // Continue without thumbnail - not critical
        }
      }

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
          {
            error: 'Database unavailable. Cannot complete upload.',
            errorType: 'database_failed',
            userMessage: 'Service temporarily unavailable. Please try again'
          },
          { status: 503 }
        );
      }

      try {
        // Create asset with tags in a transaction
        const asset = await prisma.$transaction(async (tx) => {
          // Create the asset
          const newAsset = await tx.asset.create({
            data: {
              ownerUserId: userId,
              blobUrl: blob.url,
              thumbnailUrl: thumbnailBlob?.url || null,
              pathname: blob.pathname,
              thumbnailPath: thumbnailBlob?.pathname || null,
              mime: file.type,
              width: processedImages?.main.width || null,
              height: processedImages?.main.height || null,
              size: processedImages?.main.size || file.size,
              checksumSha256: checksum,
              favorite: false,
            },
          });

          // Create or find tags and associate them with the asset
          if (tags.length > 0) {
            for (const tagName of tags) {
              // Find or create tag
              let tag = await tx.tag.findFirst({
                where: {
                  ownerUserId: userId,
                  name: tagName,
                },
              });

              if (!tag) {
                tag = await tx.tag.create({
                  data: {
                    ownerUserId: userId,
                    name: tagName,
                  },
                });
              }

              // Create association
              await tx.assetTag.create({
                data: {
                  assetId: newAsset.id,
                  tagId: tag.id,
                },
              });
            }
          }

          return newAsset;
        });

        // Generate embeddings asynchronously after asset creation
        // This runs after the response is sent to keep upload latency low
        waitUntil(generateEmbeddingAsync(asset.id, asset.blobUrl, asset.checksumSha256));

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

        // Check if it's a duplicate key violation
        if (dbError instanceof PrismaClientKnownRequestError && dbError.code === 'P2002') {
          // Duplicate detected - try to find and return existing asset
          const existingAsset = await assetExists(userId, checksum);
          if (existingAsset) {
            // Clean up the uploaded files since we have a duplicate
            try {
              const { del } = await import('@vercel/blob');
              await del(blob.url);
              if (thumbnailBlob) {
                await del(thumbnailBlob.url).catch(err =>
                  console.error('Failed to cleanup thumbnail:', err)
                );
              }
            } catch (cleanupError) {
              console.error('Failed to cleanup duplicate upload:', cleanupError);
            }

            // Generate embeddings for existing asset if missing
            waitUntil(generateEmbeddingAsync(existingAsset.id, existingAsset.blobUrl, existingAsset.checksumSha256));

            return NextResponse.json(
              {
                success: true,
                isDuplicate: true,
                asset: {
                  id: existingAsset.id,
                  blobUrl: existingAsset.blobUrl,
                  pathname: existingAsset.pathname,
                  filename: file.name,
                  mimeType: existingAsset.mime,
                  size: existingAsset.size,
                  checksum: existingAsset.checksumSha256,
                  createdAt: existingAsset.createdAt,
                },
                message: 'This image already exists in your library'
              },
              { status: 409 }
            );
          }
        }

        // Clean up uploaded files since database record creation failed
        try {
          const { del } = await import('@vercel/blob');
          await del(blob.url);
          if (thumbnailBlob) {
            await del(thumbnailBlob.url).catch(err =>
              console.error('Failed to cleanup thumbnail:', err)
            );
          }
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
/**
 * Generate embedding for asset asynchronously.
 * Runs in background after upload response is sent.
 * Errors are logged but don't affect the upload response.
 */
async function generateEmbeddingAsync(
  assetId: string,
  blobUrl: string,
  checksum: string
): Promise<void> {
  console.log(`[waitUntil] Starting async embedding generation for asset ${assetId}`);
  try {
    // Skip if database not available
    if (!databaseAvailable || !prisma) {
      return;
    }

    // Check if embedding already exists
    const existingEmbedding = await prisma.assetEmbedding.findUnique({
      where: { assetId },
    });

    if (existingEmbedding) {
      console.log(`Embedding already exists for asset ${assetId}`);
      return;
    }

    // Initialize embedding service
    let embeddingService;
    try {
      embeddingService = createEmbeddingService();
    } catch (error) {
      console.error('Failed to initialize embedding service:', error);
      return;
    }

    // Generate image embedding
    console.log(`Generating embedding for asset ${assetId}...`);
    const result = await embeddingService.embedImage(blobUrl, checksum);

    // Store embedding in database
    await prisma.assetEmbedding.create({
      data: {
        assetId,
        modelName: result.model,
        modelVersion: result.model,
        dim: result.dimension,
        // @ts-ignore - Prisma doesn't have proper typing for vector fields
        imageEmbedding: result.embedding,
      },
    });

    console.log(`Embedding generated successfully for asset ${assetId}`);
  } catch (error) {
    // Log error but don't throw - this is background processing
    if (error instanceof EmbeddingError) {
      console.error(`Embedding generation failed for asset ${assetId}:`, error.message);
    } else {
      console.error(`Unexpected error generating embedding for asset ${assetId}:`, error);
    }
  }
}

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