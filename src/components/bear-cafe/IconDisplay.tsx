import React from 'react';
import { cn } from '@/lib/utils';
import { Folder, Award, Shield } from 'lucide-react';

interface IconDisplayProps {
  icon: string | null | undefined;
  fallback?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  xs: 'w-4 h-4',
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
  xl: 'w-12 h-12',
};

const textSizes = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
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
          'object-contain rounded bg-transparent shrink-0',
          sizeClasses[size],
          className
        )}
      />
    );
  }

  // If display value is a known emoji, map it to a Lucide icon
  const isFolder = displayValue === '📁';
  const isDrama = displayValue === '🎭';
  const isAnyEmoji = /[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/.test(displayValue);

  if (isFolder) {
    return <Folder className={cn('text-primary/70 shrink-0', sizeClasses[size], className)} />;
  }
  if (isDrama) {
    return <Award className={cn('text-primary/70 shrink-0', sizeClasses[size], className)} />;
  }
  if (isAnyEmoji) {
    // Prevent rendering unicode emojis from Discord roles or fallbacks by returning a Shield icon
    return <Shield className={cn('text-muted-foreground/60 shrink-0', sizeClasses[size], className)} />;
  }

  return (
    <span className={cn(textSizes[size], 'flex items-center justify-center shrink-0 font-medium', className)}>
      {displayValue}
    </span>
  );
}
