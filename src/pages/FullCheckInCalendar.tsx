import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { GreenTeaWarningPopup } from '@/components/bear-cafe/GreenTeaWarningPopup';
import { CooldownBox } from '@/components/bear-cafe/CooldownBox';
import { CozyAppShell } from '@/components/bear-cafe/CozyAppShell';
import { CozyPageFooter } from '@/components/bear-cafe/CozyPageFooter';
import { CheckInDayCard } from '@/components/bear-cafe/CheckInDayCard';
import { CheckinSelectedDayReward } from '@/components/bear-cafe/CheckinSelectedDayReward';
import { CheckinBigRewardPreview } from '@/components/bear-cafe/CheckinBigRewardPreview';
import { CheckinRewardModal } from '@/components/bear-cafe/CheckinRewardModal';
import { CheckinMakeupConfirmModal } from '@/components/bear-cafe/CheckinMakeupConfirmModal';
import { CheckinMakeupSuccessModal } from '@/components/bear-cafe/CheckinMakeupSuccessModal';
import { useCooldown } from '@/hooks/useCooldown';
import { useCheckinFlow } from '@/hooks/useCheckinFlow';
import { useUserBalances } from '@/hooks/useUserBalances';
import {
  computeCheckinStreak,
  computeMissedCheckinDays,
  formatSelectedDayRewardSubtitle,
  getCheckinClaimButtonLabel,
  getCheckinDayState,
  getCheckinToday,
} from '@/lib/checkin';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';
import { CaffeLatteIcon } from '@/icon/outline';
import { BrokenHeartIcon, Calendar2Icon, FireIcon } from '@/icon/inline';

const ALL_CHECKIN_DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

