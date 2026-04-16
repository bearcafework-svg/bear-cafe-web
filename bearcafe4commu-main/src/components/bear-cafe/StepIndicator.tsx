import React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface Step {
  id: number;
  label: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, index) => {
        const isCompleted = step.id < currentStep;
        const isCurrent = step.id === currentStep;
        const isLast = index === steps.length - 1;

        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center',
                  'font-semibold text-sm transition-all duration-300',
                  isCompleted && 'bg-success text-success-foreground',
                  isCurrent && 'bg-primary text-primary-foreground shadow-bear scale-110',
                  !isCompleted && !isCurrent && 'bg-muted text-muted-foreground'
                )}
              >
                {isCompleted ? <Check className="w-5 h-5" /> : step.id}
              </div>
              <span
                className={cn(
                  'text-xs font-medium hidden sm:block',
                  isCurrent ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={cn(
                  'w-8 md:w-16 h-1 rounded-full mb-6 sm:mb-0',
                  isCompleted ? 'bg-success' : 'bg-muted'
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
