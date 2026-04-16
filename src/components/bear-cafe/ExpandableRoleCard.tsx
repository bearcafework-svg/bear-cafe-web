import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { IconDisplay } from './IconDisplay';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ExpandableRoleCardProps {
  emoji?: string | null;
  name: string;
  description?: string | null;
  isSelected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

export function ExpandableRoleCard({
  emoji,
  name,
  description,
  isSelected = false,
  onClick,
  disabled = false,
}: ExpandableRoleCardProps) {
  const trimmedDescription = description?.trim();
  const hasDescription = Boolean(trimmedDescription);
  
  // Only expand if selected AND has description
  const isExpanded = isSelected && hasDescription;

  const handleClick = () => {
    if (!disabled && onClick) {
      onClick();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      aria-expanded={isExpanded}
      aria-pressed={isSelected}
      layout
      initial={false}
      transition={{
        layout: { duration: 0.25, ease: 'easeOut' },
      }}
      className={cn(
        'relative w-full rounded-2xl border-2 transition-colors duration-200',
        'flex flex-col items-center text-center outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        // Padding adjustments
        isExpanded ? 'px-4 py-4' : 'px-3 py-3 sm:px-4 sm:py-4',
        // Selection states
        isSelected
          ? 'bg-primary/10 border-primary shadow-bear text-foreground'
          : 'bg-card text-card-foreground border-border hover:border-primary/50 hover:bg-secondary/60',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      {/* Icon */}
      <motion.div
        layout="position"
        className={cn(
          'flex items-center justify-center rounded-full border mb-2',
          isSelected ? 'bg-primary/15 border-primary/30' : 'bg-muted border-transparent',
          isExpanded ? 'w-14 h-14 sm:w-16 sm:h-16' : 'w-12 h-12 sm:w-14 sm:h-14',
        )}
      >
        <IconDisplay 
          icon={emoji} 
          fallback="🎭" 
          size={isExpanded ? 'xl' : 'lg'} 
        />
      </motion.div>

      {/* Name */}
      <motion.span
        layout="position"
        className={cn(
          'font-semibold text-foreground leading-tight',
          isExpanded ? 'text-sm sm:text-base' : 'text-xs sm:text-sm',
        )}
      >
        {name}
      </motion.span>

      {/* Description Preview (collapsed state) - only if has description and NOT expanded */}
      <AnimatePresence mode="wait">
        {hasDescription && !isExpanded && (
          <motion.p
            key="preview"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="text-xs text-muted-foreground line-clamp-1 mt-1 px-1"
          >
            {trimmedDescription}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Full Description (expanded state) */}
      <AnimatePresence mode="wait">
        {isExpanded && (
          <motion.div
            key="full"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="w-full mt-3"
          >
            <div className="w-full h-px bg-border mb-3" />
            <ScrollArea className="max-h-32 w-full">
              <p className="text-xs sm:text-sm text-muted-foreground text-left leading-relaxed px-1">
                {trimmedDescription}
              </p>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected indicator */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
        >
          <svg
            className="w-3 h-3 text-primary-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </motion.div>
      )}
    </motion.button>
  );
}
