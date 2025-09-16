import Replicate from 'replicate';
import { CacheService, getCacheService, createCacheService } from './cache';
import { MultiLayerCache, createMultiLayerCache, getMultiLayerCache } from './multi-layer-cache';
import { isMockMode } from './env';

export const SIGLIP_MODEL = 'daanelson/siglip-large-patch16-384:690ac94ac67ebec5c19bc09f9dc5d62e604f87db90ce5e5e4fc0f47f78e88871';
export const EMBEDDING_DIMENSION = 1152;
export const MAX_RETRY_ATTEMPTS = 3;
export const DEFAULT_TIMEOUT = 30000;

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  dimension: number;
  processingTime: number;
}

export interface EmbeddingServiceConfig {
  apiToken: string;
  model?: string;
  timeout?: number;
  retryAttempts?: number;
}

export class EmbeddingError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'EmbeddingError';
  }
}

class MockEmbeddingService {
  private model = 'mock/sploot-embedding:local';

  async embedText(query: string): Promise<EmbeddingResult> {
    const embedding = this.buildVector(query);
    return {
      embedding,
      model: this.model,
      dimension: embedding.length,
      processingTime: 1,
    };
  }

  async embedImage(imageUrl: string): Promise<EmbeddingResult> {
    const embedding = this.buildVector(imageUrl);
    return {
      embedding,
      model: this.model,
      dimension: embedding.length,
      processingTime: 1,
    };
  }

  async embedBatch(items: Array<{ type: 'text' | 'image'; content: string }>): Promise<EmbeddingResult[]> {
    return Promise.all(
      items.map(item =>
        item.type === 'text'
          ? this.embedText(item.content)
          : this.embedImage(item.content)
      )
    );
  }

  private buildVector(seed: string): number[] {
    const vectorLength = 32;
    const vector = new Array(vectorLength).fill(0);
    for (let i = 0; i < seed.length; i++) {
      const charCode = seed.charCodeAt(i);
      vector[i % vectorLength] += (charCode % 97) / 97;
    }
    const max = Math.max(...vector, 1);
    return vector.map(v => Number((v / max).toFixed(4)));
  }
}

/**
 * Service for generating embeddings using Replicate's SigLIP model.
 * Handles both text and image embeddings with automatic caching and retry logic.
 */
export class ReplicateEmbeddingService {
  private replicate: Replicate;
  private model: string;
  private timeout: number;
  private retryAttempts: number;

  constructor(config: EmbeddingServiceConfig) {
    this.replicate = new Replicate({
      auth: config.apiToken,
    });
    this.model = config.model || SIGLIP_MODEL;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
    this.retryAttempts = config.retryAttempts || MAX_RETRY_ATTEMPTS;
  }

