import { cn } from '@/lib/utils';
import { SkeletonBlock, SKELETON_CARD_SURFACE } from '@/components/bear-cafe/SkeletonBlock';
import { CheckInDayCardSkeleton } from '@/components/bear-cafe/CheckInDayCard';

/**
 * Auth-gate loading skeleton for the home route (`/`) — content section only.
 * Rendered by CozyGateLayout inside CozyAppShell while `useAuth().isLoading`
 * is true, so the real sidebar (no skeleton) stays visible next to it.
 * Design Doc: docs/design/home-loading-skeleton-design.md (§ Main Components — HomePageSkeleton)
 * UI Spec: docs/ui-spec/home-loading-skeleton-ui-spec.md
 *
 * Figma-literal fills (Design Doc Axis B / TBD-02): skeleton surfaces #F2EBE4/#101010
 * and block fill #EADCCC/#1B1B1B are intentionally different from the live cards'
 * #FDFAF7/#0A0A0A. Geometry class strings are copied verbatim from the live page
 * (source-referenced below) to guarantee swap continuity (AC-004).
 */

/**
 * Real banner image + live black gradient + static greeting (UI Spec D-4/D-5:
 * live treatment in both themes, Figma cream gradient not adopted).
 * `bg-muted` is the unconditional fallback if the image fails to load.
 */
function WelcomeBannerSkeleton() {
  return (
    <div
      // Frame + inner-column classes copied from src/pages/Index.tsx:108,114.
      className="relative h-[180px] overflow-hidden rounded-2xl bg-cover bg-center bg-no-repeat sm:h-[220px] sm:rounded-[20px] lg:h-[264px] bg-muted"
      style={{
        backgroundImage:
          "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.4) 100%), url('/banner/welcome_banner.jpg')",
      }}
    >
      <div className="flex h-full flex-col justify-end gap-1.5 px-4 pb-4 sm:justify-center sm:gap-2 sm:px-6 sm:pb-0 lg:px-10">
        <p className="md:bear-h1-bold bear-h2-bold text-white">ยินดีต้อนรับ</p>
        {/* Welcome-message placeholder — single 56×8 bar (TBD-03 resolved vs Figma 6007:115608/115716). */}
        <SkeletonBlock className="w-14 h-2 rounded-full bg-white/25 dark:bg-white/25" />
      </div>
    </div>
  );
}

/** Day-cell placeholder row — shared CheckInDayCardSkeleton. */
function DayCellRow({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <CheckInDayCardSkeleton key={i} />
      ))}
    </>
  );
}

/** Left feature card mirroring DailyCheckInCard's slot (Figma anatomy at xl). */
function CheckInCardSkeleton() {
  return (
    <div
      className={cn(
        // xl height = measured live DailyCheckInCard at 1280px (AC-004: Figma's 352px
        // diverged by 12px > 8px budget, so the measured live value wins).
        'relative w-full min-w-0 rounded-[30px] p-6 flex flex-col gap-5 xl:h-[364px] xl:justify-between',
        SKELETON_CARD_SURFACE,
      )}
    >
      <SkeletonBlock className="absolute -top-3 left-1/2 h-6 w-[230px] -translate-x-1/2 rotate-[1deg] rounded-sm" />
      <div className="flex items-start justify-between gap-3 pt-2">
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBlock className="h-10 w-full max-w-[445px] rounded-full" />
          <SkeletonBlock className="h-5 w-full max-w-[309px] rounded-full" />
        </div>
        <SkeletonBlock className="h-[38px] w-40 shrink-0 rounded-full" />
      </div>
      {/* 4 cells below sm, 7 at sm+ — matches the live card's day rows (UI Spec D-8). */}
      <div className="flex items-stretch gap-2 sm:hidden">
        <DayCellRow count={4} />
      </div>
      <div className="hidden items-stretch gap-2 sm:flex">
        <DayCellRow count={7} />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <SkeletonBlock className="h-7 w-full max-w-[421px] rounded-full" />
          <SkeletonBlock className="h-7 w-[30px] shrink-0 rounded-full" />
        </div>
        <SkeletonBlock className="h-8 w-full rounded-full" />
      </div>
    </div>
  );
}

/** Right feature card mirroring FindFriendsCard's fixed 270px slot at xl. */
function FindFriendsCardSkeleton() {
  return (
    <div
      className={cn(
        // Shares the check-in card's measured xl height (AC-004).
        'relative flex w-full flex-col items-center gap-4 rounded-[30px] p-6 pt-8 xl:w-[270px] xl:h-[364px]',
        SKELETON_CARD_SURFACE,
      )}
    >
      <SkeletonBlock className="absolute -top-3 left-1/2 h-6 w-[230px] -translate-x-1/2 rotate-[-2deg] rounded-sm" />
      <SkeletonBlock className="h-[152px] w-full max-w-[220px] rounded-[20px]" />
      <SkeletonBlock className="h-8 w-[146px] rounded-full" />
      <SkeletonBlock className="h-6 w-[136px] rounded-full" />
      <SkeletonBlock className="h-8 w-[144px] rounded-full" />
    </div>
  );
}

/**
 * Community slot per Figma layout (UI Spec D-7): four fixed 270×193 cards in a
 * clipped row — not the live carousel's internals. No scroll, no wrap.
 */
function CommunitySectionSkeleton() {
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <SkeletonBlock className="h-11 w-full max-w-[373px] rounded-full" />
        <SkeletonBlock className="hidden sm:block h-[38px] w-40 shrink-0 rounded-full" />
      </div>
      <div className="mt-3 flex gap-6 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'flex h-[193px] w-[270px] shrink-0 flex-col gap-4 rounded-[30px] p-5',
              SKELETON_CARD_SURFACE,
            )}
          >
            <div className="flex gap-3">
              <SkeletonBlock className="h-12 w-12 shrink-0 rounded-xl" />
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                <SkeletonBlock className="h-4 w-[70%] rounded-full" />
                <SkeletonBlock className="h-4 w-[50%] rounded-full" />
              </div>
            </div>
            <SkeletonBlock className="h-11 w-full rounded-lg" />
            <SkeletonBlock className="h-7 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function HomePageSkeleton(): JSX.Element {
  return (
    <div role="status" aria-busy="true" aria-label="กำลังโหลดหน้าหลัก">
      <span className="sr-only">กำลังโหลดหน้าหลัก</span>
      {/* Main-column classes copied from src/pages/Index.tsx:103. */}
      <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 px-4 py-6 pt-16 sm:gap-8 sm:px-6 sm:py-8 lg:pt-8 lg:gap-10 min-h-svh">
        <WelcomeBannerSkeleton />
        {/* space-y-2 slot mirrors Index.tsx:126; grid classes copied from CozyFeatureCards.tsx:89. */}
        <div aria-hidden="true" className="space-y-2">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <CheckInCardSkeleton />
            <FindFriendsCardSkeleton />
          </div>
        </div>
        <div aria-hidden="true">
          <CommunitySectionSkeleton />
        </div>
      </main>
    </div>
  );
}
