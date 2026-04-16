import React from 'react';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

interface SessionTimerProps {
  duration: number;
  isSelected?: boolean;
  onClick?: () => void;
}

const durationLabels: Record<number, string> = {
  30: '30 นาที',
  45: '45 นาที',
  60: '1 ชั่วโมง',
};

export function SessionTimer({ duration, isSelected, onClick }: SessionTimerProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-6 py-3 rounded-xl',
        'border-2 transition-all duration-200',
        'font-medium',
        isSelected
          ? 'bg-primary text-primary-foreground border-primary shadow-bear'
          : 'bg-card text-card-foreground border-border hover:border-primary/50'
      )}
    >
      <Clock className="w-4 h-4" />
      <span>{durationLabels[duration] || `${duration} นาที`}</span>
    </button>
  );
}
