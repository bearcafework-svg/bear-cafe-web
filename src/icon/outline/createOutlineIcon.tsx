import { useId, type ReactElement } from 'react';
import { IconShell } from '../IconShell';
import { ICON_VIEW_BOX, type OutlineIcon, type OutlineIconProps } from '../types';

export interface OutlineIconRenderProps {
  /** Unique id for SVG defs (clipPath, etc.) when multiple icons share a page. */
  clipId: string;
}

export function createOutlineIcon(
  displayName: string,
  renderSvg: (props: OutlineIconRenderProps) => ReactElement,
): OutlineIcon {
  const Icon = ({ color, size, className, 'aria-label': ariaLabel }: OutlineIconProps) => {
    const clipId = useId();

    return (
      <IconShell
        size={size}
        color={color}
        className={className}
        aria-label={ariaLabel}
      >
        {renderSvg({ clipId })}
      </IconShell>
    );
  };

  Icon.displayName = displayName;
  return Icon;
}

/**
 * Wrap SVG children in a standard outline icon root. Stroke widths stay as authored.
 * Defaults to the 24×24 canvas; pass a custom viewBox (e.g. '0 0 20 20') for other canvases.
 */
export function outlineSvgRoot(
  children: ReactElement['props']['children'],
  viewBox: string = ICON_VIEW_BOX,
): ReactElement {
  return (
    <svg
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="block"
      aria-hidden
    >
      {children}
    </svg>
  );
}
