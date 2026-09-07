import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { flushSync } from 'react-dom';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

export type TransitionVariant =
  | 'circle'
  | 'square'
  | 'triangle'
  | 'diamond'
  | 'hexagon'
  | 'rectangle'
  | 'star';

function polygonCollapsed(point: string, vertexCount: number): string {
  const pairs = Array.from({ length: vertexCount }, () => point).join(', ');
  return `polygon(${pairs})`;
}

// All coordinates are percentages of the snapshot reference box to avoid scale offsets
function getThemeTransitionClipPaths(
  variant: TransitionVariant,
  cx: number,
  cy: number,
  maxRadius: number,
  viewportWidth: number,
  viewportHeight: number
): [string, string] {
  const toX = (x: number) => `${(x / viewportWidth) * 100}%`;
  const toY = (y: number) => `${(y / viewportHeight) * 100}%`;
  const point = (x: number, y: number) => `${toX(x)} ${toY(y)}`;
  const toRadius = (r: number) =>
    `${(r / (Math.hypot(viewportWidth, viewportHeight) / Math.SQRT2)) * 100}%`;

  switch (variant) {
    case 'circle':
      return [
        `circle(0% at ${point(cx, cy)})`,
        `circle(${toRadius(maxRadius)} at ${point(cx, cy)})`,
      ];
    case 'square': {
      const halfW = Math.max(cx, viewportWidth - cx);
      const halfH = Math.max(cy, viewportHeight - cy);
      const halfSide = Math.max(halfW, halfH) * 1.05;
      const end = [
        point(cx - halfSide, cy - halfSide),
        point(cx + halfSide, cy - halfSide),
        point(cx + halfSide, cy + halfSide),
        point(cx - halfSide, cy + halfSide),
      ].join(', ');
      return [polygonCollapsed(point(cx, cy), 4), `polygon(${end})`];
    }
    case 'triangle': {
      const scale = maxRadius * 2.2;
      const dx = (Math.sqrt(3) / 2) * scale;
      const verts = [
        point(cx, cy - scale),
        point(cx + dx, cy + 0.5 * scale),
        point(cx - dx, cy + 0.5 * scale),
      ].join(', ');
      return [polygonCollapsed(point(cx, cy), 3), `polygon(${verts})`];
    }
    case 'diamond': {
      const R = maxRadius * Math.SQRT2;
      const end = [
        point(cx, cy - R),
        point(cx + R, cy),
        point(cx, cy + R),
        point(cx - R, cy),
      ].join(', ');
      return [polygonCollapsed(point(cx, cy), 4), `polygon(${end})`];
    }
    case 'hexagon': {
      const R = maxRadius * Math.SQRT2;
      const verts: string[] = [];
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 3;
        verts.push(point(cx + R * Math.cos(a), cy + R * Math.sin(a)));
      }
      return [
        polygonCollapsed(point(cx, cy), 6),
        `polygon(${verts.join(', ')})`,
      ];
    }
    case 'rectangle': {
      const halfW = Math.max(cx, viewportWidth - cx);
      const halfH = Math.max(cy, viewportHeight - cy);
      const end = [
        point(cx - halfW, cy - halfH),
        point(cx + halfW, cy - halfH),
        point(cx + halfW, cy + halfH),
        point(cx - halfW, cy + halfH),
      ].join(', ');
      return [polygonCollapsed(point(cx, cy), 4), `polygon(${end})`];
    }
    case 'star': {
      const R = maxRadius * Math.SQRT2 * 1.03;
      const innerRatio = 0.42;
      const starPolygon = (radius: number) => {
        const verts: string[] = [];
        for (let i = 0; i < 5; i++) {
          const outerA = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
          verts.push(
            point(
              cx + radius * Math.cos(outerA),
              cy + radius * Math.sin(outerA)
            )
          );
          const innerA = outerA + Math.PI / 5;
          verts.push(
            point(
              cx + radius * innerRatio * Math.cos(innerA),
              cy + radius * innerRatio * Math.sin(innerA)
            )
          );
        }
        return `polygon(${verts.join(', ')})`;
      };
      const startR = Math.max(2, R * 0.025);
      return [starPolygon(startR), starPolygon(R)];
    }
    default:
      return [
        `circle(0% at ${point(cx, cy)})`,
        `circle(${toRadius(maxRadius)} at ${point(cx, cy)})`,
      ];
  }
}

export interface UseAnimatedThemeToggleOptions {
  duration?: number;
  variant?: TransitionVariant;
  fromCenter?: boolean;
}

/**
 * Custom hook providing animated theme toggling using the browser's View Transitions API.
 */
