import { cn } from '@/lib/utils';

interface AdminSkeletonCardsProps {
  count?: number;
  className?: string;
}

/** Grid of skeleton cards matching .admin-card layout */
export function AdminSkeletonCards({ count = 6, className }: AdminSkeletonCardsProps) {
  return (
    <div
      className={cn('grid gap-4', className)}
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border/40 bg-card p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="admin-skeleton w-8 h-8 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <div className="admin-skeleton h-3.5 w-3/4 rounded" />
              <div className="admin-skeleton h-2.5 w-1/2 rounded" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="admin-skeleton h-2.5 w-full rounded" />
            <div className="admin-skeleton h-2.5 w-5/6 rounded" />
          </div>
          <div className="flex gap-2 pt-1">
            <div className="admin-skeleton h-7 w-16 rounded-lg" />
            <div className="admin-skeleton h-7 w-16 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Single-row table skeleton */
export function AdminSkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-2 py-2.5 rounded-lg">
          <div className="admin-skeleton w-8 h-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="admin-skeleton h-3 w-1/3 rounded" />
            <div className="admin-skeleton h-2.5 w-1/4 rounded" />
          </div>
          <div className="admin-skeleton h-6 w-16 rounded-lg shrink-0" />
        </div>
      ))}
    </div>
  );
}
