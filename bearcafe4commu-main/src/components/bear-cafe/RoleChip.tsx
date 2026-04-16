import React from 'react';
import { cn } from '@/lib/utils';
import { IconDisplay } from './IconDisplay';

interface RoleChipProps {
  emoji?: string;
  name: string;
  description?: string | null;
  isSelected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

export function RoleChip({
  emoji,
  name,
  description,
  isSelected = false,
  onClick,
  disabled = false,
}: RoleChipProps) {
  const trimmedDescription = description?.trim();

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative w-full rounded-2xl border-2 transition-all duration-200',
        'flex flex-col items-center gap-3 px-4 py-4 text-center',
        trimmedDescription && 'min-h-[160px]',
        isSelected
          ? 'bg-primary/10 border-primary shadow-bear text-foreground'
          : 'bg-card text-card-foreground border-border hover:border-primary/50 hover:bg-secondary/60',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-full w-16 h-16 border',
          isSelected ? 'bg-primary/15 border-primary/30' : 'bg-muted border-transparent',
        )}
      >
        <IconDisplay icon={emoji} fallback="🎭" size="xl" />
      </div>
      <div className="space-y-1">
        <span className="text-sm font-semibold text-foreground">{name}</span>
        {trimmedDescription && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {trimmedDescription}
          </p>
        )}
      </div>
    </button>
  );
}
