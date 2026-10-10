import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

/**
 * Proxies and optimizes images via Cloudflare CDN (wsrv.nl).
 * - Caches images at Cloudflare Edge (drastically reduces Supabase Storage egress to ~0)
 * - Converts images dynamically to WebP
 * - Resizes images to prevent downloading full multi-megabyte originals
 */
export function getOptimizedImageUrl(
  url?: string | null,
  options?: { width?: number; height?: number; quality?: number; fit?: 'cover' | 'contain' }
): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return trimmed;
  }
  // Skip if data URI, blob URI, SVG, or already proxied
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.includes('wsrv.nl') ||
    trimmed.endsWith('.svg')
  ) {
    return trimmed;
  }

  const params = new URLSearchParams();
  params.set('url', trimmed);
  params.set('output', 'webp');
  if (options?.width) params.set('w', options.width.toString());
  if (options?.height) params.set('h', options.height.toString());
  if (options?.quality) params.set('q', options.quality.toString());
  if (options?.fit) params.set('fit', options.fit);

  return `https://wsrv.nl/?${params.toString()}`;
}
