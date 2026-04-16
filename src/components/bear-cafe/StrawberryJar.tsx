import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import strawberryVideoLight from '@/assets/strawberry-jar-light.mp4';
import strawberryVideoDark from '@/assets/strawberry-jar.mp4';
import strawberryIcon from '@/assets/strawberry-icon.png';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface StrawberryJarProps {
  points: number;
  maxPoints?: number;
  isLoading?: boolean;
}

export function StrawberryJar({ points, maxPoints = 500, isLoading }: StrawberryJarProps) {
  const { resolvedTheme } = useTheme();
  const videoSrc = resolvedTheme === 'dark' ? strawberryVideoDark : strawberryVideoLight;
  const isNegative = points < 0;
  const percent = maxPoints > 0 ? Math.max(0, Math.min(100, (points / maxPoints) * 100)) : 0;

  return (
    <div className="relative flex flex-col items-center">
      {/* Video Container */}
      <div className="relative w-64 h-64 sm:w-80 sm:h-80">
        <div className="absolute inset-0 rounded-2xl dark:bg-[radial-gradient(circle,hsl(var(--accent)/0.40)_0%,transparent_70%)]" />
        <video
          key={videoSrc}
          src={videoSrc}
          autoPlay
          loop
          muted
          playsInline
          className="relative w-full h-full object-contain rounded-2xl dark:mix-blend-screen"
        />
      </div>

      {/* Points Display */}
      <motion.div
        className="mt-6 text-center w-full max-w-xs"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="flex items-center justify-center gap-2">
          <span className={cn(
            'text-4xl sm:text-5xl font-bold bg-clip-text text-transparent',
            isNegative
              ? 'bg-gradient-to-r from-red-600 via-red-500 to-orange-500'
              : 'bg-gradient-to-r from-rose-500 via-pink-500 to-red-400'
          )}>
            {isLoading ? '...' : points.toLocaleString()}
          </span>
          <img src={strawberryIcon} alt="🍓" className="w-8 h-8 sm:w-10 sm:h-10" />
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {isNegative ? 'แต้มติดลบ! 😱' : 'สตอเบอรี่ที่สะสม'}
        </p>

        {/* Progress Bar */}
        <div className="mt-4 space-y-1.5">
          <div className="relative">
            <Progress
              value={isLoading ? 0 : percent}
              className="h-3 bg-rose-100 dark:bg-rose-950/40 rounded-full"
            />
            <div
              className={cn(
                'absolute inset-0 h-3 rounded-full transition-all duration-700 ease-out',
                isNegative
                  ? 'bg-gradient-to-r from-red-500 to-orange-500'
                  : 'bg-gradient-to-r from-rose-400 via-pink-500 to-red-400'
              )}
              style={{ width: `${isLoading ? 0 : percent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground px-0.5">
            <span className={cn(isNegative && 'text-destructive font-medium')}>
              {isLoading ? '...' : points.toLocaleString()}
            </span>
            <span>{maxPoints.toLocaleString()}</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
