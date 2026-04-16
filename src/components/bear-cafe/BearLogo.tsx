import React, { forwardRef } from 'react';
import bearCafeLogo from '@/assets/bear-cafe-logo.png';

interface BearLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  noFloat?: boolean;
}

const sizeClasses = {
  sm: 'w-12 h-12',
  md: 'w-20 h-20',
  lg: 'w-32 h-32',
  xl: 'w-48 h-48',
  '2xl': 'w-56 h-56 sm:w-64 sm:h-64',
};

export const BearLogo = forwardRef<HTMLDivElement, BearLogoProps>(
  ({ size = 'md', className = '', noFloat = false }, ref) => {
    return (
      <div ref={ref} className={`${noFloat ? '' : 'bear-float'} select-none flex items-center justify-center ${className}`}>
        <img 
          src={bearCafeLogo} 
          alt="Bear Café Logo" 
          className={`${sizeClasses[size]} object-contain`}
        />
      </div>
    );
  }
);

BearLogo.displayName = 'BearLogo';

export function BearLogoText({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <BearLogo size="sm" />
      <div className="flex flex-col">
        <span className="font-display font-bold text-2xl text-gradient-bear">
          Bear Café
        </span>
        <span className="text-xs text-muted-foreground">
          Discord Community Companion
        </span>
      </div>
    </div>
  );
}
