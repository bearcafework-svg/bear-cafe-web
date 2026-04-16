import React from 'react';
import { cn } from '@/lib/utils';

interface IconDisplayProps {
  icon: string | null | undefined;
  fallback?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  xs: 'w-4 h-4 text-sm',
  sm: 'w-6 h-6 text-lg',
  md: 'w-8 h-8 text-xl',
  lg: 'w-10 h-10 text-2xl',
  xl: 'w-12 h-12 text-3xl',
};

export function IconDisplay({
  icon,
  fallback = '📁',
  size = 'md',
  className,
}: IconDisplayProps) {
  const isImageUrl = icon?.startsWith('http') || icon?.startsWith('blob:');
  const displayValue = icon || fallback;

  if (isImageUrl) {
    return (
      <img
        src={displayValue}
        alt="Icon"
        className={cn(
          'object-cover rounded',
          sizeClasses[size],
          className
        )}
      />
    );
  }

  return (
    <span className={cn(sizeClasses[size], 'flex items-center justify-center', className)}>
      {displayValue}
    </span>
  );
}
