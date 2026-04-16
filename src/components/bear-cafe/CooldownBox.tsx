import { useState } from 'react';
import { Lock, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CooldownBoxProps {
  isOnCooldown: boolean;
  formattedTime: string;
  remainingMinutes: number;
}

export function CooldownBox({ isOnCooldown, formattedTime, remainingMinutes }: CooldownBoxProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!isOnCooldown) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "fixed right-4 top-20 lg:right-8 z-40",
        // Light mode - warm cream background with strong contrast
        "bg-gradient-to-br from-orange-50 via-red-50 to-rose-50",
        "border-2 border-destructive/50",
        "shadow-xl shadow-destructive/20",
        // Dark mode - solid dark background with bright accents
        "dark:bg-gradient-to-br dark:from-destructive/30 dark:via-rose-900/40 dark:to-red-950/50",
        "dark:border-destructive/60 dark:shadow-destructive/30",
        "backdrop-blur-md rounded-2xl"
      )}
    >
      {/* Collapsed View - Mobile/Tablet only */}
      <div className="lg:hidden">
        <AnimatePresence mode="wait">
          {isCollapsed ? (
            <motion.button
              key="collapsed"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={() => setIsCollapsed(false)}
              className="flex items-center gap-2 p-3 w-full"
            >
              <div className="relative">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  "bg-destructive/20 dark:bg-destructive/40"
                )}>
                  <Lock className="w-5 h-5 text-destructive dark:text-red-400" />
                </div>
                <motion.div
                  className="absolute inset-0 rounded-full bg-destructive/30 dark:bg-destructive/50"
                  animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
              <span className="text-lg font-bold font-mono text-destructive dark:text-red-300">
                {formattedTime}
              </span>
              <ChevronDown className="w-4 h-4 text-destructive/60 dark:text-red-400/60 ml-auto" />
            </motion.button>
          ) : (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="p-4"
            >
              <div className="flex items-center gap-3">
                {/* Lock Icon with pulse animation */}
                <div className="relative">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center",
                    "bg-destructive/20 dark:bg-destructive/40"
                  )}>
                    <Lock className="w-6 h-6 text-destructive dark:text-red-400" />
                  </div>
                  <motion.div
                    className="absolute inset-0 rounded-full bg-destructive/30 dark:bg-destructive/50"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>

                {/* Timer Info */}
                <div className="flex flex-col flex-1">
                  <span className="text-xs font-semibold text-destructive/80 dark:text-red-300">
                    พักสักครู่นะ
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-destructive dark:text-red-400" />
                    <span className="text-xl font-bold font-mono text-destructive dark:text-red-300">
                      {formattedTime}
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-destructive/70 dark:text-red-400/80">
                    รอ {remainingMinutes} นาที ก่อนสร้างใหม่
                  </span>
                </div>

                {/* Collapse Button */}
                <button
                  onClick={() => setIsCollapsed(true)}
                  className={cn(
                    "p-2 rounded-full transition-colors",
                    "bg-destructive/10 hover:bg-destructive/20",
                    "dark:bg-destructive/20 dark:hover:bg-destructive/30"
                  )}
                  aria-label="ย่อกล่อง"
                >
                  <ChevronUp className="w-4 h-4 text-destructive dark:text-red-400" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Desktop View - Always expanded */}
      <div className="hidden lg:block p-5">
        <div className="flex items-center gap-3">
          {/* Lock Icon with pulse animation */}
          <div className="relative">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center",
              "bg-destructive/20 dark:bg-destructive/40"
            )}>
              <Lock className="w-6 h-6 text-destructive dark:text-red-400" />
            </div>
            <motion.div
              className="absolute inset-0 rounded-full bg-destructive/30 dark:bg-destructive/50"
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

          {/* Timer Info */}
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-destructive/80 dark:text-red-300">
              พักสักครู่นะ
            </span>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-destructive dark:text-red-400" />
              <span className="text-2xl font-bold font-mono text-destructive dark:text-red-300">
                {formattedTime}
              </span>
            </div>
            <span className="text-[10px] font-medium text-destructive/70 dark:text-red-400/80">
              รอ {remainingMinutes} นาที ก่อนสร้างใหม่
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
