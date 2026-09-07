import * as React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RichSelectItem {
  id: string;
  label: string;
  value: string;
  description?: string;
  icon?: React.ReactNode | string;
  badge?: string;
  badgeColor?: string;
  custom?: React.ReactNode;
}

export interface RichSelectProps {
  data: RichSelectItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  align?: 'start' | 'center' | 'end';
}

export function RichSelect({
  data = [],
  value,
  defaultValue,
  onValueChange,
  placeholder = 'เลือกรายการ...',
  label,
  disabled = false,
  className,
  triggerClassName,
  contentClassName,
  align = 'start',
}: RichSelectProps) {
  const safeData = React.useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const [open, setOpen] = React.useState(false);
  const [internalValue, setInternalValue] = React.useState<string>(defaultValue ?? '');

  const currentValue = value !== undefined ? value : internalValue;
  const selectedItem = React.useMemo(
    () => safeData.find((item) => item.value === currentValue),
    [safeData, currentValue]
  );

  const handleSelect = (itemValue: string) => {
    if (disabled) return;
    if (value === undefined) {
      setInternalValue(itemValue);
    }
    onValueChange?.(itemValue);
    setOpen(false);
  };

  return (
    <div className={cn('w-full space-y-1.5', className)}>
      {label && (
        <label className="text-xs font-semibold text-foreground">{label}</label>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild disabled={disabled}>
          <button
            type="button"
            className={cn(
              'flex h-10 w-full items-center justify-between rounded-xl border px-3 text-xs transition-all duration-200',
              'border-border/60 bg-card text-foreground hover:border-amber-500/50 hover:bg-muted/30 focus:outline-hidden',
              open && 'border-amber-500 ring-2 ring-amber-500/20',
              disabled && 'opacity-50 cursor-not-allowed',
              triggerClassName
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              {selectedItem?.icon && (
                <span className="text-base shrink-0 flex items-center justify-center">
                  {selectedItem.icon}
                </span>
              )}
              <span className={cn('truncate font-medium', !selectedItem && 'text-muted-foreground')}>
                {selectedItem ? selectedItem.label : placeholder}
              </span>
              {selectedItem?.badge && (
                <span
                  className={cn(
                    'rounded-md px-1.5 py-0.5 text-[10px] font-medium shrink-0 border',
                    selectedItem.badgeColor || 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                  )}
                >
                  {selectedItem.badge}
                </span>
              )}
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                open && 'rotate-180 text-foreground'
              )}
            />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align={align}
          onWheelCapture={(e) => e.stopPropagation()}
          className={cn(
            'w-[calc(100vw-2.5rem)] sm:w-[420px] max-w-[95vw] p-2 rounded-2xl border border-border/70 bg-card/95 backdrop-blur-md shadow-2xl space-y-1 z-[60]',
            contentClassName
          )}
        >
          <div
            onWheel={(e) => {
              e.stopPropagation();
              e.currentTarget.scrollTop += e.deltaY;
            }}
            className="max-h-[290px] sm:max-h-[310px] overflow-y-auto space-y-1 overscroll-contain scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {safeData.map((item) => {
              const isSelected = item.value === currentValue;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item.value)}
                  className={cn(
                    'group relative flex cursor-pointer items-center justify-between gap-3 rounded-xl p-2.5 transition-all duration-150',
                    'border border-transparent hover:border-amber-500/40 hover:bg-amber-500/[0.06]',
                    isSelected && 'border-amber-500/50 bg-amber-500/[0.08]'
                  )}
                >
                  {/* Left: Icon & Details */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-muted/40 text-base shadow-2xs transition-transform group-hover:scale-105">
                      {item.icon || '☕'}
                    </div>
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className={cn(
                            'text-xs font-semibold leading-tight',
                            isSelected
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-foreground'
                          )}
                        >
                          {item.label}
                        </p>
                        {item.badge && (
                          <span
                            className={cn(
                              'rounded-md px-1.5 py-0.5 text-[10px] font-medium border',
                              item.badgeColor || 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-[11px] text-muted-foreground leading-normal line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Custom element or Radio Checkmark */}
                  <div className="shrink-0 pl-1">
                    {item.custom ? (
                      item.custom
                    ) : (
                      <div
                        className={cn(
                          'flex h-4 w-4 items-center justify-center rounded-full border transition-all',
                          isSelected
                            ? 'border-amber-500 bg-amber-500 text-stone-950 shadow-xs'
                            : 'border-muted-foreground/40 bg-transparent group-hover:border-amber-500/60'
                        )}
                      >
                        {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
