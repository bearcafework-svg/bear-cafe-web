import type { FC } from 'react';

/** Default design canvas for all icons (24×24). */
export const ICON_VIEW_BOX = '0 0 24 24';

export type IconSizeValue =
  | number
  | {
      mobile: number;
      desktop: number;
    };

export interface IconCommonProps {
  /** Icon color. Defaults to `currentColor`. */
  color?: string;
  /** Size in px. Default 24. Pass `{ mobile, desktop }` for responsive sizing. */
  size?: IconSizeValue;
  className?: string;
  /** Accessible label. Omit for decorative icons. */
  'aria-label'?: string;
}

/** Outline icons keep their original SVG stroke widths. */
export type OutlineIconProps = IconCommonProps;

export interface InlineIconProps extends IconCommonProps {
  /**
   * Stroke width in viewBox units (24×24 canvas).
   * Defaults to `size / 12` (2 at the default 24px size).
   */
  strokeWidth?: number;
}

export type OutlineIcon = FC<OutlineIconProps>;
export type InlineIcon = FC<InlineIconProps>;

