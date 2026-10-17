import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminEmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function AdminEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: AdminEmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-14 px-6 text-center select-none', className)}>
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 dark:bg-amber-950/25 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4 ring-1 ring-amber-500/20 shadow-xs">
          <Icon className="w-7 h-7" strokeWidth={1.75} />
        </div>
      )}
      <p className="text-sm font-semibold text-foreground/90 leading-snug">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1.5 max-w-[280px] leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
