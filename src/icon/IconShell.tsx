import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DEFAULT_ICON_SIZE } from './constants';
import { isResponsiveIconSize, resolveIconSize } from './utils';
import type { IconCommonProps } from './types';

interface IconShellProps extends IconCommonProps {
  children: ReactNode;
}

export function IconShell({
  size = DEFAULT_ICON_SIZE,
  color = 'currentColor',
  className,
  children,
  'aria-label': ariaLabel,
}: IconShellProps) {
  const { mobile, desktop } = resolveIconSize(size);
  const responsive = isResponsiveIconSize(size);

  const style: CSSProperties = responsive
    ? {
        color,
        ['--icon-size-mobile' as string]: `${mobile}px`,
        ['--icon-size-desktop' as string]: `${desktop}px`,
      }
    : {
        color,
        width: mobile,
        height: mobile,
      };

  return (
    <span
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      className={cn(
        'inline-flex shrink-0 items-center justify-center [&>svg]:h-full [&>svg]:w-full',
        responsive &&
          'h-[var(--icon-size-mobile)] w-[var(--icon-size-mobile)] md:h-[var(--icon-size-desktop)] md:w-[var(--icon-size-desktop)]',
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}