  async embedText(query: string): Promise<EmbeddingResult> {
    const startTime = Date.now();

    // Check multi-layer cache first
    const multiCache = getMultiLayerCache() || createMultiLayerCache();
    const cachedEmbedding = await multiCache.getTextEmbedding(query);
    if (cachedEmbedding) {
      return {
        embedding: cachedEmbedding,
        model: this.model,
        dimension: cachedEmbedding.length,
        processingTime: Date.now() - startTime, // Very fast cache hit
      };
    }

    // Fallback to legacy cache if exists
    const cache = getCacheService();
    if (cache) {
      const legacyCached = await cache.getTextEmbedding(query);
      if (legacyCached) {
        // Migrate to multi-layer cache
        await multiCache.setTextEmbedding(query, legacyCached);
        return {
          embedding: legacyCached,
          model: this.model,
          dimension: legacyCached.length,
          processingTime: Date.now() - startTime,
        };
      }
    }

    try {
      const result = await this.withRetry(
        async () => {
          const output = await this.replicate.run(
            this.model as `${string}/${string}:${string}`,
            {
              input: {
                text: query,
                mode: 'text',
              },
            }
          );
          return output;
        },
        `Embedding text: ${query.substring(0, 50)}...`
      );

      const embedding = Array.isArray(result) ? result : (result as any).embedding;

      if (!embedding || !Array.isArray(embedding)) {
        throw new EmbeddingError('Invalid embedding response from model');
      }

      // Cache the result in multi-layer cache
      await multiCache.setTextEmbedding(query, embedding);

      // Also set in legacy cache for backward compatibility
      if (cache) {
        await cache.setTextEmbedding(query, embedding);
      }

      return {
        embedding,
        model: this.model,
        dimension: embedding.length,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      if (error instanceof EmbeddingError) {
        throw error;
      }

      // Error generating text embedding
      throw new EmbeddingError(
        `Failed to generate text embedding: ${(error as Error).message}`,
        500,
        true
      );
    }
  }

  /**
   * Generate embeddings for image from URL.
   * Uses checksum for cache key when available for better deduplication.
   *
   * @param imageUrl - URL of image to embed
   * @param checksum - Optional SHA-256 checksum for cache key
   * @returns Embedding result with vector and metadata
   * @throws {EmbeddingError} If embedding generation fails after retries
   */
  async embedImage(imageUrl: string, checksum?: string): Promise<EmbeddingResult> {
    const startTime = Date.now();

    // Check multi-layer cache first if we have a checksum
    const multiCache = getMultiLayerCache() || createMultiLayerCache();
    if (checksum) {
      const cachedEmbedding = await multiCache.getImageEmbedding(checksum);
      if (cachedEmbedding) {
        return {
          embedding: cachedEmbedding,
          model: this.model,
          dimension: cachedEmbedding.length,
          processingTime: Date.now() - startTime, // Very fast cache hit
        };
      }
    }

    // Fallback to legacy cache
    const cache = getCacheService();
    if (cache && checksum) {
      const legacyCached = await cache.getImageEmbedding(checksum);
      if (legacyCached) {
        // Migrate to multi-layer cache
        await multiCache.setImageEmbedding(checksum, legacyCached);
        return {
          embedding: legacyCached,
          model: this.model,
          dimension: legacyCached.length,
          processingTime: Date.now() - startTime,
        };
      }
    }

    try {
      const result = await this.withRetry(
        async () => {
          const output = await this.replicate.run(
            this.model as `${string}/${string}:${string}`,
            {
              input: {
                image: imageUrl,
                mode: 'image',
              },
            }
          );
          return output;
        },
        `Embedding image from: ${imageUrl.substring(0, 50)}...`
      );

      const embedding = Array.isArray(result) ? result : (result as any).embedding;

      if (!embedding || !Array.isArray(embedding)) {
        throw new EmbeddingError('Invalid embedding response from model');
      }

      // Cache the result in multi-layer cache
      if (checksum) {
        await multiCache.setImageEmbedding(checksum, embedding);
      }

      // Also set in legacy cache for backward compatibility
      if (cache && checksum) {
        await cache.setImageEmbedding(checksum, embedding);
      }

      return {
        embedding,
        model: this.model,
        dimension: embedding.length,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      if (error instanceof EmbeddingError) {
        throw error;
      }

      // Error generating image embedding
      throw new EmbeddingError(
        `Failed to generate image embedding: ${(error as Error).message}`,
        500,
        true
      );
    }
  }

  async embedBatch(items: Array<{ type: 'text' | 'image'; content: string }>): Promise<EmbeddingResult[]> {
    const results = await Promise.all(
      items.map(async (item) => {
        if (item.type === 'text') {
          return this.embedText(item.content);
        } else {
          return this.embedImage(item.content);
        }
      })
    );

    return results;
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Retry attempt failed

        if (
          error instanceof EmbeddingError &&
          !error.retryable ||
          attempt === this.retryAttempts
        ) {
          break;
        }

        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }
}

/**
 * Factory function to create embedding service instance.
 * Returns mock service in development when Replicate API not configured.
 *
 * @returns Configured embedding service instance
 * @throws {EmbeddingError} If API token not configured and not in mock mode
 */
export function createEmbeddingService(): ReplicateEmbeddingService {
  if (isMockMode()) {
    return new MockEmbeddingService() as unknown as ReplicateEmbeddingService;
  }

  const apiToken = process.env.REPLICATE_API_TOKEN;

  if (!apiToken || apiToken === 'your_replicate_token_here') {
    // Replicate API token not configured
    throw new EmbeddingError('Replicate API token not configured');
  }

  // Initialize cache service as well (gracefully handles missing Redis config)
  createCacheService();

  return new ReplicateEmbeddingService({ apiToken });
}

/**
 * Normalize embedding vector to unit length for cosine similarity.
 *
 * @param embedding - Vector to normalize
 * @returns Normalized vector with magnitude 1
 */
export function normalizeEmbedding(embedding: number[]): number[] {
  const magnitude = Math.sqrt(
    embedding.reduce((sum, val) => sum + val * val, 0)
  );

  if (magnitude === 0) {
    return embedding;
  }

  return embedding.map(val => val / magnitude);
}

/**
 * Calculate cosine similarity between two embedding vectors.
 * Returns value between -1 and 1, where 1 indicates identical direction.
 *
 * @param a - First embedding vector
 * @param b - Second embedding vector
 * @returns Cosine similarity score between -1 and 1
 * @throws {Error} If vectors have different dimensions
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same dimension');
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);

  if (magnitude === 0) {
    return 0;
  }

  return dotProduct / magnitude;
}
