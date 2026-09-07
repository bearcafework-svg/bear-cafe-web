"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface ProgressIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Current progress value from 0 to 100
   * @default 68
   */
  value?: number;
  /**
   * Optional custom label displayed above or next to progress
   */
  label?: string;
  /**
   * Whether to show the percentage badge/label
   * @default false
   */
  showLabel?: boolean;
  /**
   * Size variant
   * @default 'md'
   */
  size?: "sm" | "md" | "lg";
  /**
   * Color theme variant
   * @default 'default'
   */
  variant?: "default" | "amber" | "emerald" | "rose" | "indigo";
  /**
   * Whether to display active animated shimmer sweep
   * @default true
   */
  animated?: boolean;
  /**
   * Custom CSS class for the filled bar element
   */
  barClassName?: string;
}

const sizeClasses = {
  sm: "h-1.5",
  md: "h-2.5",
  lg: "h-4",
};

const variantGradients = {
  default: "bg-gradient-to-r from-amber-500 via-primary to-amber-600 shadow-amber-500/20",
  amber: "bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 shadow-amber-500/20",
  emerald: "bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-600 shadow-emerald-500/20",
  rose: "bg-gradient-to-r from-rose-500 via-pink-500 to-red-600 shadow-rose-500/20",
  indigo: "bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500 shadow-indigo-500/20",
};

export const ProgressIndicator = React.forwardRef<HTMLDivElement, ProgressIndicatorProps>(
  (
    {
      className,
      barClassName,
      value = 68,
      label,
      showLabel = false,
      size = "md",
      variant = "default",
      animated = true,
      ...props
    },
    ref
  ) => {
    const clampedValue = Math.min(100, Math.max(0, Math.round(value)));

    return (
      <div ref={ref} className={cn("w-full space-y-1.5", className)} {...props}>
        {(label || showLabel) && (
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            {label && <span>{label}</span>}
            {showLabel && <span className="font-mono text-[11px] tabular-nums">{clampedValue}%</span>}
          </div>
        )}

        <div
          role="progressbar"
          aria-valuenow={clampedValue}
          aria-valuemin={0}
          aria-valuemax={100}
          className={cn(
            "relative w-full overflow-hidden rounded-full bg-[#EAD8C8]/40 dark:bg-[#2D2520]/80 border border-[#EAD8C8]/60 dark:border-[#3D332A]",
            sizeClasses[size]
          )}
        >
          {/* Animated fill track */}
          <motion.div
            className={cn(
              "relative h-full rounded-full shadow-xs transition-colors",
              variantGradients[variant],
              barClassName
            )}
            initial={{ width: 0 }}
            animate={{ width: `${clampedValue}%` }}
            transition={{ type: "spring", stiffness: 90, damping: 20 }}
          >
            {/* Shimmer sweep glow */}
            {animated && clampedValue > 0 && clampedValue < 100 && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                initial={{ x: "-100%" }}
                animate={{ x: "200%" }}
                transition={{
                  repeat: Infinity,
                  duration: 1.8,
                  ease: "easeInOut",
                }}
              />
            )}
          </motion.div>
        </div>
      </div>
    );
  }
);

ProgressIndicator.displayName = "ProgressIndicator";

export default ProgressIndicator;
