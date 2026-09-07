"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TaskStepItem {
  id: string;
  label: string;
  meta?: string;
  description?: string;
}

export interface TaskStepsProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * List of steps in sequence
   */
  steps: TaskStepItem[];
  /**
   * Current active step index (0-indexed). If current >= steps.length, all steps are finished.
   */
  current: number;
  /**
   * Optional header label (e.g. "Deploy progress")
   */
  label?: string;
  /**
   * Layout style
   * @default 'horizontal'
   */
  orientation?: "horizontal" | "vertical";
}

export const TaskSteps = React.forwardRef<HTMLDivElement, TaskStepsProps>(
  ({ steps, current, label, orientation = "horizontal", className, ...props }, ref) => {
    const isAllDone = current >= steps.length;

    return (
      <div
        ref={ref}
        className={cn(
          "w-full rounded-2xl border border-[#EAD8C8] dark:border-[#2D2520] bg-white/70 dark:bg-[#1E1B18]/70 backdrop-blur-xs p-3.5 shadow-xs",
          className
        )}
        {...props}
      >
        {label && (
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#EAD8C8]/60 dark:border-[#2D2520] text-xs">
            <span className="font-bold text-[#6B5A4B] dark:text-[#EAD8C8]">{label}</span>
            <span className="text-[11px] font-medium text-muted-foreground">
              {isAllDone
                ? "เสร็จสมบูรณ์ 100%"
                : `ขั้นตอนที่ ${Math.min(current + 1, steps.length)} จาก ${steps.length}`}
            </span>
          </div>
        )}

        {orientation === "horizontal" ? (
          <div className="relative flex items-center justify-between gap-2">
            {/* Connecting background track */}
            <div className="absolute top-4 left-6 right-6 -translate-y-1/2 h-0.5 bg-[#EAD8C8]/60 dark:bg-[#2D2520] z-0" />

            {/* Connecting active progress line */}
            <motion.div
              className="absolute top-4 left-6 -translate-y-1/2 h-0.5 bg-gradient-to-r from-emerald-500 to-amber-500 z-0 origin-left"
              initial={{ scaleX: 0 }}
              animate={{
                scaleX: steps.length > 1 ? Math.min(1, current / (steps.length - 1)) : 0,
              }}
              style={{
                width: steps.length > 1 ? "calc(100% - 3rem)" : "0%",
              }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
            />

            {steps.map((step, idx) => {
              const isCompleted = idx < current;
              const isCurrent = idx === current;
              const isPending = idx > current;

              return (
                <div
                  key={step.id}
                  className="relative z-10 flex flex-col items-center flex-1 text-center group"
                >
                  {/* Step Icon / Dot */}
                  <motion.div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 shadow-xs",
                      isCompleted &&
                        "bg-emerald-500 text-white shadow-emerald-500/25 ring-4 ring-emerald-500/15",
                      isCurrent &&
                        "bg-amber-500 text-white shadow-amber-500/30 ring-4 ring-amber-500/20",
                      isPending &&
                        "bg-[#FAF6F0] dark:bg-[#25201C] text-muted-foreground border border-[#EAD8C8] dark:border-[#3D332A]"
                    )}
                    animate={{
                      scale: isCurrent ? 1.1 : 1,
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4 stroke-[3]" />
                    ) : isCurrent ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <span className="text-[11px] font-mono">{idx + 1}</span>
                    )}
                  </motion.div>

                  {/* Step Label */}
                  <div className="mt-2 space-y-0.5 max-w-[100px]">
                    <p
                      className={cn(
                        "text-[11px] font-semibold leading-tight line-clamp-1 transition-colors",
                        isCompleted && "text-emerald-700 dark:text-emerald-400",
                        isCurrent && "text-[#8C6239] dark:text-[#EAD8C8] font-bold",
                        isPending && "text-muted-foreground/70"
                      )}
                      title={step.label}
                    >
                      {step.label}
                    </p>

                    {step.meta && (
                      <span
                        className={cn(
                          "inline-block text-[10px] px-1.5 py-0.2 rounded font-mono",
                          isCompleted
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : isCurrent
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold"
                            : "bg-muted/50 text-muted-foreground"
                        )}
                      >
                        {step.meta}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Vertical Orientation */
          <div className="space-y-4">
            {steps.map((step, idx) => {
              const isCompleted = idx < current;
              const isCurrent = idx === current;
              const isPending = idx > current;
              const isLast = idx === steps.length - 1;

              return (
                <div key={step.id} className="relative flex items-start gap-3">
                  {/* Vertical connector line */}
                  {!isLast && (
                    <div
                      className={cn(
                        "absolute left-4 top-8 -bottom-4 w-0.5 -translate-x-1/2 transition-colors",
                        isCompleted
                          ? "bg-emerald-500"
                          : "bg-[#EAD8C8]/60 dark:bg-[#2D2520]"
                      )}
                    />
                  )}

                  <div
                    className={cn(
                      "w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold transition-all shadow-xs z-10",
                      isCompleted &&
                        "bg-emerald-500 text-white shadow-emerald-500/25 ring-3 ring-emerald-500/15",
                      isCurrent &&
                        "bg-amber-500 text-white shadow-amber-500/30 ring-3 ring-amber-500/20",
                      isPending &&
                        "bg-[#FAF6F0] dark:bg-[#25201C] text-muted-foreground border border-[#EAD8C8] dark:border-[#3D332A]"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4 stroke-[3]" />
                    ) : isCurrent ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <span className="text-[11px] font-mono">{idx + 1}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={cn(
                          "text-xs font-bold",
                          isCompleted && "text-emerald-700 dark:text-emerald-400",
                          isCurrent && "text-[#8C6239] dark:text-[#EAD8C8]",
                          isPending && "text-muted-foreground"
                        )}
                      >
                        {step.label}
                      </p>
                      {step.meta && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground">
                          {step.meta}
                        </span>
                      )}
                    </div>
                    {step.description && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{step.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
);

TaskSteps.displayName = "TaskSteps";

export default TaskSteps;
