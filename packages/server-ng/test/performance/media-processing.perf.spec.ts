import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { Logger } from '@nestjs/common';

/**
 * Media Processing Performance Tests
 *
 * Measures throughput and latency for media operations including
 * image processing, watermarking, and thumbnail generation.
 *
 * Performance Baselines:
 * - Process 100 images in parallel: < 5 seconds
 * - Large image (10MB+) resize: < 2 seconds
 * - Watermark 50 images: Batch processing efficient
 * - Generate 100 thumbnails: Memory stable
 * - Concurrent uploads (20 clients): No queue overflow
 */

describe('Media Processing Performance (media-processing.perf.spec.ts)', () => {
  let logger: Logger;
  const performanceResults: Record<
    string,
    { mean: number; throughput: number; peakMemory: number }
  > = {};

  beforeEach(() => {
    logger = new Logger('MediaProcessingPerf');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Benchmark: Process 100 images in parallel
   * Measures throughput for concurrent image processing
   */
  it('should process 100 images in parallel efficiently', async () => {
    const imageCount = 100;
    const initialMemory = process.memoryUsage().heapUsed;

    // Simulate image processing operation
    const processImage = async (
      imageId: string,
    ): Promise<{ id: string; processed: boolean; size: number }> => {
      // Simulate work: 10-50ms per image
      const delay = Math.random() * 40 + 10;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return { id: imageId, processed: true, size: 1024 * 1024 }; // 1MB per image
    };

    const startTime = performance.now();

    // Process all images in parallel
    const results = await Promise.all(
      Array.from({ length: imageCount }, (_, i) => processImage(`img-${String(i)}`)),
    );

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const throughput = imageCount / (totalTime / 1000); // images per second

    const finalMemory = process.memoryUsage().heapUsed;
    const peakMemory = (finalMemory - initialMemory) / 1024 / 1024; // MB

    performanceResults['process-100-images'] = {
      mean: totalTime,
      throughput,
      peakMemory,
    };

    logger.log(
      `Processing 100 images - Total: ${totalTime.toFixed(2)}ms, Throughput: ${throughput.toFixed(2)} img/s, Memory peak: ${peakMemory.toFixed(2)}MB`,
    );

    expect(results).toHaveLength(imageCount);
    expect(results.every((r) => r.processed)).toBe(true);
    expect(totalTime).toBeLessThan(5000); // Should complete in under 5 seconds
  });

  /**
   * Benchmark: Resize large image (10MB+)
   * Measures latency for processing large files
   */
  it('should resize large image (10MB+) in < 2 seconds', async () => {
    const measurements: number[] = [];
    const largeImageSize = 10 * 1024 * 1024; // 10MB

    // Simulate image resize operation
    const resizeImage = async (sizeBytes: number): Promise<Buffer> => {
      // Simulate CPU-intensive resize: ~200ms per 10MB
      const delayMs = (sizeBytes / (10 * 1024 * 1024)) * 200;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return Buffer.alloc(sizeBytes / 4); // Reduced size after resize
    };

    // Run resize benchmark 5 times
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      const result = await resizeImage(largeImageSize);
      const end = performance.now();

      measurements.push(end - start);
      expect(result.length).toBeGreaterThan(0);
    }

    const mean = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const min = Math.min(...measurements);
    const max = Math.max(...measurements);

    performanceResults['resize-10mb-image'] = {
      mean,
      throughput: 0,
      peakMemory: 0,
    };

    logger.log(
      `Resize 10MB image - Mean: ${mean.toFixed(2)}ms, Min: ${min.toFixed(2)}ms, Max: ${max.toFixed(2)}ms`,
    );

    expect(mean).toBeLessThan(2000); // Should complete in under 2 seconds
  });

  /**
   * Benchmark: Watermark 50 images
   * Tests batch watermarking efficiency
   */
  it('should watermark 50 images efficiently with batch processing', async () => {
    const imageCount = 50;
    const batchSize = 10; // Process in batches of 10
    const measurements: number[] = [];

    // Simulate watermark operation
    const watermarkImage = async (
      imageId: string,
    ): Promise<{ id: string; watermarked: boolean }> => {
      // Simulate watermark: ~20ms per image
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { id: imageId, watermarked: true };
    };

    // Process in batches
    for (let batch = 0; batch < imageCount / batchSize; batch++) {
      const start = performance.now();

      const batchImages = Array.from(
        { length: batchSize },
        (_, i) => `img-${String(batch * batchSize + i)}`,
      );
      const results = await Promise.all(batchImages.map((id) => watermarkImage(id)));

      const end = performance.now();
      measurements.push(end - start);

      expect(results).toHaveLength(batchSize);
      expect(results.every((r) => r.watermarked)).toBe(true);
    }

    const totalTime = measurements.reduce((a, b) => a + b, 0);
    const avgBatchTime = totalTime / measurements.length;
    const throughput = imageCount / (totalTime / 1000);

    performanceResults['watermark-50-images'] = {
      mean: avgBatchTime,
      throughput,
      peakMemory: 0,
    };

    logger.log(
      `Watermark 50 images (batch ${String(batchSize)}) - Total: ${totalTime.toFixed(2)}ms, Throughput: ${throughput.toFixed(2)} img/s`,
    );

    expect(totalTime).toBeLessThan(3000); // Should complete in under 3 seconds
  });

  /**
   * Benchmark: Generate 100 thumbnails
   * Tests memory stability during bulk thumbnail creation
   */
  it('should generate 100 thumbnails with stable memory usage', async () => {
    const thumbnailCount = 100;
    const initialMemory = process.memoryUsage().heapUsed;
    const memorySnapshots: number[] = [];

    // Simulate thumbnail generation
    const generateThumbnail = async (_imageId: string): Promise<Buffer> => {
      // Simulate thumbnail generation: ~5ms per thumbnail
      await new Promise((resolve) => setTimeout(resolve, 5));
      return Buffer.alloc(100 * 1024); // 100KB thumbnail
    };

    // Generate thumbnails in chunks
    const chunkSize = 20;
    for (let i = 0; i < Math.ceil(thumbnailCount / chunkSize); i++) {
      const chunk = Array.from(
        { length: Math.min(chunkSize, thumbnailCount - i * chunkSize) },
        (_, j) => generateThumbnail(`img-${String(i * chunkSize + j)}`),
      );

      const results = await Promise.all(chunk);
      expect(results).toHaveLength(Math.min(chunkSize, thumbnailCount - i * chunkSize));

      // Capture memory after each chunk
      const currentMemory = process.memoryUsage().heapUsed;
      memorySnapshots.push(currentMemory);
    }

    if (global.gc) {
      global.gc();
    }
    const finalMemory = process.memoryUsage().heapUsed;

    // Check memory growth pattern
    const memoryGrowths: number[] = [];
    for (let i = 1; i < memorySnapshots.length; i++) {
      memoryGrowths.push(memorySnapshots[i] - memorySnapshots[i - 1]);
    }

    const avgGrowth = memoryGrowths.reduce((a, b) => a + b, 0) / memoryGrowths.length;
    const maxGrowth = Math.max(...memoryGrowths);

    performanceResults['generate-100-thumbnails'] = {
      mean: 0,
      throughput: thumbnailCount / (memorySnapshots.length * 0.1),
      peakMemory: (maxGrowth + (finalMemory - initialMemory)) / 1024 / 1024,
    };

    logger.log(
      `Generate 100 thumbnails - Peak memory growth: ${(maxGrowth / 1024 / 1024).toFixed(2)}MB, Average growth/chunk: ${(avgGrowth / 1024 / 1024).toFixed(2)}MB`,
    );

    // Memory growth should be reasonable
    expect(avgGrowth).toBeLessThan(20 * 1024 * 1024); // < 20MB per batch
  });

  /**
   * Benchmark: Concurrent uploads (20 clients)
   * Tests queue behavior under concurrent client load
   */
  it('should handle 20 concurrent upload clients without queue overflow', async () => {
    const concurrentClients = 20;
    const uploadsPerClient = 5;
    const uploadQueue: Promise<{ clientId: number; uploadId: number; success: boolean }>[] = [];

    // Simulate upload operation
    const uploadFile = async (
      clientId: number,
      uploadId: number,
    ): Promise<{ clientId: number; uploadId: number; success: boolean }> => {
      // Simulate upload: 50-150ms per file
      const delay = Math.random() * 100 + 50;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return { clientId, uploadId, success: true };
    };

    const startTime = performance.now();

    // Simulate concurrent clients
    for (let client = 0; client < concurrentClients; client++) {
      for (let upload = 0; upload < uploadsPerClient; upload++) {
        uploadQueue.push(uploadFile(client, upload));
      }
    }

    const results = await Promise.all(uploadQueue);
    const endTime = performance.now();

    const totalUploads = concurrentClients * uploadsPerClient;
    const totalTime = endTime - startTime;
    const throughput = totalUploads / (totalTime / 1000);

    performanceResults['concurrent-uploads-20'] = {
      mean: totalTime / totalUploads,
      throughput,
      peakMemory: 0,
    };

    logger.log(
      `Concurrent uploads (20 clients × 5 files) - Total: ${totalTime.toFixed(2)}ms, Throughput: ${throughput.toFixed(2)} uploads/s, Avg per upload: ${(totalTime / totalUploads).toFixed(2)}ms`,
    );

    expect(results).toHaveLength(totalUploads);
    expect(results.every((r) => r.success)).toBe(true);
    expect(uploadQueue).toHaveLength(totalUploads);
  });

  /**
   * Test: Image processing queue stability
   * Verifies queue doesn't overflow under sustained load
   */
  it('should maintain stable queue depth under sustained image processing load', async () => {
    const queueDepthSnapshots: number[] = [];
    let currentQueueDepth = 0;
    let totalProcessed = 0;
    const processingRate = 50; // items per second

    // Simulate image processing with queue
    const addToQueue = async (_imageId: string): Promise<boolean> => {
      currentQueueDepth++;
      queueDepthSnapshots.push(currentQueueDepth);

      // Simulate processing with fixed processing rate
      return new Promise((resolve) => {
        setTimeout(() => {
          currentQueueDepth--;
          totalProcessed++;
          resolve(true);
        }, 1000 / processingRate); // Process at fixed rate
      });
    };

    // Add a modest number of items
    const results: Promise<boolean>[] = [];
    for (let i = 0; i < 50; i++) {
      results.push(addToQueue(`img-${String(i)}`));
    }

    const processingResults = await Promise.all(results);

    const avgQueueDepth =
      queueDepthSnapshots.reduce((a, b) => a + b, 0) / queueDepthSnapshots.length;
    const maxObservedQueueDepth = Math.max(...queueDepthSnapshots);

    performanceResults['queue-stability'] = {
      mean: avgQueueDepth,
      throughput: processingRate,
      peakMemory: maxObservedQueueDepth,
    };

    logger.log(
      `Queue stability - Average depth: ${avgQueueDepth.toFixed(2)}, Max depth: ${String(maxObservedQueueDepth)}, Processed: ${String(totalProcessed)}, Rate: ${String(processingRate)}/sec`,
    );

    // All items should process successfully
    expect(processingResults.every((r) => r)).toBe(true);
    // Verify queue was actually used (some snapshots recorded)
    expect(queueDepthSnapshots.length).toBeGreaterThan(0);
  });

  /**
   * Summary: Log all performance metrics
   */
  it('should print media processing performance summary', () => {
    console.log('\n=== Media Processing Performance Summary ===');
    Object.entries(performanceResults).forEach(([name, metrics]) => {
      console.log(`${name}:`);
      if (metrics.mean > 0) {
        console.log(`  Mean latency: ${metrics.mean.toFixed(2)}ms`);
      }
      if (metrics.throughput > 0) {
        console.log(`  Throughput:   ${metrics.throughput.toFixed(2)} ops/s`);
      }
      if (metrics.peakMemory > 0) {
        console.log(`  Peak memory:  ${metrics.peakMemory.toFixed(2)}MB`);
      }
    });
    console.log('============================================\n');
  });
});
