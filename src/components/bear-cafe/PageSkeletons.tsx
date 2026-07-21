import { cn } from '@/lib/utils';
import { SkeletonBlock, SKELETON_CARD_SURFACE } from '@/components/bear-cafe/SkeletonBlock';

/**
 * Auth-gate loading skeletons for `/gacha` and `/points` — content section only.
 * Rendered by the AppRoutes gate inside CozyAppShell while `useAuth().isLoading`
 * is true, so the real sidebar (no skeleton) stays visible next to them.
 * Geometry class strings are copied from the live pages (source-referenced
 * below) so the loaded page swaps in without layout shift.
 */

/** Mirrors PageBackHeader.tsx:14 (back button + title + subtitle). */
function PageBackHeaderSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <SkeletonBlock className="h-9 w-9 shrink-0 rounded-full" />
      <div className="space-y-2">
        <SkeletonBlock className="h-7 w-36 rounded-full" />
        <SkeletonBlock className="h-4 w-56 rounded-full" />
      </div>
    </div>
  );
}

export function GachaPageSkeleton(): JSX.Element {
  return (
    <div role="status" aria-busy="true" aria-label="กำลังโหลดหน้ากาชา">
      <span className="sr-only">กำลังโหลดหน้ากาชา</span>
      {/* Main-column classes copied from src/pages/GachaPage.tsx:12. */}
      <main className="mx-auto min-h-dvh w-full max-w-2xl min-w-0 px-4 py-6 pt-16 sm:px-6 sm:py-8 lg:pt-8 pb-12">
        <div className="mb-8">
          <PageBackHeaderSkeleton />
        </div>

        {/* Frame classes copied from GachaPage.tsx:29 (coming-soon card). */}
        <div
          className={cn(
            'flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-3xl px-6 py-16',
            SKELETON_CARD_SURFACE,
          )}
        >
          <SkeletonBlock className="h-14 w-14 rounded-full" />
          <SkeletonBlock className="h-7 w-24 rounded-full" />
          <SkeletonBlock className="h-5 w-full max-w-sm rounded-full" />
        </div>
      </main>
    </div>
  );
}

export function PointsPageSkeleton(): JSX.Element {
  return (
    <div role="status" aria-busy="true" aria-label="กำลังโหลดหน้ากรอกโค้ด">
      <span className="sr-only">กำลังโหลดหน้ากรอกโค้ด</span>
      {/* Main-column classes copied from src/pages/PointsPage.tsx:30. */}
      <main className="mx-auto w-full max-w-2xl min-w-0 px-4 py-6 pt-16 sm:px-6 sm:py-8 lg:pt-8 pb-12 space-y-6">
        <PageBackHeaderSkeleton />

        {/* Frame classes copied from PointsPage.tsx:46 (strawberry-jar card). */}
        <div
          className={cn(
            'rounded-2xl px-4 py-5 sm:px-6 sm:py-6',
            SKELETON_CARD_SURFACE,
          )}
        >
          <div className="mb-3 flex items-center gap-2">
            <SkeletonBlock className="h-[18px] w-[18px] shrink-0 rounded-full" />
            <SkeletonBlock className="h-4 w-40 rounded-full" />
          </div>
          <SkeletonBlock className="h-8 w-32 rounded-full" />
          <SkeletonBlock className="mt-4 h-3 w-full rounded-full" />
        </div>

        {/* Frame classes copied from PointsPage.tsx:66 (redeem-code card). */}
        <div className={cn('rounded-3xl p-6 sm:p-7', SKELETON_CARD_SURFACE)}>
          <div className="mb-5 flex items-center gap-3">
            <SkeletonBlock className="h-10 w-10 shrink-0 rounded-xl" />
            <div className="space-y-2">
              <SkeletonBlock className="h-6 w-44 rounded-full" />
              <SkeletonBlock className="h-4 w-60 rounded-full" />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SkeletonBlock className="h-10 flex-1 rounded-xl" />
            <SkeletonBlock className="h-10 w-full sm:w-28 shrink-0 rounded-xl" />
          </div>
        </div>
      </main>
    </div>
  );
}
