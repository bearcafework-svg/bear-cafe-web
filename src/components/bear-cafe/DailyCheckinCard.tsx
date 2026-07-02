import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useCheckinFlow } from '@/hooks/useCheckinFlow';
import { CheckinRewardModal } from '@/components/bear-cafe/CheckinRewardModal';
import { CheckinBigRewardPreview } from '@/components/bear-cafe/CheckinBigRewardPreview';
import { CheckinMakeupConfirmModal } from '@/components/bear-cafe/CheckinMakeupConfirmModal';
import { CheckinMakeupSuccessModal } from '@/components/bear-cafe/CheckinMakeupSuccessModal';
import { CheckInDayCard } from '@/components/bear-cafe/CheckInDayCard';
import {
  computeCheckinStreak,
  getCheckinClaimButtonLabel,
  getCheckinDayState,
  getCheckinMobilePageDays,
  getCheckinMobilePageIndex,
  getCheckinWeekDays,
  getCheckinWeekIndex,
  getCheckinToday,
} from '@/lib/checkin';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
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
    bigReward,
    bigRewardClaimed,
  } = useCheckinFlow(user?.discord_id);

  const [selectedDay, setSelectedDay] = useState(() => Math.min(getCheckinToday().day, 28));
  const [weekIndex, setWeekIndex] = useState(() => getCheckinWeekIndex(todayDay));
  const [mobilePageIndex, setMobilePageIndex] = useState(() => getCheckinMobilePageIndex(todayDay));

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
          className="h-14 min-w-[2.75rem] flex-1 animate-pulse rounded-xl bg-[hsl(var(--latte)/0.45)] dark:bg-[#1A1A1A] sm:h-[4.5rem] sm:rounded-2xl md:h-[5.5rem] lg:h-[5.75rem]"
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

  const navButtonClass =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[hsl(var(--bear-brown)/0.45)] transition-colors hover:bg-[hsl(var(--latte)/0.5)] disabled:opacity-30 dark:text-[#6B6B6B] dark:hover:bg-[#1A1A1A]';

  const claimButton = !isAuthenticated ? (
    <button
      type="button"
      onClick={() => navigate('/login')}
      className="shrink-0 rounded-full border border-[#2D5C48] bg-[#1E3A2F] px-4 py-1.5 bear-body-small-medium text-[#E9E6E2] transition-colors hover:bg-[#2D5C48] sm:px-6 sm:py-2 sm:bear-body-regular-medium"
    >
      เข้าสู่ระบบ
    </button>
  ) : (
    <button
      type="button"
      disabled={!canClaimSelected || acting || selectedDay > 28}
      onClick={() => handleClaimSelected(selectedDay, selectedState, selectedReward)}
      className={cn(
        'shrink-0 rounded-full border-2 px-4 py-1.5 bear-body-small-medium transition-colors sm:px-6 sm:py-1 sm:bear-body-regular-medium',
        'bg-[#C7EEC8] border-[#9CCC9E] text-[#89654A] hover:bg-[#b5e0b6]',
        'dark:bg-[#1E3A2F] dark:border-[#2D5C48] dark:text-[#E9E6E2] dark:hover:bg-[#2D5C48]',
        'disabled:bg-[#bedebf] disabled:border-[#88ae89] disabled:text-[#a3c0a4]',
        'dark:disabled:border-[#1E3A2F] dark:disabled:bg-[#0C1511] dark:disabled:text-[#214738]',
      )}
    >
      {acting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : claimButtonLabel}
    </button>
  );

  return (
    <>
      <div
        className={cn(
          'relative w-full min-w-0 rounded-3xl border p-4 pt-6 sm:p-5 sm:pt-7',
          'bg-[#FDFAF7] border-2 border-[#F4EEE5]',
          'dark:bg-[#0A0A0A] dark:border-[#242424] dark:shadow-md dark:shadow-black/20',
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

        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-3">
              <CaffeLatteIcon size={{ mobile: 30, desktop: 38 }} />
              <h3 className="truncate bear-h3-bold text-[hsl(var(--mocha))] dark:text-[#E9E6E2] md:bear-h1-bold">
                เช็กอิน {computeCheckinStreak(completedDays, todayDay)} วัน ติดต่อกัน!
              </h3>
            </div>
            <p className="bear-body-small-medium text-[hsl(var(--bear-brown)/0.55)] dark:text-[#6B6B6B] md:bear-body-small-medium">
              เช็กอินรายวันเพื่อรับของขวัญมากมาย ชวนเพื่อนมารับรางวัลกันด้วยน้า
            </p>
          </div>
          <div className="hidden sm:block">{claimButton}</div>
        </div>

        <div className="mb-3 sm:hidden w-full flex justify-center">{claimButton}</div>

        <div className="mb-3 flex items-center gap-1 sm:hidden">
          <button
            type="button"
            aria-label="หน้าก่อนหน้า"
            disabled={mobilePageIndex === 0}
            onClick={() => setMobilePageIndex((p) => Math.max(0, p - 1))}
            className={navButtonClass}
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex min-w-0 flex-1 items-stretch justify-between gap-0.5">
            {renderDayRow(visibleMobileDays, 4)}
          </div>
          <button
            type="button"
            aria-label="หน้าถัดไป"
            disabled={mobilePageIndex >= 6}
            onClick={() => setMobilePageIndex((p) => Math.min(6, p + 1))}
            className={navButtonClass}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="mb-4 hidden items-center gap-1 sm:flex sm:gap-1.5 md:gap-2">
          <button
            type="button"
            aria-label="สัปดาห์ก่อนหน้า"
            disabled={weekIndex === 0}
            onClick={() => setWeekIndex((w) => Math.max(0, w - 1))}
            className={navButtonClass}
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex min-w-0 flex-1 items-stretch justify-between gap-1.5 md:gap-2">
            {renderDayRow(visibleWeekDays, 7)}
          </div>
          <button
            type="button"
            aria-label="สัปดาห์ถัดไป"
            disabled={weekIndex >= 3}
            onClick={() => setWeekIndex((w) => Math.min(3, w + 1))}
            className={navButtonClass}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {status?.makeup_window_open && isAuthenticated && (
          <p className="mb-3 text-center text-[11px] text-[#9A7331] dark:text-[#D7A042]">
            ช่วงเติมเช็กอินเปิดแล้ว — คลิกวันที่พลาดเพื่อเติมด้วยแต้ม
          </p>
        )}

        <CheckinBigRewardPreview
          inline
          bigReward={bigReward}
          completedDays={completedDays.size}
          claimed={bigRewardClaimed}
          roleIcon={bigReward?.role_id ? roleMeta[bigReward.role_id]?.icon : undefined}
          roleName={bigReward?.role_id ? roleMeta[bigReward.role_id]?.name : undefined}
          onCalendarClick={() => navigate('/full-checkin-calendar')}
        />
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
