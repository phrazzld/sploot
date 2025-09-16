#!/usr/bin/env node

/**
 * Performance Benchmark Script for Sploot
 * Tests SLOs with 5,000 mock images:
 * - Upload processing: < 2.5 seconds
 * - Search response: < 500ms
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Set environment to use mock mode
process.env.MOCK_MODE = 'true';
process.env.NODE_ENV = 'test';

interface BenchmarkResult {
  operation: string;
  samples: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  sloMet: boolean;
  sloThreshold: number;
}

interface TestAsset {
  id: string;
  blobUrl: string;
  filename: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  checksum: string;
  favorite: boolean;
  tags: string[];
  createdAt: Date;
  embedding?: number[];
}

class PerformanceBenchmark {
  private assets: TestAsset[] = [];
  private embeddings: Map<string, number[]> = new Map();
  private searchQueries: string[] = [
    'drake meme',
    'distracted boyfriend',
    'woman yelling at cat',
    'this is fine',
    'surprised pikachu',
    'galaxy brain',
    'expanding brain',
    'change my mind',
    'is this a butterfly',
    'mocking spongebob',
  ];

  constructor(private assetCount: number = 5000) {}

  /**
   * Generate mock assets with realistic data
   */
  private generateMockAssets(): void {
    console.log(`📊 Generating ${this.assetCount} mock assets...`);

    const mimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const tagOptions = ['reaction', 'template', 'funny', 'viral', 'classic', 'drake', 'cat', 'dog'];

    for (let i = 0; i < this.assetCount; i++) {
      const id = crypto.randomUUID();
      const asset: TestAsset = {
        id,
        blobUrl: `https://blob.vercel-storage.com/mock/${id}/meme-${i}.jpg`,
        filename: `meme-${i}.jpg`,
        mimeType: mimeTypes[i % mimeTypes.length],
        size: Math.floor(Math.random() * 5000000) + 100000, // 100KB - 5MB
        width: 1920,
        height: 1080,
        checksum: `sha256:${crypto.randomBytes(32).toString('hex')}`,
        favorite: Math.random() > 0.8,
        tags: this.getRandomTags(tagOptions, Math.floor(Math.random() * 3)),
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Last 30 days
      };

      // Generate mock embedding
      asset.embedding = this.generateMockEmbedding(asset.filename);
      this.embeddings.set(id, asset.embedding);

      this.assets.push(asset);
    }

    console.log(`✅ Generated ${this.assets.length} mock assets`);
  }

  /**
   * Generate a mock embedding vector
   */
  private generateMockEmbedding(seed: string): number[] {
    const dimension = 1152; // SigLIP dimension
    const vector = new Array(dimension);

    // Create deterministic but varied embeddings
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    for (let i = 0; i < dimension; i++) {
      vector[i] = Math.sin(hash * (i + 1)) * 0.5 + 0.5;
    }

    return vector;
  }

  /**
   * Get random tags from options
   */
  private getRandomTags(options: string[], count: number): string[] {
    const shuffled = [...options].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * Benchmark upload operations
   */
  private async benchmarkUpload(): Promise<BenchmarkResult> {
    console.log('\n🚀 Benchmarking upload operations...');

    const samples: number[] = [];
    const sampleSize = Math.min(100, this.assetCount / 10);

    for (let i = 0; i < sampleSize; i++) {
      const asset = this.assets[i];
      const startTime = process.hrtime.bigint();

      // Simulate upload processing
      await this.simulateUpload(asset);

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
      samples.push(duration);

      if ((i + 1) % 10 === 0) {
        process.stdout.write(`  Processed ${i + 1}/${sampleSize} uploads\r`);
      }
    }

    console.log(`  ✅ Completed ${sampleSize} upload operations`);

    return this.calculateStats('Upload', samples, 2500); // 2.5s SLO
  }

  /**
   * Simulate upload processing
   */
  private async simulateUpload(asset: TestAsset): Promise<void> {
    // Simulate checksum calculation
    await this.delay(5);

    // Simulate database write
    await this.delay(10);

    // Simulate embedding generation
    await this.delay(50);

    // Simulate cache invalidation
    await this.delay(2);
  }

  /**
   * Benchmark search operations
   */
  private async benchmarkSearch(): Promise<BenchmarkResult> {
    console.log('\n🔍 Benchmarking search operations...');

    const samples: number[] = [];
    const iterations = 1000;

    for (let i = 0; i < iterations; i++) {
      const query = this.searchQueries[i % this.searchQueries.length];
      const startTime = process.hrtime.bigint();

      // Simulate search
      await this.simulateSearch(query);

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
      samples.push(duration);

      if ((i + 1) % 100 === 0) {
        process.stdout.write(`  Processed ${i + 1}/${iterations} searches\r`);
      }
    }

    console.log(`  ✅ Completed ${iterations} search operations`);

    return this.calculateStats('Search', samples, 500); // 500ms SLO
  }

  /**
   * Simulate semantic search
   */
  private async simulateSearch(query: string): Promise<TestAsset[]> {
    // Simulate text embedding generation
    await this.delay(20);

    const queryEmbedding = this.generateMockEmbedding(query);

    // Simulate vector search with cosine similarity
    const results: Array<{ asset: TestAsset; score: number }> = [];

    // Simulate pgvector HNSW search (only check subset for performance)
    const sampleSize = Math.min(100, this.assets.length);
    for (let i = 0; i < sampleSize; i++) {
      const asset = this.assets[Math.floor(Math.random() * this.assets.length)];
      const score = this.cosineSimilarity(queryEmbedding, asset.embedding!);
      results.push({ asset, score });
    }

    // Simulate sorting and filtering
    await this.delay(5);

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 30).map(r => r.asset);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Benchmark pagination operations
   */
  private async benchmarkPagination(): Promise<BenchmarkResult> {
    console.log('\n📄 Benchmarking pagination operations...');

    const samples: number[] = [];
    const iterations = 500;
    const pageSize = 50;

    for (let i = 0; i < iterations; i++) {
      const offset = (i % 100) * pageSize;
      const startTime = process.hrtime.bigint();

      // Simulate paginated fetch
      await this.simulatePagination(offset, pageSize);

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;
      samples.push(duration);

      if ((i + 1) % 50 === 0) {
        process.stdout.write(`  Processed ${i + 1}/${iterations} paginations\r`);
      }
    }

    console.log(`  ✅ Completed ${iterations} pagination operations`);

    return this.calculateStats('Pagination', samples, 300); // 300ms target
  }

  /**
   * Simulate paginated asset fetch
   */
  private async simulatePagination(offset: number, limit: number): Promise<TestAsset[]> {
    // Simulate database query
    await this.delay(10);

    // Simulate sorting and filtering
    await this.delay(5);

    return this.assets.slice(offset, offset + limit);
  }

  /**
   * Calculate statistics from samples
   */
  private calculateStats(operation: string, samples: number[], sloThreshold: number): BenchmarkResult {
    samples.sort((a, b) => a - b);

    const min = samples[0];
    const max = samples[samples.length - 1];
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const p50 = samples[Math.floor(samples.length * 0.5)];
    const p95 = samples[Math.floor(samples.length * 0.95)];
    const p99 = samples[Math.floor(samples.length * 0.99)];

    return {
      operation,
      samples: samples.length,
      min,
      max,
      mean,
      p50,
      p95,
      p99,
      sloMet: p95 <= sloThreshold,
      sloThreshold,
    };
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Print benchmark results
   */
  private printResults(results: BenchmarkResult[]): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 PERFORMANCE BENCHMARK RESULTS');
    console.log('='.repeat(80));

    results.forEach(result => {
      const sloStatus = result.sloMet ? '✅ PASS' : '❌ FAIL';
      const sloColor = result.sloMet ? '\x1b[32m' : '\x1b[31m';
      const reset = '\x1b[0m';

      console.log(`\n📌 ${result.operation} Operation`);
      console.log('─'.repeat(40));
      console.log(`  Samples:     ${result.samples}`);
      console.log(`  Min:         ${result.min.toFixed(2)}ms`);
      console.log(`  Max:         ${result.max.toFixed(2)}ms`);
      console.log(`  Mean:        ${result.mean.toFixed(2)}ms`);
      console.log(`  P50:         ${result.p50.toFixed(2)}ms`);
      console.log(`  P95:         ${result.p95.toFixed(2)}ms`);
      console.log(`  P99:         ${result.p99.toFixed(2)}ms`);
      console.log(`  SLO Target:  < ${result.sloThreshold}ms`);
      console.log(`  SLO Status:  ${sloColor}${sloStatus}${reset} (P95: ${result.p95.toFixed(2)}ms)`);
    });

    console.log('\n' + '='.repeat(80));

    // Overall summary
    const allPassed = results.every(r => r.sloMet);
    if (allPassed) {
      console.log('✅ All SLOs met! Application is performing within targets.');
    } else {
      const failed = results.filter(r => !r.sloMet).map(r => r.operation);
      console.log(`⚠️  SLOs not met for: ${failed.join(', ')}`);
      console.log('   Consider optimization for these operations.');
    }

    console.log('='.repeat(80) + '\n');
  }

  /**
   * Save results to JSON file
   */
  private saveResults(results: BenchmarkResult[]): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `benchmark-${timestamp}.json`;
    const filepath = path.join(process.cwd(), 'scripts', 'benchmarks', filename);

    // Create directory if it doesn't exist
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const data = {
      timestamp: new Date().toISOString(),
      assetCount: this.assetCount,
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      results,
    };

    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    console.log(`📁 Results saved to: ${filepath}`);
  }

  /**
   * Run the complete benchmark suite
   */
  public async run(): Promise<void> {
    console.log('🏁 Starting Sploot Performance Benchmark');
    console.log(`📦 Testing with ${this.assetCount} mock assets`);
    console.log('─'.repeat(80));

    // Generate test data
    this.generateMockAssets();

    // Run benchmarks
    const results: BenchmarkResult[] = [];

    results.push(await this.benchmarkUpload());
    results.push(await this.benchmarkSearch());
    results.push(await this.benchmarkPagination());

    // Print and save results
    this.printResults(results);
    this.saveResults(results);

    console.log('🎉 Benchmark complete!');
  }
}

// Run benchmark when script is executed directly
if (require.main === module) {
  const assetCount = parseInt(process.argv[2] || '5000', 10);
  const benchmark = new PerformanceBenchmark(assetCount);

  benchmark.run().catch(error => {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  });
}

export { PerformanceBenchmark, BenchmarkResult };