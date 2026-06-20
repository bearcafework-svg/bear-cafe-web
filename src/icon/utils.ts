import { DEFAULT_ICON_SIZE, DEFAULT_STROKE_WIDTH_RATIO } from './constants';
import type { IconSizeValue } from './types';

export interface ResolvedIconSize {
  mobile: number;
  desktop: number;
}

export function resolveIconSize(size: IconSizeValue = DEFAULT_ICON_SIZE): ResolvedIconSize {
  if (typeof size === 'number') {
    return { mobile: size, desktop: size };
  }

  return size;
}

export function isResponsiveIconSize(size: IconSizeValue = DEFAULT_ICON_SIZE): boolean {
  const { mobile, desktop } = resolveIconSize(size);
  return mobile !== desktop;
}

/** Default inline stroke width from display size (2px at 24px). */
export function defaultStrokeWidth(size: IconSizeValue = DEFAULT_ICON_SIZE): number {
  const { desktop } = resolveIconSize(size);
  return desktop / DEFAULT_STROKE_WIDTH_RATIO;
}

export function resolveStrokeWidth(
  size: IconSizeValue = DEFAULT_ICON_SIZE,
  strokeWidth?: number,
): number {
  return strokeWidth ?? defaultStrokeWidth(size);
}
