import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Tag, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TagItem {
  id: string;
  label: string;
  icon?: React.ReactNode | string;
}

export interface TagsSelectorProps {
  tags: TagItem[];
  selectedTags?: string[] | string;
  defaultSelectedTags?: string[] | string;
  value?: string[] | string;
  defaultValue?: string[] | string;
  onTagsChange?: (selectedIds: string[]) => void;
  onChange?: (selectedIds: string[]) => void;
  onValueChange?: (selected: string[] | string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  maxSelected?: number;
  disabled?: boolean;
}

export function TagsSelector({
  tags,
  selectedTags: controlledSelected,
  defaultSelectedTags = [],
  value,
  defaultValue,
  onTagsChange,
  onChange,
  onValueChange,
  label = 'TAGS',
  placeholder = 'คลิกเลือกแท็กจากด้านล่าง...',
  className,
  maxSelected,
  keepLatestOnly = false,
  disabled = false,
}: TagsSelectorProps) {
  const isSingleMode = keepLatestOnly || maxSelected === 1;

  // Normalize controlled/uncontrolled initial values (take latest 1 if isSingleMode)
  const normalizeArray = (val?: string[] | string): string[] => {
    if (!val) return [];
    const arr = Array.isArray(val) ? val : [val];
    return isSingleMode && arr.length > 1 ? arr.slice(-1) : arr;
  };

  const initialVal = normalizeArray(defaultValue ?? defaultSelectedTags);
  const [internalSelected, setInternalSelected] = useState<string[]>(initialVal);

  const effectiveControlled = value !== undefined ? value : controlledSelected;
  const isControlled = effectiveControlled !== undefined;
  const currentSelected = isControlled ? normalizeArray(effectiveControlled) : internalSelected;

  const updateSelected = (newSelected: string[]) => {
    const finalSelected = isSingleMode && newSelected.length > 1 ? newSelected.slice(-1) : newSelected;
    if (!isControlled) {
      setInternalSelected(finalSelected);
    }
    onTagsChange?.(finalSelected);
    onChange?.(finalSelected);
    if (isSingleMode) {
      onValueChange?.(finalSelected[0] || '');
    } else {
      onValueChange?.(finalSelected);
    }
  };

  const handleSelect = (tagId: string) => {
    if (disabled) return;
    if (isSingleMode) {
      // Auto-replace with the latest selected tag
      updateSelected([tagId]);
      return;
    }
    if (maxSelected && currentSelected.length >= maxSelected && !currentSelected.includes(tagId)) {
      return;
    }
    if (!currentSelected.includes(tagId)) {
      updateSelected([...currentSelected, tagId]);
    }
  };

  const handleRemove = (tagId: string) => {
    if (disabled) return;
    updateSelected(currentSelected.filter((id) => id !== tagId));
  };

  // Find objects for selected and unselected
  const selectedObjects = currentSelected
    .map((id) => tags.find((t) => t.id === id))
    .filter((t): t is TagItem => Boolean(t));

  const unselectedObjects = tags.filter((t) => !currentSelected.includes(t.id));

  return (
    <div className={cn('w-full space-y-2.5 font-sans', className)}>
      {label && (
        <div className="flex items-center justify-between px-1">
          <label className="text-xs font-extrabold tracking-wider uppercase text-foreground/80 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-amber-500" />
            <span>{label}</span>
          </label>
          {isSingleMode ? (
            <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/15 border border-amber-500/20 px-2 py-0.5 rounded-full">
              แท็กล่าสุด
            </span>
          ) : maxSelected ? (
            <span className="text-[11px] font-semibold text-muted-foreground">
              {currentSelected.length} / {maxSelected}
            </span>
          ) : null}
        </div>
      )}

      {/* ── Box 1: Selected Tags ── */}
      <div
        className={cn(
          'w-full rounded-2xl border-2 p-2.5 min-h-[56px] flex flex-wrap items-center gap-2 transition-all duration-200',
          'bg-white/90 dark:bg-[#181412] border-[#EFE7DC] dark:border-[#2C221D] shadow-xs',
          'focus-within:border-amber-500/60 focus-within:ring-2 focus-within:ring-amber-500/10',
          disabled && 'opacity-60 cursor-not-allowed'
        )}
      >
        <AnimatePresence mode="popLayout">
          {selectedObjects.length === 0 ? (
            <motion.p
              key="empty-placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-muted-foreground/60 select-none px-2 italic flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500/50" />
              {placeholder}
            </motion.p>
          ) : (
            selectedObjects.map((tag) => (
              <motion.button
                key={tag.id}
                layout
                layoutId={`tag-pill-${tag.id}`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                type="button"
                onClick={() => handleRemove(tag.id)}
                disabled={disabled}
                className={cn(
                  'group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer select-none',
                  'bg-white dark:bg-[#241E1A] text-foreground border border-[#E5DACD] dark:border-[#3E3028]',
                  'shadow-xs hover:border-rose-300 dark:hover:border-rose-900/60 hover:bg-rose-50/50 dark:hover:bg-rose-950/30',
                  'transition-colors duration-150 active:scale-95'
                )}
                title={`คลิกเพื่อลบ ${tag.label}`}
              >
                {tag.icon && (
                  <span className="text-xs shrink-0 flex items-center">
                    {tag.icon}
                  </span>
                )}
                <span>{tag.label}</span>
                {isSingleMode && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    ล่าสุด
                  </span>
                )}
                <X className="w-3.5 h-3.5 text-muted-foreground group-hover:text-rose-500 transition-colors" />
              </motion.button>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* ── Box 2: Available Tags Pool ── */}
      <div
        className={cn(
          'w-full rounded-2xl border p-3 flex flex-wrap gap-2 transition-all duration-200',
          'bg-[#FAF6F0]/70 dark:bg-[#14100E]/70 border-[#F0E8DC] dark:border-[#281F19]'
        )}
      >
        <AnimatePresence mode="popLayout">
          {unselectedObjects.length === 0 ? (
            <motion.div
              key="all-selected"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full py-1 text-center text-xs text-muted-foreground font-medium flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span>เลือกครบทุกตัวเลือกแล้ว</span>
            </motion.div>
          ) : (
            unselectedObjects.map((tag) => (
              <motion.button
                key={tag.id}
                layout
                layoutId={`tag-pill-${tag.id}`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                type="button"
                onClick={() => handleSelect(tag.id)}
                disabled={disabled}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer select-none',
                  'bg-[#F0EAE1]/80 dark:bg-[#1E1815] text-[#5C4D40] dark:text-[#C5B4A5]',
                  'hover:bg-amber-500/15 hover:text-amber-700 dark:hover:text-amber-300 hover:border-amber-500/30',
                  'border border-transparent transition-all duration-150 active:scale-95'
                )}
                title={`คลิกเพื่อเลือก ${tag.label}`}
              >
                {tag.icon && (
                  <span className="text-xs shrink-0 flex items-center">
                    {tag.icon}
                  </span>
                )}
                <span>{tag.label}</span>
              </motion.button>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export const TAGS: TagItem[] = [
  { id: 'docker', label: 'Docker' },
  { id: 'kubernetes', label: 'Kubernetes' },
  { id: 'aws', label: 'AWS' },
  { id: 'graphql', label: 'GraphQL' },
  { id: 'mongodb', label: 'MongoDB' },
  { id: 'postgresql', label: 'PostgreSQL' },
  { id: 'redis', label: 'Redis' },
  { id: 'git', label: 'Git' },
];

export const TagsSelectorDemo = () => (
  <div style={{ padding: '20px', maxWidth: '600px', width: '100%' }}>
    <TagsSelector tags={TAGS} />
  </div>
);

export default TagsSelector;
