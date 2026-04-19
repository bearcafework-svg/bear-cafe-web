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
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center select-none', className)}>
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-muted/40 flex items-center justify-center mb-5 ring-1 ring-border/30">
          <Icon className="w-7 h-7 text-muted-foreground/40" strokeWidth={1.5} />
        </div>
      )}
      <p className="text-sm font-medium text-foreground/60 leading-snug">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground/50 mt-1.5 max-w-[220px] leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
