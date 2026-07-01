import { type ComponentPropsWithoutRef, type ElementType, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const CARD_BASE =
  'relative flex flex-col items-center pt-8 pb-6 px-5 rounded-3xl bg-[#FDFAF7] border-2 border-[#F4EEE5] text-center';

type TapeColor = 'honey' | 'mint' | 'blush' | 'brown';

export type MaskingTapeProps = {
  color?: TapeColor;
  rotate?: number;
  width?: number;
  /** Horizontal offset from center. Negative moves left, positive moves right (px). */
  position?: number;
};

export function MaskingTape({
  color = 'honey',
  rotate = -1,
  width = 64,
  position = 0,
}: MaskingTapeProps) {
  const colors: Record<TapeColor, string> = {
    honey: 'bg-[hsl(var(--honey))]',
    mint: 'bg-[hsl(var(--mint))]',
    blush: 'bg-[hsl(var(--blush))]',
    brown: 'bg-[hsl(var(--bear-brown))]',
  };

  const xOffset = position * 0.8;

  return (
    <div
      className={cn(
        'absolute -top-3 left-1/2 h-5 rounded-sm opacity-80 shadow-sm',
        colors[color],
      )}
      style={{
        width: `${width}px`,
        transform: `translateX(calc(-50% + ${xOffset}px)) rotate(${rotate}deg)`,
      }}
    />
  );
}

type FeatureCardFrameProps<T extends ElementType> = {
  as?: T;
  tape: MaskingTapeProps;
  star?: { symbol: string; className: string; side?: 'left' | 'right' };
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className'>;

export function FeatureCardFrame<T extends ElementType = 'div'>({
  as,
  tape,
  star,
  className,
  children,
  ...props
}: FeatureCardFrameProps<T>) {
  const Component = as ?? 'div';

  return (
    <Component className={cn(CARD_BASE, className)} {...props}>
      <MaskingTape {...tape} />
      {star && (
        <span
          className={cn(
            'absolute top-5 text-xs select-none',
            star.side === 'left' ? 'left-5' : 'right-5',
            star.className,
          )}
        >
          {star.symbol}
        </span>
      )}
      {children}
    </Component>
  );
}

export function FeatureBadge({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <div
      className={cn(
        'mb-3 px-3 py-1 rounded-full border text-[11px] font-medium',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FeatureImage({
  src,
  alt,
  className,
  children,
}: {
  src?: string;
  alt: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className="w-28 h-28 mb-4 flex items-center justify-center">
      {src ? (
        <img src={src} alt={alt} className={cn('w-full h-full object-contain drop-shadow-sm', className)} />
      ) : (
        children
      )}
    </div>
  );
}
