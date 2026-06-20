import type { ReactElement } from 'react';
import { IconShell } from '../IconShell';
import { DEFAULT_ICON_SIZE } from '../constants';
import { resolveStrokeWidth } from '../utils';
import { ICON_VIEW_BOX, type InlineIcon, type InlineIconProps } from '../types';

export function createInlineIcon(
  displayName: string,
  renderSvg: (props: { strokeWidth: number }) => ReactElement,
): InlineIcon {
  const Icon = ({
    color,
    size = DEFAULT_ICON_SIZE,
    strokeWidth,
    className,
    'aria-label': ariaLabel,
  }: InlineIconProps) => {
    const resolvedStrokeWidth = resolveStrokeWidth(size, strokeWidth);

    return (
      <IconShell
        size={size}
        color={color}
        className={className}
        aria-label={ariaLabel}
      >
        {renderSvg({ strokeWidth: resolvedStrokeWidth })}
      </IconShell>
    );
  };

  Icon.displayName = displayName;
  return Icon;
}

/**
 * Wrap SVG children in a standard 24×24 inline icon root.
 * Applies shared stroke props; override per-element when needed.
 */
export function inlineSvgRoot(
  strokeWidth: number,
  children: ReactElement['props']['children'],
): ReactElement {
  return (
    <svg
      viewBox={ICON_VIEW_BOX}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="block"
      aria-hidden
    >
      <g
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </g>
    </svg>
  );
}
