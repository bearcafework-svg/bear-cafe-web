import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useCheckinFlow } from '@/hooks/useCheckinFlow';
import { CheckinRewardModal } from '@/components/bear-cafe/CheckinRewardModal';
import { CheckinMakeupConfirmModal } from '@/components/bear-cafe/CheckinMakeupConfirmModal';
import { CheckinMakeupSuccessModal } from '@/components/bear-cafe/CheckinMakeupSuccessModal';
import { CheckInDayCard } from '@/components/bear-cafe/CheckInDayCard';
import {
  computeCheckinStreak,
  formatSelectedDayRewardDetail,
  formatSelectedDayRewardSubtitle,
  getCheckinClaimButtonLabel,
  getCheckinDayState,
  getCheckinMobilePageDays,
  getCheckinMobilePageIndex,
  getCheckinWeekDays,
  getCheckinWeekIndex,
  getCheckinToday,
} from '@/lib/checkin';
import { cn } from '@/lib/utils';
import { Calendar, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { CaffeLatteIcon } from '@/icon/outline';
import { MaskingTape } from '@/components/bear-cafe/FeatureCardFrame';

export function DailyCheckInCard() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const {
    status,
    loading,
    acting,
    todayDay,
    completedDays,
    rewardsByDay,
    roleMeta,
    rewardModal,
    makeupModal,
    makeupSuccessModal,
    closeRewardModal,
    closeMakeupModal,
    closeMakeupSuccessModal,
    handleClaimSelected,
    handleMakeupConfirm,
  } = useCheckinFlow(user?.discord_id);

  const [selectedDay, setSelectedDay] = useState(() => Math.min(getCheckinToday().day, 28));
  const [weekIndex, setWeekIndex] = useState(() => getCheckinWeekIndex(todayDay));
  const [mobilePageIndex, setMobilePageIndex] = useState(() => getCheckinMobilePageIndex(todayDay));

  // Sync pagination to current day when month/day changes
  useEffect(() => {
    setWeekIndex(getCheckinWeekIndex(todayDay));
    setMobilePageIndex(getCheckinMobilePageIndex(todayDay));
    setSelectedDay(Math.min(todayDay, 28));
  }, [todayDay]);

  const visibleWeekDays = getCheckinWeekDays(weekIndex);
  const visibleMobileDays = getCheckinMobilePageDays(mobilePageIndex);
  const selectedReward = rewardsByDay.get(selectedDay);
  const selectedState = getCheckinDayState(
    selectedDay,
    completedDays,
    todayDay,
    status?.makeup_window_open ?? false,
  );
  const selectedCheckedIn = selectedDay <= 28 && completedDays.has(selectedDay);
  const canClaimSelected =
    isAuthenticated &&
    selectedDay <= 28 &&
    !selectedCheckedIn &&
    selectedReward?.is_active &&
    (selectedState === 'today' || selectedState === 'makeup');
  const rewardDetail =
    selectedReward?.reward_type === 'role' && selectedReward.role_id
      ? `บทบาท ${roleMeta[selectedReward.role_id]?.name ?? selectedReward.role_id}`
      : formatSelectedDayRewardDetail(selectedReward);
  const rewardSubtitle = formatSelectedDayRewardSubtitle(selectedState, selectedDay, todayDay);
  const claimButtonLabel = getCheckinClaimButtonLabel(
    acting,
    selectedCheckedIn,
    selectedDay,
    selectedState,
  );

  const renderDayRow = (days: number[], skeletonCount: number) => {
    if (loading) {
      return Array.from({ length: skeletonCount }).map((_, i) => (
        <div
          key={i}
          className="h-14 min-w-[2.75rem] flex-1 animate-pulse rounded-xl bg-[hsl(var(--latte)/0.45)] dark:bg-[hsl(var(--muted))] sm:h-[4.5rem] sm:rounded-2xl md:h-[5.5rem] lg:h-[5.75rem]"
        />
      ));
    }

    return days.map((day) => {
      const state = getCheckinDayState(
        day,
        completedDays,
        todayDay,
        status?.makeup_window_open ?? false,
      );
      const reward = rewardsByDay.get(day);
      return (
        <CheckInDayCard
          key={day}
          day={day}
          state={state}
          reward={reward}
          roleIcon={reward?.role_id ? roleMeta[reward.role_id]?.icon : undefined}
          isSelected={day === selectedDay}
          disabled={acting}
          onClick={() => setSelectedDay(day)}
        />
      );
    });
  };

  return (
    <>
      <div
        className={cn(
          'relative w-full min-w-0 rounded-3xl border p-4 pt-6 sm:p-5 sm:pt-7',
          'bg-[#FDFAF7] border-2 border-[#F4EEE5]',
          'dark:bg-[hsl(var(--card))] dark:border-[hsl(var(--coffee)/0.5)] dark:shadow-md dark:shadow-black/20',
        )}
      >
        <div className="sm:hidden dark:hidden">
          <MaskingTape color="brown" rotate={-1} width={120} position={0} />
        </div>
        <div className="hidden sm:block sm:dark:hidden">
          <MaskingTape color="brown" rotate={-1} width={200} position={200} />
        </div>
        <div className="hidden dark:block sm:dark:hidden">
          <MaskingTape color="honey" rotate={-1} width={120} position={0} />
        </div>
        <div className="hidden sm:dark:block">
          <MaskingTape color="honey" rotate={-1} width={200} position={200} />
        </div>
        <div className="mb-3 flex items-start justify-between gap-2 sm:mb-4 sm:gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-3">
              <CaffeLatteIcon size={{ mobile: 30, desktop: 38 }} />
              <h3 className="truncate md:bear-h1-bold bear-h3-bold text-[hsl(var(--mocha))] dark:text-[hsl(var(--foreground))]">
                เช็คอิน {computeCheckinStreak(completedDays, todayDay)} วัน ติดต่อกัน!
              </h3>
            </div>
            <p className="bear-body-small-regular md:bear-body-regular-medium text-[hsl(var(--bear-brown)/0.55)] dark:text-[hsl(var(--muted-foreground))] ">
              เช็คอินรายวันเพื่อรับของขวัญมากมาย ชวนเพื่อนมารับรางวัลกันด้วยน้า
            </p>
          </div>
          <button type="button" onClick={() => navigate('/full-checkin-calendar')}>
            <Calendar className="h-4 w-4 shrink-0 text-[hsl(var(--bear-brown)/0.45)] dark:text-[hsl(var(--muted-foreground))] sm:h-5 sm:w-5" />
          </button>
        </div>

        {/* Mobile: 4-day pages; desktop: 7-day weeks */}
        <div className="mb-3 flex items-center gap-1 sm:hidden">
          <button
            type="button"
            aria-label="หน้าก่อนหน้า"
            disabled={mobilePageIndex === 0}
            onClick={() => setMobilePageIndex((p) => Math.max(0, p - 1))}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[hsl(var(--bear-brown)/0.45)] transition-colors hover:bg-[hsl(var(--latte)/0.5)] disabled:opacity-30 dark:text-[hsl(var(--muted-foreground))] dark:hover:bg-[hsl(var(--muted))]"
          >
            <ChevronLeft size={20} className="text-[hsl(var(--bear-brown)/0.45)] dark:text-[hsl(var(--muted-foreground))]" />
          </button>
          <div className="flex min-w-0 flex-1 items-stretch justify-between gap-0.5">
            {renderDayRow(visibleMobileDays, 4)}
          </div>
          <button
            type="button"
            aria-label="หน้าถัดไป"
            disabled={mobilePageIndex >= 6}
            onClick={() => setMobilePageIndex((p) => Math.min(6, p + 1))}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[hsl(var(--bear-brown)/0.45)] transition-colors hover:bg-[hsl(var(--latte)/0.5)] disabled:opacity-30 dark:text-[hsl(var(--muted-foreground))] dark:hover:bg-[hsl(var(--muted))]"
          >
            <ChevronRight size={20} className="text-[hsl(var(--bear-brown)/0.45)] dark:text-[hsl(var(--muted-foreground))]" />
          </button>
        </div>

        <div className="mb-3 hidden items-center gap-1 sm:mb-4 sm:flex sm:gap-1.5 md:gap-2">
          <button
            type="button"
            aria-label="สัปดาห์ก่อนหน้า"
            disabled={weekIndex === 0}
            onClick={() => setWeekIndex((w) => Math.max(0, w - 1))}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[hsl(var(--bear-brown)/0.45)] transition-colors hover:bg-[hsl(var(--latte)/0.5)] disabled:opacity-30 dark:text-[hsl(var(--muted-foreground))] dark:hover:bg-[hsl(var(--muted))]"
          >
            <ChevronLeft size={20} className="text-[hsl(var(--bear-brown)/0.45)] dark:text-[hsl(var(--muted-foreground))]" />
          </button>
          <div className="flex min-w-0 flex-1 items-stretch justify-between gap-1.5 md:gap-2">
            {renderDayRow(visibleWeekDays, 7)}
          </div>
          <button
            type="button"
            aria-label="สัปดาห์ถัดไป"
            disabled={weekIndex >= 3}
            onClick={() => setWeekIndex((w) => Math.min(3, w + 1))}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[hsl(var(--bear-brown)/0.45)] transition-colors hover:bg-[hsl(var(--latte)/0.5)] disabled:opacity-30 dark:text-[hsl(var(--muted-foreground))] dark:hover:bg-[hsl(var(--muted))]"
          >
            <ChevronRight size={20} className="text-[hsl(var(--bear-brown)/0.45)] dark:text-[hsl(var(--muted-foreground))]" />
          </button>
        </div>

        {status?.makeup_window_open && isAuthenticated && (
          <p className="mb-3 text-center text-[11px] text-[hsl(var(--honey))] dark:text-[hsl(var(--honey)/0.9)]">
            ช่วงเติมเช็คอินเปิดแล้ว — คลิกวันที่พลาดเพื่อเติมด้วยแต้ม
          </p>
        )}

        <div className="flex flex-col gap-3 rounded-[20px] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5 sm:py-2.5 bg-[#FAF2E4] border-[#F4EEE5] dark:bg-[#0A0A0A] border dark:border-[#0A0A0A]">
          <div className="min-w-0 space-y-0.5">
            <p className="bear-h2-medium">
              <span className="text-[#89654A] dark:text-[#E9E6E2]">รางวัล</span>
              {rewardDetail && (
                <>
                  {' '}
                  <span className="text-[#9A7331] dark:text-[#D7A042]">{rewardDetail}</span>{' '}
                </>
              )}
              <span className="text-[#89654A] dark:text-[#E9E6E2]">รับเลย!</span>
            </p>
            <p className="bear-body-small-regular text-[#94735C] dark:text-[#9D8F7B]">
              {rewardSubtitle}
            </p>
          </div>

          {!isAuthenticated ? (
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="bg-[#1E3A2F] border-[#2D5C48] text-[#E9E6E2] bear-body-regular-medium rounded-full px-8 py-2 disabled:bg-[#0C1511] disabled:border-[#1E3A2F] disabled:text-[#214738] transition-all duration-200 hover:bg-[#2D5C48] hover:border-[#2D5C48] hover:text-[#E9E6E2]"
            >
              เข้าสู่ระบบ
            </button>
          ) : (
            <button
              type="button"
              disabled={!canClaimSelected || acting || selectedDay > 28}
              onClick={() => handleClaimSelected(selectedDay, selectedState, selectedReward)}
              className={cn(
                'bear-body-regular-medium rounded-full px-8 py-1 md:py-2 cursor-pointer border-2',
                'bg-[#C7EEC8] dark:bg-[#1E3A2F] border-[#9CCC9E] dark:border-[#2D5C48] text-[#89654A] dark:text-[#E9E6E2] disabled:bg-[#bedebf] dark:disabled:bg-[#0C1511] disabled:border-[#88ae89] dark:disabled:border-[#1E3A2F] disabled:text-[#a3c0a4] dark:disabled:text-[#1E3A2F]',
              )}
            >
              {acting ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              ) : (
                claimButtonLabel
              )}
            </button>
          )}
        </div>
      </div>

      <CheckinMakeupConfirmModal
        data={makeupModal}
        confirming={acting}
        onConfirm={handleMakeupConfirm}
        onClose={closeMakeupModal}
      />
      <CheckinMakeupSuccessModal data={makeupSuccessModal} onClose={closeMakeupSuccessModal} />
      <CheckinRewardModal reward={rewardModal} onClose={closeRewardModal} />
    </>
  );
}
