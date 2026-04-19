import { cn } from '@/lib/utils';

interface AdminCardGridProps {
  children: React.ReactNode;
  className?: string;
  /** min card width in px, default 260 */
  minWidth?: number;
}

/**
 * Consistent auto-fill grid for admin card lists.
 * Usage: wrap card items with <AdminCardGrid>
 */
export function AdminCardGrid({ children, className, minWidth = 260 }: AdminCardGridProps) {
  return (
    <div
      className={cn('grid gap-4', className)}
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))` }}
    >
      {children}
    </div>
  );
}
