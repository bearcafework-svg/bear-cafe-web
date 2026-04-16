import React from 'react';
import { cn } from '@/lib/utils';
import { IconDisplay } from './IconDisplay';

interface CategoryCardProps {
  icon: string;
  name: string;
  description?: string;
  isSelected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

export function CategoryCard({
  icon,
  name,
  description,
  isSelected = false,
  onClick,
  disabled = false,
}: CategoryCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'bear-card-interactive p-4 sm:p-6 text-left w-full',
        'flex flex-col items-center gap-2 sm:gap-3 min-h-[120px] sm:min-h-[140px]',
        isSelected && 'ring-2 ring-primary border-primary bg-primary/5',
        disabled && 'opacity-50 cursor-not-allowed hover:scale-100'
      )}
    >
      <IconDisplay icon={icon} fallback="📁" size="xl" />
      <div className="text-center">
        <h3 className="font-display font-semibold text-sm sm:text-lg leading-tight line-clamp-2">{name}</h3>
        {description && (
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">
            {description}
          </p>
        )}
      </div>
    </button>
  );
}
