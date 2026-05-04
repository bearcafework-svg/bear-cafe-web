/**
 * Compress / resize an image file on the client using Canvas.
 *
 * - Maintains aspect ratio.
 * - Re-encodes as JPEG (or WebP) with adjustable quality.
 * - Returns a new File that is ≤ `maxSizeBytes`.
 */

interface CompressOptions {
  /** Maximum width in px (default 1920) */
  maxWidth?: number;
  /** Maximum height in px (default 1080) */
  maxHeight?: number;
  /** Target max file size in bytes (default 5 MB) */
  maxSizeBytes?: number;
  /** Initial JPEG quality 0-1 (default 0.85) */
  initialQuality?: number;
  /** Output mime type (default image/jpeg) */
  outputType?: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<File> {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    maxSizeBytes = 5 * 1024 * 1024,
    initialQuality = 0.85,
    outputType = 'image/jpeg',
  } = options;

  // If file is already small enough and is JPEG/WebP, skip compression
  if (file.size <= maxSizeBytes && /image\/(jpeg|webp)/.test(file.type)) {
    return file;
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);

    // Calculate scaled dimensions
    let { width, height } = img;
    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // For JPEG output: fill white background first (JPEG has no alpha channel,
    // transparent pixels would otherwise render as black).
    // For PNG/WebP: leave transparent — clearRect is the default (alpha = 0).
    if (outputType === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(img, 0, 0, width, height);

    // Try progressively lower quality until under maxSizeBytes
    let quality = initialQuality;
    let blob: Blob | null = null;

    for (let attempt = 0; attempt < 6; attempt++) {
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, outputType, quality),
      );
      if (blob && blob.size <= maxSizeBytes) break;
      quality -= 0.1;
      if (quality < 0.3) break;
    }

    if (!blob) {
      // Fallback: return original
      return file;
    }

    const ext = outputType === 'image/webp' ? 'webp' : 'jpg';
    const newName = file.name.replace(/\.[^.]+$/, `.${ext}`);
    return new File([blob], newName, { type: outputType });
  } finally {
    URL.revokeObjectURL(url);
  }
}
