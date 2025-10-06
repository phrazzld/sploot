import { NextRequest, NextResponse, after } from 'next/server';
import { put } from '@vercel/blob';
import { generateUniqueFilename, isValidFileType, isValidFileSize } from '@/lib/blob';
import { requireUserIdWithSync } from '@/lib/auth/server';
import { blobConfigured } from '@/lib/env';
import { prisma, assetExists, findOrCreateAsset, ExistingAssetMetadata, upsertAssetEmbedding } from '@/lib/db';
import crypto from 'crypto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { createEmbeddingService, EmbeddingError } from '@/lib/embeddings';
import { processUploadedImage } from '@/lib/image-processing';

/**
 * Configure route segment options
 * maxDuration: Maximum execution time for the API route (60 seconds)
 * This prevents timeout errors for large file uploads
 */
export const maxDuration = 60; // 60 second timeout for upload operations

/**
 * Direct file upload endpoint - handles file upload server-side
 * This is more reliable than client-side uploads for the initial implementation
 *
 * CONCURRENCY HANDLING:
 * The upload flow handles race conditions via database unique constraint on (ownerUserId, checksumSha256).
 * When simultaneous uploads of identical files occur:
 * 1. Both requests upload blobs to storage
 * 2. First request succeeds in DB insert
 * 3. Second request catches P2002 (unique constraint violation)
 * 4. Second request cleans up its duplicate blobs and returns existing asset
 *
 * Alternative approaches considered:
 * - Postgres advisory locks: Adds complexity, requires connection pool management
 * - Pre-upload existence check only: Still has TOCTOU window between check and blob upload
 * - Idempotent blob names: Works but requires deterministic naming that could expose user data
 *
 * Current approach is simplest and safest - database constraint is atomic and cleanup is reliable.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Check if we should generate embeddings synchronously (slower but more reliable)
    const url = new URL(req.url);
    const syncEmbeddings = url.searchParams.get('sync_embeddings') === 'true';

    // Check authentication and ensure user exists in database
    const userId = await requireUserIdWithSync();

    // Parse the multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const tagsData = formData.get('tags') as string | null;

    if (!file) {
      console.log(`[perf] Upload failed - no file provided (${Date.now() - startTime}ms)`);
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
      console.log(`[perf] Upload failed - invalid file type (${Date.now() - startTime}ms)`);
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
      console.log(`[perf] Upload failed - file too large (${Date.now() - startTime}ms)`);
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
    if ( prisma) {
      const existingAsset = await assetExists(userId, checksum, {
        includeEmbedding: true,
      });
      if (existingAsset) {
        // Generate embeddings for existing asset if missing
        // This ensures old uploads get embeddings too
        if (!existingAsset.hasEmbedding) {
          if (syncEmbeddings) {
            // Synchronous generation for existing assets missing embeddings
            try {
              await generateEmbeddingAsync(existingAsset.id, existingAsset.blobUrl, existingAsset.checksumSha256);
            } catch (embError) {
              console.error(`[sync] Failed to generate embedding for existing asset:`, embError);
            }
          } else {
            // Fire and forget for async
            generateEmbeddingAsync(existingAsset.id, existingAsset.blobUrl, existingAsset.checksumSha256);
          }
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

    if (!blobConfigured) {
      return NextResponse.json(
        { error: 'Blob storage not configured' },
        { status: 500 }
      );
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
      const dbStartTime = Date.now();
      if ( !prisma) {
        // Clean up uploaded file if database is not available
        const cleanupErrors: string[] = [];
        try {
          const { del } = await import('@vercel/blob');

          // Delete main blob
          try {
            await del(blob.url);
            console.log(`[cleanup] Successfully deleted blob after DB unavailable: ${blob.url}`);
          } catch (mainDelError) {
            const error = `Failed to delete main blob: ${mainDelError}`;
            console.error(`[cleanup] ${error}`);
            cleanupErrors.push(error);
          }

          // Delete thumbnail blob if it exists
          if (thumbnailBlob) {
            try {
              await del(thumbnailBlob.url);
              console.log(`[cleanup] Successfully deleted thumbnail after DB unavailable: ${thumbnailBlob.url}`);
            } catch (thumbDelError) {
              const error = `Failed to delete thumbnail: ${thumbDelError}`;
              console.error(`[cleanup] ${error}`);
              cleanupErrors.push(error);
            }
          }
        } catch (cleanupError) {
          const error = `Failed to import del function: ${cleanupError}`;
          console.error(`[cleanup] ${error}`);
          cleanupErrors.push(error);
        }

        // Log warning if cleanup failed
        if (cleanupErrors.length > 0) {
          console.error(`[ORPHAN ALERT] Failed to cleanup ${cleanupErrors.length} blob(s) after DB unavailable. Manual cleanup required:`, {
            mainBlob: blob.url,
            thumbnailBlob: thumbnailBlob?.url,
            errors: cleanupErrors,
          });
        }

        console.log(`[perf] Upload failed - database unavailable (${Date.now() - startTime}ms)`);
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

        console.log(`[perf] Database write: ${Date.now() - dbStartTime}ms`);

        // Generate embeddings based on sync preference
        if (syncEmbeddings) {
          // Synchronous: Generate embeddings immediately (slower but reliable)
          const embeddingStartTime = Date.now();
          try {
            await generateEmbeddingAsync(asset.id, asset.blobUrl, asset.checksumSha256);
            console.log(`[sync] Successfully generated embedding for asset ${asset.id} (${Date.now() - embeddingStartTime}ms)`);
          } catch (embError) {
            console.error(`[sync] Failed to generate embedding for asset ${asset.id}:`, embError);
            // Don't fail the upload if embedding fails
          }
        } else {
          // Asynchronous: Generate embeddings after response (faster but may fail in dev)
          after(async () => {
            await generateEmbeddingAsync(asset.id, asset.blobUrl, asset.checksumSha256);
          });
        }

        const totalTime = Date.now() - startTime;
        console.log(`[perf] Upload completed successfully in ${totalTime}ms`);

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
            needsEmbedding: !syncEmbeddings,
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
            const cleanupErrors: string[] = [];
            try {
              const { del } = await import('@vercel/blob');

              // Delete main blob
              try {
                await del(blob.url);
                console.log(`[cleanup] Successfully deleted duplicate blob: ${blob.url}`);
              } catch (mainDelError) {
                const error = `Failed to delete duplicate main blob: ${mainDelError}`;
                console.error(`[cleanup] ${error}`);
                cleanupErrors.push(error);
              }

              // Delete thumbnail blob if it exists
              if (thumbnailBlob) {
                try {
                  await del(thumbnailBlob.url);
                  console.log(`[cleanup] Successfully deleted duplicate thumbnail: ${thumbnailBlob.url}`);
                } catch (thumbDelError) {
                  const error = `Failed to delete duplicate thumbnail: ${thumbDelError}`;
                  console.error(`[cleanup] ${error}`);
                  cleanupErrors.push(error);
                }
              }
            } catch (cleanupError) {
              const error = `Failed to import del function: ${cleanupError}`;
              console.error(`[cleanup] ${error}`);
              cleanupErrors.push(error);
            }

            // Log warning if cleanup failed
            if (cleanupErrors.length > 0) {
              console.error(`[ORPHAN ALERT] Failed to cleanup ${cleanupErrors.length} duplicate blob(s). Manual cleanup required:`, {
                mainBlob: blob.url,
                thumbnailBlob: thumbnailBlob?.url,
                errors: cleanupErrors,
              });
            }

            // Generate embeddings for existing asset if missing
            if (syncEmbeddings) {
              try {
                await generateEmbeddingAsync(existingAsset.id, existingAsset.blobUrl, existingAsset.checksumSha256);
              } catch (embError) {
                console.error(`[sync] Failed to generate embedding for duplicate asset:`, embError);
              }
            } else {
              after(async () => {
                await generateEmbeddingAsync(existingAsset.id, existingAsset.blobUrl, existingAsset.checksumSha256);
              });
            }

            console.log(`[perf] Upload detected duplicate (${Date.now() - startTime}ms)`);
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
                  needsEmbedding: !existingAsset.hasEmbedding,
                },
                message: 'This image already exists in your library'
              },
              { status: 409 }
            );
          }
        }

        // Clean up uploaded files since database record creation failed
        // This is critical to prevent orphaned blobs
        const cleanupErrors: string[] = [];
        try {
          const { del } = await import('@vercel/blob');

          // Delete main blob
          try {
            await del(blob.url);
            console.log(`[cleanup] Successfully deleted orphaned blob: ${blob.url}`);
          } catch (mainDelError) {
            const error = `Failed to delete main blob ${blob.url}: ${mainDelError}`;
            console.error(`[cleanup] ${error}`);
            cleanupErrors.push(error);
          }

          // Delete thumbnail blob if it exists
          if (thumbnailBlob) {
            try {
              await del(thumbnailBlob.url);
              console.log(`[cleanup] Successfully deleted orphaned thumbnail: ${thumbnailBlob.url}`);
            } catch (thumbDelError) {
              const error = `Failed to delete thumbnail ${thumbnailBlob.url}: ${thumbDelError}`;
              console.error(`[cleanup] ${error}`);
              cleanupErrors.push(error);
            }
          }
        } catch (cleanupError) {
          const error = `Failed to import del function: ${cleanupError}`;
          console.error(`[cleanup] ${error}`);
          cleanupErrors.push(error);
        }

        // If cleanup failed, log explicit warning about orphaned blob
        if (cleanupErrors.length > 0) {
          console.error(`[ORPHAN ALERT] Failed to cleanup ${cleanupErrors.length} blob(s) after DB error. Manual cleanup required:`, {
            mainBlob: blob.url,
            thumbnailBlob: thumbnailBlob?.url,
            errors: cleanupErrors,
          });
        }

        console.log(`[perf] Upload failed - database error (${Date.now() - startTime}ms)`);
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

      console.log(`[perf] Upload failed - blob storage error (${Date.now() - startTime}ms)`);
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Upload endpoint error:', error);
    console.log(`[perf] Upload failed - unexpected error (${Date.now() - startTime}ms)`);

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
  console.log(`[after] Starting async embedding generation for asset ${assetId}`);
  try {
    // Skip if database not available
    if ( !prisma) {
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
    await upsertAssetEmbedding({
      assetId,
      modelName: result.model,
      modelVersion: result.model,
      dim: result.dimension,
      embedding: result.embedding,
    });

    console.log(`Embedding generated successfully for asset ${assetId}`);
  } catch (error) {
    // Log error but don't throw - this is background processing
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (error instanceof EmbeddingError) {
      console.error(`Embedding generation failed for asset ${assetId}:`, errorMessage);
    } else {
      console.error(`Unexpected error generating embedding for asset ${assetId}:`, error);
    }

    // Update embedding status to 'failed' so UI can show error state
    try {
      if ( prisma) {
        await prisma.assetEmbedding.upsert({
          where: { assetId },
          create: {
            assetId,
            modelName: 'unknown',
            modelVersion: 'unknown',
            dim: 0,
            status: 'failed',
            error: errorMessage,
          },
          update: {
            status: 'failed',
            error: errorMessage,
          },
        });
        console.log(`Marked embedding as failed for asset ${assetId}`);
      }
    } catch (updateError) {
      console.error(`Failed to update embedding status for asset ${assetId}:`, updateError);
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
    limits: {
      maxFileSize: '10MB',
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    }
  });
}
