// Client-side image normalization for uploads.
//
// Why this exists:
//   pb's thumbnail generator only supports JPEG/PNG/GIF/WebP
//   (see apis/file.go:22 imageContentTypes). BMP/TIFF/SVG/AVIF uploaded
//   in their original form would have no thumb and silently fall back
//   to the original — wasteful for large BMPs, meaningless for SVG.
//
// Strategy:
//   - SVG — vector format, resizing is meaningless. Always pass through
//     with a "no thumb" note regardless of config (wasm can't help).
//   - JPEG/PNG/GIF/WebP — pass through (pb thumbs work).
//   - BMP/TIFF/AVIF — depends on `targetFormat`:
//       * webp: rasterize via createImageBitmap, re-encode as WebP
//         via @jsquash/webp. ~80KB wasm on first use.
//       * avif: same rasterize path, re-encode via @jsquash/avif.
//         ~8MB wasm on first use; encoding is ~5-10x slower than WebP.
//       * preserve: pass through, surface "no thumb" note.
//
// Failure policy: if any step in the wasm path fails (browser can't
// decode, wasm load fail, encode fail), log a warning and fall back to
// uploading the original. The user still gets their image; they just
// lose the thumb.

export type TargetFormat = 'webp' | 'avif' | 'preserve';

export interface MediaConfig {
  enabled: boolean;
  targetFormat: TargetFormat;
  /** 1-100, applies to webp/avif encoding only. */
  quality: number;
}

export type NormalizedFile = {
  file: File;
  note?: string;
};

const THUMB_UNSUPPORTED_NOTE = '此格式不会生成缩略图，前台将显示原图';

const DEFAULT_CONFIG: MediaConfig = {
  enabled: true,
  targetFormat: 'webp',
  quality: 84,
};

// MIME types whose source we want to rasterize and re-encode. PNG/JPEG/
// GIF/WebP already produce thumbs, so we leave them alone — even when
// targetFormat=avif, re-encoding a 50KB PNG to a possibly-larger AVIF
// makes no sense for the use case (just let pb thumb it natively).
const SOURCE_NEEDS_REENCODE: Record<string, true> = {
  'image/bmp': true,
  'image/x-ms-bmp': true,
  'image/tiff': true,
  'image/avif': true,
};

const MIME_BY_TARGET: Record<Exclude<TargetFormat, 'preserve'>, string> = {
  webp: 'image/webp',
  avif: 'image/avif',
};

/**
 * Normalize a single image file for upload. Returns the (possibly
 * converted) file plus an optional user-facing note. Never throws —
 * on conversion failure, returns the original file with a note.
 */
export async function normalizeImage(
  file: File,
  config: MediaConfig = DEFAULT_CONFIG,
): Promise<NormalizedFile> {
  // SVG: skip everything regardless of config (vector → wasm useless).
  if (
    file.type === 'image/svg+xml' ||
    file.name.toLowerCase().endsWith('.svg')
  ) {
    return { file, note: THUMB_UNSUPPORTED_NOTE };
  }

  // Disabled or preserve mode: pass through. Only annotate the
  // pb-thumb-unsupported source types so the user understands why no
  // thumb appears on the rendered page.
  if (!config.enabled || config.targetFormat === 'preserve') {
    if (SOURCE_NEEDS_REENCODE[file.type]) {
      return { file, note: THUMB_UNSUPPORTED_NOTE };
    }
    return { file };
  }

  // Source already produces a pb thumb — leave it.
  if (!SOURCE_NEEDS_REENCODE[file.type]) {
    return { file };
  }

  try {
    const converted = await convertRaster(file, config.targetFormat, config.quality);
    if (converted) {
      return { file: converted };
    }
  } catch (e) {
    console.warn(
      `[editor] image normalization failed for ${file.name} (${file.type}), uploading original:`,
      e,
    );
  }
  return { file, note: `${THUMB_UNSUPPORTED_NOTE}（转换失败）` };
}

/**
 * Rasterize a source image via the browser's createImageBitmap, then
 * re-encode to the target format via @jsquash codecs. Returns null if
 * the browser couldn't decode the source.
 *
 * We pull ImageData out of a canvas (works in all evergreen browsers),
 * then hand to the appropriate @jsquash encoder. Each codec is loaded
 * via dynamic import so its wasm lands only on first use of that path.
 */
async function convertRaster(
  file: File,
  targetFormat: Exclude<TargetFormat, 'preserve'>,
  quality: number,
): Promise<File | null> {
  if (typeof createImageBitmap === 'undefined') return null;

  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    let encoded: ArrayBuffer;
    if (targetFormat === 'webp') {
      const { encode } = await import('@jsquash/webp');
      encoded = await encode(imageData, { quality });
    } else {
      const { encode } = await import('@jsquash/avif');
      // Both @jsquash encoders take a 0-100 quality score; the codec
      // wrapper maps it to libavif's internal cqLevel. Default is 50;
      // user-supplied quality (1-100) passes through unchanged.
      encoded = await encode(imageData, { quality });
    }

    const baseName = file.name.replace(/\.[^.]+$/, '');
    const ext = targetFormat;
    return new File([encoded], `${baseName}.${ext}`, {
      type: MIME_BY_TARGET[targetFormat],
    });
  } finally {
    bitmap.close?.();
  }
}
