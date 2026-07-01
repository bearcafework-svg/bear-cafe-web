import { motion } from 'framer-motion';
import { StrawberryColorIcon } from '@/icon/outline';
import { cn, formatNumber } from '@/lib/utils';

interface StrawberryJarProps {
  points: number;
  maxPoints?: number;
  isLoading?: boolean;
  className?: string;
}

export function StrawberryJar({
  points,
  maxPoints = 750,
  isLoading,
  className,
}: StrawberryJarProps) {
  const isNegative = points < 0;
  const percent =
    maxPoints > 0 ? Math.max(0, Math.min(100, (points / maxPoints) * 100)) : 0;

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative w-full flex justify-center py-2 sm:py-4">
        <motion.div
          className="relative h-52 w-36 sm:h-60 sm:w-44"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          {/* Lid */}
          <div className="absolute left-1/2 top-6 z-10 h-3 w-[72%] -translate-x-1/2 rounded-sm bg-[hsl(var(--bear-brown)/0.4)] dark:bg-rose-900/50" />
          <div className="absolute left-1/2 top-1 z-10 -translate-x-1/2">
            <StrawberryColorIcon size={48} />
          </div>

          {/* Jar body */}
          <div
            className={cn(
              'absolute inset-x-0 bottom-0 top-10 overflow-hidden rounded-b-[2rem] rounded-t-xl',
              'border-2 border-[hsl(var(--latte)/0.7)] dark:border-[hsl(var(--coffee)/0.5)]',
              'bg-[hsl(var(--cream)/0.3)] dark:bg-[hsl(var(--mocha)/0.15)]',
            )}
          >
            <motion.div
              className={cn(
                'absolute inset-x-0 bottom-0',
                isNegative
                  ? 'bg-gradient-to-t from-red-600/80 to-orange-400/50'
                  : 'bg-gradient-to-t from-rose-600/85 via-rose-400/75 to-[hsl(var(--blush)/0.55)]',
              )}
              initial={{ height: 0 }}
              animate={{ height: isLoading ? 0 : `${percent}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />

            {/* Glass shine */}
            <div className="pointer-events-none absolute inset-y-3 left-2 w-2 rounded-full bg-white/25 dark:bg-white/10" />
          </div>
        </motion.div>
      </div>

      <div className="w-full space-y-3 px-1">
        <div className="flex items-end justify-center gap-2">
          <StrawberryColorIcon size={24} className="mb-1 shrink-0" />
          <span
            className={cn(
              'text-4xl font-bold tabular-nums leading-none sm:text-5xl',
              isNegative ? 'text-destructive' : 'text-foreground',
            )}
          >
            {isLoading ? '—' : formatNumber(points)}
          </span>
          <span className="mb-1 text-sm text-muted-foreground tabular-nums">
            / {isLoading ? '—' : formatNumber(maxPoints)}
          </span>
        </div>

        <div className="h-2.5 overflow-hidden rounded-full bg-[hsl(var(--latte)/0.45)] dark:bg-[hsl(var(--coffee)/0.35)]">
          <motion.div
            className={cn(
              'h-full rounded-full',
              isNegative
                ? 'bg-gradient-to-r from-red-500 to-orange-400'
                : 'bg-gradient-to-r from-rose-500 via-red-400 to-rose-400',
            )}
            initial={{ width: 0 }}
            animate={{ width: isLoading ? '0%' : `${percent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {isLoading
            ? 'กำลังโหลดแต้ม...'
            : isNegative
              ? 'แต้มติดลบ — รีบเติมสตรอว์เบอร์รี่นะ'
              : percent >= 100
                ? 'ขวดเต็มแล้ว! เก่งมาก'
                : `สะสมอีก ${formatNumber(maxPoints - points)} แต้มจะเต็มขวด`}
        </p>
      </div>
    </div>
  );
}
