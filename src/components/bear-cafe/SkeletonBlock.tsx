import { cn } from '@/lib/utils';

/**
 * Shared primitives for the auth-gate page skeletons (HomePageSkeleton,
 * PageSkeletons). Private to the bear-cafe feature (Design Doc C1 — never
 * export from components/ui).
 */

type SkeletonBlockProps = { className?: string } & React.HTMLAttributes<HTMLDivElement>;

/**
 * Flat Figma-colored placeholder. `motion-reduce:animate-none` lives here and
 * only here so every pulsing block inherits the reduced-motion disable (AC-007).
 */
export function SkeletonBlock({ className, ...props }: SkeletonBlockProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'bg-[#EADCCC] dark:bg-[#1B1B1B] animate-pulse motion-reduce:animate-none',
        className,
      )}
      {...props}
    />
  );
}

/** Skeleton card surface shared by all page skeleton cards (Figma values). */
export const SKELETON_CARD_SURFACE =
  'bg-[#F2EBE4] dark:bg-[#101010] dark:border-2 dark:border-[#121212]';
