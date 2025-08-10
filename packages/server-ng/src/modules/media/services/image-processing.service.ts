import { promises as fsPromises } from 'fs';

import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

export interface ImageProcessingOptions {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  watermark?: {
    text?: string;
    imagePath?: string;
    position?: 'center' | 'northwest' | 'northeast' | 'southwest' | 'southeast';
    opacity?: number;
  };
}

@Injectable()
export class ImageProcessingService {
  async compressImage(inputBuffer: Buffer, options: ImageProcessingOptions = {}): Promise<Buffer> {
    const { quality = 80, maxWidth = 1920, maxHeight = 1080 } = options;

    let pipeline = sharp(inputBuffer);

    const metadata = await pipeline.metadata();

    if (metadata.width && metadata.width > maxWidth) {
      pipeline = pipeline.resize(maxWidth, null, {
        withoutEnlargement: true,
        fit: 'inside',
      });
    } else if (metadata.height && metadata.height > maxHeight) {
      pipeline = pipeline.resize(null, maxHeight, {
        withoutEnlargement: true,
        fit: 'inside',
      });
    }

    if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
      pipeline = pipeline.jpeg({ quality });
    } else if (metadata.format === 'png') {
      pipeline = pipeline.png({ quality });
    } else if (metadata.format === 'webp') {
      pipeline = pipeline.webp({ quality });
    }

    return pipeline.toBuffer();
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
      } catch (error) {
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