export function useAnimatedThemeToggle(options: UseAnimatedThemeToggleOptions = {}) {
  const { duration = 450, variant = 'circle', fromCenter = false } = options;
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [localTheme, setLocalTheme] = useState<'light' | 'dark' | null>(null);
  const isTransitioningRef = useRef(false);
  const activeAnimRef = useRef<Animation | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // When next-themes updates, sync local theme
  useEffect(() => {
    if (resolvedTheme || theme) {
      setLocalTheme((resolvedTheme || theme) === 'dark' ? 'dark' : 'light');
    }
  }, [resolvedTheme, theme]);

  const activeTheme = localTheme ?? (resolvedTheme || theme);
  const isDark = mounted ? activeTheme === 'dark' : false;

  const cancelAnim = useCallback(() => {
    activeAnimRef.current?.cancel();
    activeAnimRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cancelAnim();
      const root = document.documentElement;
      if (root.dataset.magicuiThemeVt !== 'active') return;
      delete root.dataset.magicuiThemeVt;
      root.style.removeProperty('--magicui-theme-toggle-vt-duration');
      root.style.removeProperty('--magicui-theme-vt-clip-from');
    };
  }, [cancelAnim]);

  const toggleTheme = useCallback(
    (originTarget?: React.MouseEvent | HTMLElement | null) => {
      if (isTransitioningRef.current || document.documentElement.dataset.magicuiThemeVt === 'active') {
        return;
      }

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let x: number;
      let y: number;

      if (fromCenter || !originTarget) {
        x = viewportWidth / 2;
        y = viewportHeight / 2;
      } else if ('clientX' in originTarget) {
        x = originTarget.clientX;
        y = originTarget.clientY;
      } else {
        const rect = originTarget.getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
      }

      const maxRadius = Math.hypot(
        Math.max(x, viewportWidth - x),
        Math.max(y, viewportHeight - y)
      );

      const nextTheme: 'light' | 'dark' = isDark ? 'light' : 'dark';

      const applyThemeDirectly = () => {
        // 1. Immediately toggle the class on <html> (<0.1ms).
        // This updates ALL CSS variables & Tailwind dark:* rules on the DOM instantly
        // without forcing the entire React component tree to re-render synchronously!
        document.documentElement.classList.toggle('dark', nextTheme === 'dark');
        setLocalTheme(nextTheme);
      };

      // Fallback if browser doesn't support View Transitions API
      if (typeof (document as any).startViewTransition !== 'function') {
        applyThemeDirectly();
        setTheme(nextTheme);
        return;
      }

      const clipPath = getThemeTransitionClipPaths(
        variant,
        x,
        y,
        maxRadius,
        viewportWidth,
        viewportHeight
      );

      const root = document.documentElement;
      root.dataset.magicuiThemeVt = 'active';
      root.style.setProperty('--magicui-theme-toggle-vt-duration', `${duration}ms`);
      root.style.setProperty('--magicui-theme-vt-clip-from', clipPath[0]);

      const cleanup = () => {
        isTransitioningRef.current = false;
        delete root.dataset.magicuiThemeVt;
        root.style.removeProperty('--magicui-theme-toggle-vt-duration');
        root.style.removeProperty('--magicui-theme-vt-clip-from');
        cancelAnim();
        // Defer next-themes update until animation has fully finished!
        setTheme(nextTheme);
      };

      isTransitioningRef.current = true;
      const transition = (document as any).startViewTransition(() => {
        flushSync(applyThemeDirectly);
      });

      if (typeof transition?.finished?.finally === 'function') {
        transition.finished.finally(cleanup).catch(() => {});
      } else {
        cleanup();
      }

      const ready = transition?.ready;
      if (ready && typeof ready.then === 'function') {
        ready
          .then(() => {
            const anim = document.documentElement.animate(
              { clipPath },
              {
                duration,
                easing: variant === 'star' ? 'linear' : 'ease-in-out',
                fill: 'forwards',
                pseudoElement: '::view-transition-new(root)',
              }
            );
            activeAnimRef.current = anim;
          })
          .catch(() => {});
      }
    },
    [isDark, duration, variant, fromCenter, setTheme, cancelAnim]
  );

  return {
    isDark,
    theme: activeTheme,
    toggleTheme,
    mounted,
  };
}

export interface AnimatedThemeTogglerProps
  extends React.ComponentPropsWithoutRef<'button'> {
  duration?: number;
  variant?: TransitionVariant;
  fromCenter?: boolean;
  children?:
    | React.ReactNode
    | ((props: {
        isDark: boolean;
        toggleTheme: (e?: React.MouseEvent) => void;
      }) => React.ReactNode);
}

export const AnimatedThemeToggler = ({
  className,
  duration = 450,
  variant = 'circle',
  fromCenter = false,
  children,
  onClick,
  ...props
}: AnimatedThemeTogglerProps) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { isDark, toggleTheme } = useAnimatedThemeToggle({
    duration,
    variant,
    fromCenter,
  });

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    toggleTheme(buttonRef.current || e);
  };

  if (typeof children === 'function') {
    return (
      <>
        {children({
          isDark,
          toggleTheme: (e) => toggleTheme(buttonRef.current || e),
        })}
      </>
    );
  }

  return (
    <button
      type="button"
      ref={buttonRef}
      onClick={handleClick}
      className={cn(
        'inline-flex items-center justify-center p-2 rounded-xl border border-border bg-card text-foreground hover:bg-muted/80 transition-colors shadow-xs',
        className
      )}
      {...props}
    >
      {children ? (
        children
      ) : isDark ? (
        <Sun className="h-4 w-4 text-amber-400" />
      ) : (
        <Moon className="h-4 w-4 text-slate-700 dark:text-slate-300" />
      )}
      <span className="sr-only">Toggle theme</span>
    </button>
  );
};

export default AnimatedThemeToggler;
