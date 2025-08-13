import { promises as fsPromises } from 'fs';

import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';

export interface ImageProcessingOptions {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  format?: 'jpeg' | 'png' | 'webp' | 'avif' | 'auto';
  progressive?: boolean;
  optimizeForWeb?: boolean;
  removeMetadata?: boolean;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  watermark?: {
    text?: string;
    imagePath?: string;
    position?: 'center' | 'northwest' | 'northeast' | 'southwest' | 'southeast';
    opacity?: number;
  };
}

interface ProcessingResult {
  buffer: Buffer;
  metadata: {
    width?: number;
    height?: number;
    format?: string;
    size?: number;
    hasAlpha?: boolean;
    density?: number;
  };
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

@Injectable()
export class ImageProcessingService {
  private readonly logger = new Logger(ImageProcessingService.name);

  async compressImage(
    inputBuffer: Buffer,
    options: ImageProcessingOptions = {},
  ): Promise<ProcessingResult> {
    const {
      quality = 80,
      maxWidth = 1920,
      maxHeight = 1080,
      format = 'auto',
      progressive = true,
      optimizeForWeb = true,
      removeMetadata = true,
      fit = 'inside',
    } = options;

    const startTime = Date.now();
    const originalSize = inputBuffer.length;

    let pipeline = sharp(inputBuffer, {
      // 启用 SIMD 加速
      sequentialRead: true,
      // 限制内存使用
      limitInputPixels: 268402689, // 16384 x 16384
    });

    const metadata = (await pipeline.metadata()) as {
      width?: number;
      height?: number;
      format?: keyof import('sharp').FormatEnum;
      density?: number;
      hasAlpha?: boolean;
    };

    // 移除元数据以减小文件大小
    if (removeMetadata) {
      pipeline = pipeline.withMetadata({
        density: metadata.density,
      });
    }

    // 调整尺寸
    if (
      (metadata.width && metadata.width > maxWidth) ||
      (metadata.height && metadata.height > maxHeight)
    ) {
      pipeline = pipeline.resize(maxWidth, maxHeight, {
        fit,
        withoutEnlargement: true,
        // 使用高质量的重采样算法
        kernel: sharp.kernel.lanczos3,
      });
    }

    // 确定输出格式
    const outputFormat = this.determineOutputFormat(format, metadata);

    // 应用格式特定的优化
    switch (outputFormat) {
      case 'jpeg':
        pipeline = pipeline.jpeg({
          quality,
          progressive,
          mozjpeg: optimizeForWeb, // 使用 mozjpeg 编码器
          trellisQuantisation: optimizeForWeb,
          overshootDeringing: optimizeForWeb,
          optimizeScans: optimizeForWeb,
        });
        break;

      case 'png':
        pipeline = pipeline.png({
          quality,
          progressive,
          compressionLevel: 9, // 最高压缩级别
          adaptiveFiltering: optimizeForWeb,
          palette: optimizeForWeb, // 尝试使用调色板
        });
        break;

      case 'webp':
        pipeline = pipeline.webp({
          quality,
          effort: optimizeForWeb ? 6 : 4, // 压缩努力程度
          lossless: false,
          nearLossless: false,
          smartSubsample: optimizeForWeb,
        });
        break;

      case 'avif':
        pipeline = pipeline.avif({
          quality,
          effort: optimizeForWeb ? 9 : 4, // AVIF 压缩努力程度
          lossless: false,
        });
        break;
    }

    const outputBuffer = await pipeline.toBuffer({ resolveWithObject: true });
    const processingTime = Date.now() - startTime;

    const compressionRatio =
      originalSize > 0 ? Math.round((1 - outputBuffer.info.size / originalSize) * 100) : 0;

    const result: ProcessingResult = {
      buffer: outputBuffer.data,
      metadata: {
        width: outputBuffer.info.width,
        height: outputBuffer.info.height,
        format: outputBuffer.info.format,
        size: outputBuffer.info.size,
        hasAlpha: outputBuffer.info.channels === 4,
        density: metadata.density,
      },
      originalSize,
      compressedSize: outputBuffer.info.size,
      compressionRatio,
    };

    this.logger.debug(
      `Image processed in ${String(processingTime)}ms: ${String(originalSize)} -> ${String(outputBuffer.info.size)} bytes (${String(compressionRatio)}% reduction)`,
    );

    return result;
  }