export default function FullCheckInCalendar() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { points } = useUserBalances(user?.discord_id);

  const { isOnCooldown, formattedTime, remainingMinutes } = useCooldown(user?.id ?? null);

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

  const defaultSelectedDay = Math.min(todayDay, 28);
  const [overrideDay, setOverrideDay] = useState<number | null>(null);
  const selectedDay = overrideDay ?? defaultSelectedDay;

  // Reset manual selection when the calendar day rolls over
  useEffect(() => {
    setOverrideDay(null);
  }, [defaultSelectedDay]);

  const streak = computeCheckinStreak(completedDays, todayDay);
  const totalCheckins = completedDays.size;
  const missedThisMonth = computeMissedCheckinDays(completedDays, todayDay);
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
  const rewardSubtitle = formatSelectedDayRewardSubtitle(selectedState, selectedDay, todayDay);
  const claimButtonLabel = getCheckinClaimButtonLabel(
    acting,
    selectedCheckedIn,
    selectedDay,
    selectedState,
  );

  return (
    <CozyAppShell
      isLoading={isLoading}
      contentClassName="min-h-screen"
      overlays={
        <>
          <GreenTeaWarningPopup userId={user?.id} />
          <CooldownBox
            isOnCooldown={isOnCooldown}
            formattedTime={formattedTime}
            remainingMinutes={remainingMinutes}
          />
        </>
      }
    >
      <main className="mx-auto flex w-full min-w-0 flex-col gap-5 px-4 py-6 pt-16 sm:gap-8 sm:px-6 sm:py-8 lg:pt-8 lg:gap-10 min-h-svh">
        <div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-[#D7A042] dark:text-[#9A7331] bear-body-regular-medium sm:bear-h2-bold flex items-center gap-1.5 sm:gap-2"
          >
            <ChevronLeft size={18} className="sm:w-5 sm:h-5 shrink-0" color="#D7A042" />
            <span className="text-[#9A7331] dark:text-[#D7A042]">กลับไปหน้าคาเฟ่</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 sm:gap-5 lg:gap-6 flex-1 w-full min-w-0">
          <div className="bg-[#FDFAF7] dark:bg-[#101010] border-2 border-[#F4EEE5] dark:border-[#101010] rounded-lg p-3 sm:p-4 md:p-6 lg:p-8 space-y-3 sm:space-y-4 min-w-0">
            <div className="flex items-start gap-2 sm:gap-3 min-w-0">
              <CaffeLatteIcon size={{ mobile: 24, desktop: 36 }} className="shrink-0" />
              <p className="bear-h3-bold md:bear-h1-bold text-[#89654A] dark:text-[#E9E6E2] leading-tight min-w-0">
                เช็คอินรายวันเพื่อรับรางวัลพิเศษ!
              </p>
            </div>
            <p className="bear-body-small-regular md:bear-body-regular text-[#94735C] dark:text-[#9D8F7B]">
              เช็คอินรายวันเพื่อรับของขวัญมากมาย ชวนเพื่อนมารับรางวัลกันด้วยน้า
            </p>

            <div className="w-full min-w-0 overflow-x-auto sm:overflow-visible -mx-1 px-1 sm:mx-0 sm:px-0">
              <div className="grid grid-cols-4 md:grid-cols-7 gap-0.5 min-[375px]:gap-1 sm:gap-2 md:gap-3 min-w-[18.5rem] sm:min-w-0 w-full [&_button]:min-w-0">
                {loading
                  ? Array.from({ length: 28 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-square min-h-[4.5rem] animate-pulse rounded-lg bg-[#EDE4D4] dark:bg-[#1A1A1A] sm:rounded-2xl"
                    />
                  ))
                  : ALL_CHECKIN_DAYS.map((day) => {
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
                        onClick={() => setOverrideDay(day)}
                      />
                    );
                  })}
              </div>
            </div>

            {/* Shown only during the post-month makeup window */}
            {status?.makeup_window_open && isAuthenticated && (
              <p className="text-center bear-body-small-regular text-[#D7A042] dark:text-[#D7A042] px-1">
                ช่วงเติมเช็คอินเปิดแล้ว — คลิกวันที่พลาดเพื่อเติมด้วยแต้ม
              </p>
            )}

            <p className="text-[#94735C] dark:text-[#9D8F7B] bear-body-small-regular md:bear-body-regular">
              เช็คอินทุกวันเพื่อรับรางวัลสุดพิเศษ ถ้าพลาดวันไหนก็สามารถรับรางวัลย้อนหลังได้น้า
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 sm:gap-4 min-w-0">
            <div className="bg-[#FDFAF7] dark:bg-[#101010] border-2 border-[#F4EEE5] dark:border-[#101010] rounded-lg p-3 sm:p-4 md:p-6 lg:p-8 flex flex-col gap-3 sm:gap-4 min-w-0">
              <div className="min-w-0">
                <h2 className="bear-h3-bold md:bear-h2-bold text-[#89654A] dark:text-[#E9E6E2]">
                  รางวัลในวันที่ {selectedDay}
                </h2>
                <p className="bear-body-small-regular text-[#94735C] dark:text-[#9D8F7B]">
                  {rewardSubtitle}
                </p>
              </div>

              <div className="py-0.5 sm:py-1">
                {selectedReward ? (
                  <CheckinSelectedDayReward
                    reward={selectedReward}
                    roleIcon={
                      selectedReward.role_id ? roleMeta[selectedReward.role_id]?.icon : undefined
                    }
                    roleName={
                      selectedReward.role_id
                        ? roleMeta[selectedReward.role_id]?.name ?? selectedReward.role_name
                        : undefined
                    }
                  />
                ) : (
                  <p className="bear-body-regular text-[#94735C] dark:text-[#9D8F7B] text-center py-8">
                    ยังไม่มีรางวัลสำหรับวันนี้
                  </p>
                )}
              </div>

              <p className="bear-body-small-medium sm:bear-body-regular-medium text-[#89654A] dark:text-[#E9E6E2] text-center">
                ยอดสะสมปัจจุบัน {formatNumber(points)} แต้ม
              </p>

              {!isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="bg-[#1E3A2F] border-[#2D5C48] text-[#E9E6E2] bear-body-regular-medium rounded-full px-6 sm:px-8 py-2.5 sm:py-2 w-full"
                >
                  เข้าสู่ระบบ
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!canClaimSelected || acting || selectedDay > 28}
                  onClick={() => handleClaimSelected(selectedDay, selectedState, selectedReward)}
                  className={cn(
                    'bear-body-regular-medium rounded-full px-6 sm:px-8 py-2.5 sm:py-2 cursor-pointer border-2 w-full',
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

            <div className="bg-[#FDFAF7] dark:bg-[#101010] border-2 border-[#F4EEE5] dark:border-[#101010] rounded-lg p-3 sm:p-4 md:p-6 lg:p-8 min-w-0 sm:col-span-2 lg:col-span-1">
              <CheckinBigRewardPreview
                fullCalendar={true}
                bigReward={bigReward}
                completedDays={totalCheckins}
                claimed={bigRewardClaimed}
                roleIcon={bigReward?.role_id ? roleMeta[bigReward.role_id]?.icon : undefined}
                roleName={bigReward?.role_id ? roleMeta[bigReward.role_id]?.name : undefined}
              />
            </div>

            {/* Monthly streak / total / missed stats */}
            <div className="bg-[#FDFAF7] dark:bg-[#101010] border-2 border-[#F4EEE5] dark:border-[#101010] rounded-lg p-3 sm:p-4 md:p-6 lg:p-8 flex flex-col gap-2.5 sm:gap-3 min-w-0 sm:col-span-2 lg:col-span-1">
              <h3 className="text-[#89654A] dark:text-[#E9E6E2] bear-h3-bold md:bear-h2-bold">
                สถิติของคุณ
              </h3>
              <div className="flex items-center justify-between gap-2 bg-[#FAF2E4] border border-[#F4EEE5] dark:bg-[#121212] dark:border-[#242424] rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-1">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <FireIcon size={16} color="#D7A042" className="shrink-0" />
                  <span className="text-[#89654A] dark:text-[#E9E6E2] bear-body-small-medium sm:bear-body-regular-medium truncate">
                    เช็คอินต่อเนื่อง
                  </span>
                </div>
                <span className="text-[#89654A] dark:text-[#E9E6E2] bear-body-small-medium sm:bear-body-regular-medium shrink-0">
                  {streak} วัน
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 bg-[#FAF2E4] border border-[#F4EEE5] dark:bg-[#121212] dark:border-[#242424] rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-1">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <Calendar2Icon size={16} color="#2D5C48" className="shrink-0" />
                  <span className="text-[#89654A] dark:text-[#E9E6E2] bear-body-small-medium sm:bear-body-regular-medium truncate">
                    เช็คอินสะสม
                  </span>
                </div>
                <span className="text-[#89654A] dark:text-[#E9E6E2] bear-body-small-medium sm:bear-body-regular-medium shrink-0">
                  {totalCheckins} วัน
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 bg-[#FAF2E4] border border-[#F4EEE5] dark:bg-[#121212] dark:border-[#242424] rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-1">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <BrokenHeartIcon size={16} color="#622F37" className="shrink-0" />
                  <span className="text-[#89654A] dark:text-[#E9E6E2] bear-body-small-medium sm:bear-body-regular-medium truncate">
                    พลาดในเดือนนี้
                  </span>
                </div>
                <span className="text-[#89654A] dark:text-[#E9E6E2] bear-body-small-medium sm:bear-body-regular-medium shrink-0">
                  {missedThisMonth} วัน
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <CozyPageFooter variant="checkin" />

      <CheckinMakeupConfirmModal
        data={makeupModal}
        confirming={acting}
        onConfirm={handleMakeupConfirm}
        onClose={closeMakeupModal}
      />
      <CheckinMakeupSuccessModal data={makeupSuccessModal} onClose={closeMakeupSuccessModal} />
      <CheckinRewardModal reward={rewardModal} onClose={closeRewardModal} />
    </CozyAppShell>
  );
}
