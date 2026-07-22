import { cn } from '@/lib/utils';
import { SkeletonBlock, SKELETON_CARD_SURFACE } from '@/components/bear-cafe/SkeletonBlock';
import { CheckInDayCardSkeleton } from '@/components/bear-cafe/CheckInDayCard';

/**
 * Auth-gate loading skeletons for `/gacha`, `/points`, and
 * `/full-checkin-calendar` — content section only.
 * Rendered by CozyGateLayout inside CozyAppShell while `useAuth().isLoading`
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

/**
 * Auth-gate skeleton for `/full-checkin-calendar`.
 * Figma: VTKTZOQlK0iebT3OZmQ9MI node 6075:102596 (dark skeleton anatomy).
 * Live geometry copied from FullCheckInCalendar.tsx so auth → content does not shift.
 */
export function FullCheckInCalendarSkeleton(): JSX.Element {
  const cardFrame = cn(
    // Frame classes copied from FullCheckInCalendar.tsx calendar / side cards.
    // Border color comes from SKELETON_CARD_SURFACE (dark only — matches home gate).
    'rounded-lg p-3 sm:p-4 md:p-6 lg:p-8 min-w-0',
    SKELETON_CARD_SURFACE,
  );

  return (
    <div role="status" aria-busy="true" aria-label="กำลังโหลดปฏิทินเช็กอิน">
      <span className="sr-only">กำลังโหลดปฏิทินเช็กอิน</span>
      {/* Main-column classes copied from FullCheckInCalendar.tsx:101. */}
      <main className="mx-auto flex w-full min-w-0 flex-col gap-5 px-4 py-6 pt-16 sm:gap-8 sm:px-6 sm:py-8 lg:pt-8 lg:gap-10 min-h-svh">
        {/* Back link placeholder — Figma 6075:102677. */}
        <SkeletonBlock className="h-7 w-40 rounded-full sm:h-8 sm:w-52" />

        {/* Grid classes copied from FullCheckInCalendar.tsx:113. */}
        <div className="grid w-full min-w-0 flex-1 grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-[2fr_1fr] lg:gap-6">
          {/* Left calendar card — Figma 6075:102597. */}
          <div className={cn(cardFrame, 'space-y-3 sm:space-y-4')}>
            <SkeletonBlock className="h-10 w-full max-w-[32rem] rounded-[20px] sm:h-[4.5rem]" />
            <SkeletonBlock className="h-4 w-full max-w-md rounded-full md:h-5" />

            <div className="w-full min-w-0 overflow-x-auto sm:overflow-visible -mx-1 px-1 sm:mx-0 sm:px-0">
              {/* Day grid classes copied from FullCheckInCalendar.tsx:126. */}
              <div className="grid w-full min-w-[18.5rem] grid-cols-4 gap-0.5 min-[375px]:gap-1 sm:min-w-0 sm:gap-2 md:grid-cols-7 md:gap-3">
                {Array.from({ length: 28 }).map((_, i) => (
                  <CheckInDayCardSkeleton key={i} />
                ))}
              </div>
            </div>

            <SkeletonBlock className="h-4 w-full max-w-[36rem] rounded-full md:h-6" />
          </div>

          {/* Right column — Figma 6075:102678. */}
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-1">
            {/* Selected-day reward card — Figma 6075:102679. */}
            <div className={cn(cardFrame, 'flex flex-col gap-3 sm:gap-4')}>
              <div className="space-y-2">
                <SkeletonBlock className="h-7 w-44 rounded-[20px] sm:h-[3.25rem] sm:w-48" />
                <SkeletonBlock className="h-4 w-36 rounded-full" />
              </div>
              <SkeletonBlock className="mx-auto h-16 w-full max-w-[16rem] rounded-[20px] sm:h-20" />
              <SkeletonBlock className="mx-auto h-5 w-40 rounded-full sm:h-[22px] sm:w-[10.75rem]" />
              <SkeletonBlock className="mx-auto h-10 w-full max-w-[12.5rem] rounded-full" />
            </div>

            {/* Big-reward card — Figma 6075:102698. */}
            <div
              className={cn(
                cardFrame,
                'flex flex-col gap-3 sm:col-span-2 sm:gap-4 lg:col-span-1',
              )}
            >
              <SkeletonBlock className="h-14 w-full rounded-[20px] sm:h-16" />
              <SkeletonBlock className="h-10 w-full rounded-[20px]" />
            </div>

            {/* Stats card — Figma 6075:102712. */}
            <div
              className={cn(
                cardFrame,
                'flex flex-col gap-2.5 sm:col-span-2 sm:gap-3 lg:col-span-1',
              )}
            >
              <SkeletonBlock className="h-7 w-32 rounded-[20px] sm:h-8 sm:w-36" />
              <SkeletonBlock className="h-8 w-full rounded-full" />
              <SkeletonBlock className="h-8 w-full rounded-full" />
              <SkeletonBlock className="h-8 w-full rounded-full" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