  /**
   * 确定最佳输出格式
   */
  private determineOutputFormat(
    requestedFormat: string,
    metadata: sharp.Metadata,
  ): 'jpeg' | 'png' | 'webp' | 'avif' {
    if (requestedFormat !== 'auto') {
      return requestedFormat as 'jpeg' | 'png' | 'webp' | 'avif';
    }

    // 如果图片有透明度，优先使用支持透明度的格式
    if (metadata.hasAlpha) {
      return 'webp'; // WebP 支持透明度且压缩率更好
    }

    // 对于照片类图片，使用 JPEG 或 WebP
    if (metadata.density && metadata.density > 150) {
      return 'webp'; // 高分辨率图片使用 WebP
    }

    // 默认使用 WebP，因为它通常有更好的压缩率
    return 'webp';
  }

  async addWatermark(
    inputBuffer: Buffer,
    watermark: ImageProcessingOptions['watermark'],
  ): Promise<Buffer> {
    if (!watermark) {
      return inputBuffer;
    }

    const pipeline = sharp(inputBuffer);
    const metadata = await pipeline.metadata();

    if (!metadata.width || !metadata.height) {
      return inputBuffer;
    }

    if (watermark.text) {
      const svgText = `
        <svg width="${String(metadata.width)}" height="${String(metadata.height)}">
          <text 
            x="50%" 
            y="50%" 
            text-anchor="middle" 
            dominant-baseline="middle"
            font-family="Arial, sans-serif" 
            font-size="48" 
            fill="white" 
            fill-opacity="${String(watermark.opacity ?? 0.5)}"
            stroke="black" 
            stroke-width="1"
            stroke-opacity="${String((watermark.opacity ?? 0.5) * 0.8)}"
          >${watermark.text}</text>
        </svg>
      `;

      const watermarkBuffer = Buffer.from(svgText);

      return pipeline
        .composite([
          {
            input: watermarkBuffer,
            gravity: this.getGravity(watermark.position),
          },
        ])
        .toBuffer();
    }

    if (watermark.imagePath) {
      try {
        const watermarkBuffer = await fsPromises.readFile(watermark.imagePath);
        const watermarkMetadata = await sharp(watermarkBuffer).metadata();

        if (!watermarkMetadata.width || !watermarkMetadata.height) {
          return inputBuffer;
        }

        const maxWatermarkWidth = Math.floor(metadata.width * 0.3);
        const maxWatermarkHeight = Math.floor(metadata.height * 0.3);

        let processedWatermark = sharp(watermarkBuffer);

        if (
          watermarkMetadata.width > maxWatermarkWidth ||
          watermarkMetadata.height > maxWatermarkHeight
        ) {
          processedWatermark = processedWatermark.resize(maxWatermarkWidth, maxWatermarkHeight, {
            fit: 'inside',
            withoutEnlargement: true,
          });
        }

        const watermarkFinal = await processedWatermark.toBuffer();

        return await pipeline
          .composite([
            {
              input: watermarkFinal,
              gravity: this.getGravity(watermark.position),
              blend: 'over',
            },
          ])
          .toBuffer();
      } catch (error: unknown) {
        void error;
        return inputBuffer;
      }
    }

    return inputBuffer;
  }

  async getImageMetadata(inputBuffer: Buffer): Promise<{
    width?: number;
    height?: number;
    format?: string;
    size?: number;
    density?: number;
    hasAlpha?: boolean;
    orientation?: number;
  }> {
    const metadata = await sharp(inputBuffer).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: metadata.size,
      density: metadata.density,
      hasAlpha: metadata.hasAlpha,
      orientation: metadata.orientation,
    };
  }

  async generateThumbnail(inputBuffer: Buffer, size = 200): Promise<Buffer> {
    return sharp(inputBuffer)
      .resize(size, size, {
        fit: 'cover',
        position: 'center',
      })
      .toBuffer();
  }

  private getGravity(position?: string): sharp.Gravity {
    switch (position) {
      case 'northwest':
        return 'northwest';
      case 'northeast':
        return 'northeast';
      case 'southwest':
        return 'southwest';
      case 'southeast':
        return 'southeast';
      case 'center':
        return 'center';
      case undefined:
      default:
        return 'center';
    }
  }
}
