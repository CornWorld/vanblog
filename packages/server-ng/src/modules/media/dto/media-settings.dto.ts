import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const MediaProcessingSettingsSchema = z.object({
  compress: z
    .object({
      enabled: z.boolean().default(false),
      quality: z.number().int().min(1).max(100).default(85),
      maxWidth: z.number().int().min(1).max(10000).default(1920),
      maxHeight: z.number().int().min(1).max(10000).default(1080),
      format: z.enum(['jpeg', 'png', 'webp', 'avif', 'auto']).default('auto'),
      progressive: z.boolean().default(true),
      optimizeForWeb: z.boolean().default(true),
      removeMetadata: z.boolean().default(true),
      fit: z.enum(['cover', 'contain', 'fill', 'inside', 'outside']).default('inside'),
    })
    .default({
      enabled: false,
      quality: 85,
      maxWidth: 1920,
      maxHeight: 1080,
      format: 'auto',
      progressive: true,
      optimizeForWeb: true,
      removeMetadata: true,
      fit: 'inside',
    }),
  watermark: z
    .object({
      enabled: z.boolean().default(false),
      text: z.string().optional(),
      position: z
        .enum(['center', 'northwest', 'northeast', 'southwest', 'southeast'])
        .default('southeast'),
      opacity: z.number().min(0).max(1).default(0.5),
    })
    .default({ enabled: false, position: 'southeast', opacity: 0.5 }),
});

export type MediaProcessingSettings = z.infer<typeof MediaProcessingSettingsSchema>;

export class MediaProcessingSettingsDto extends createZodDto(MediaProcessingSettingsSchema) {}

export const MEDIA_PROCESSING_CONFIG_KEY = 'media.processing';

// A partial schema for request-time overrides. Useful for multipart/JSON override parsing.
export const MediaProcessingOverrideSchema = MediaProcessingSettingsSchema.partial();
export type MediaProcessingOverride = z.infer<typeof MediaProcessingOverrideSchema>;
