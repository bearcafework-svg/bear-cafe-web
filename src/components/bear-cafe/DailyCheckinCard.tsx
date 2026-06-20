import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useCheckin } from '@/hooks/useCheckin';
import { CheckinRewardModal, type CheckinRewardModalData } from '@/components/bear-cafe/CheckinRewardModal';
import {
  CHECKIN_ERROR_MESSAGES,
  computeCheckinStreak,
  formatSelectedDayRewardDetail,
  formatSelectedDayRewardSubtitle,
  getCheckinDayState,
  getCheckinWeekDays,
  getCheckinWeekIndex,
  getCheckinToday,
  REWARD_TYPE_LABELS,
  type CheckinDailyReward,
  type CheckinDayState,
} from '@/lib/checkin';
import { cn } from '@/lib/utils';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { CaffeLatteIcon } from '@/icon/outline';
import {
  CircleCheckIcon,
  CircleDotIcon,
  GiftIcon,
  LockIcon,
  StarIcon,
} from '@/icon/inline';
import { Button } from '../ui/button';
import { MaskingTape } from '@/components/bear-cafe/FeatureCardFrame';

function rewardToPopup(reward: Record<string, unknown>): CheckinRewardModalData {
  const rewardType = reward.reward_type as string;
  if (rewardType === 'role') {
    return { type: 'role', roleName: 'Discord Role', message: 'ได้รับ Role แล้ว!' };
  }
  const amount = Number(reward.reward_amount ?? 0);
  const label = REWARD_TYPE_LABELS[rewardType as keyof typeof REWARD_TYPE_LABELS] ?? 'แต้ม';
  return {
    type: 'points',
    pointsAdded: amount,
    message: `ได้รับ ${amount} ${label}`,
  };
}

function dailyRewardToModal(reward: CheckinDailyReward): CheckinRewardModalData {
  if (reward.reward_type === 'role') {
    return { type: 'role', roleName: 'Discord Role', message: 'ได้รับ Role แล้ว!' };
  }
  const amount = reward.reward_amount ?? 0;
  const label = REWARD_TYPE_LABELS[reward.reward_type as keyof typeof REWARD_TYPE_LABELS] ?? 'แต้ม';
  return {
    type: 'points',
    pointsAdded: amount,
    message: `ได้รับ ${amount} ${label}`,
  };
}

function DayStatusIcon({
  day,
  state,
  isToday,
  size = 20,
}: {
  day: number;
  state: CheckinDayState;
  isToday: boolean;
  size?: number;
}) {
  if (state === 'completed') {
    return <CircleCheckIcon size={size} color="#50A582" />;
  }

  if (day === 28) {
    return <GiftIcon size={size} color="#9A7331" />;
  }

  if (isToday && state === 'today') {
    return <StarIcon size={size} color="#D7A042" />;
  }

  if (state === 'future') {
    return <LockIcon size={size} color="#9A7331" />;
  }

  if (state === 'makeup' || state === 'missed') {
    return <CircleDotIcon size={size} color="#D7A042" />;
  }

  return null;
}

function CheckInDayCard({
  day,
  state,
  isTodayCard,
  isSelected,
  disabled,
  onClick,
}: {
  day: number;
  state: CheckinDayState;
  isTodayCard: boolean;
  isSelected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex min-w-[2.75rem] flex-1 flex-col items-center justify-center border rounded-xl sm:rounded-2xl lg:rounded-[20px] transition-all duration-200',
        'gap-1 py-2 px-1 sm:gap-2 sm:py-3 sm:px-2 md:gap-3 md:py-4 md:px-3 lg:gap-5 lg:py-5 lg:px-4',
        state === 'completed' && !isSelected && 'bg-[#FAF2E4] border-[#50A582] dark:bg-[hsl(var(--coffee))] dark:border-[hsl(var(--matcha)/0.45)]',
        state === 'today' && !isSelected && 'bg-[#F7E6C5] border-[#EACB8F] shadow-[0_0_8px_0px_#D7A042] dark:bg-[hsl(var(--honey)/0.12)] dark:border-[hsl(var(--honey)/0.35)] dark:shadow-[0_0_8px_0px_hsl(var(--honey)/0.2)]',
        state === 'makeup' && !isSelected && 'bg-[#FAF2E4] border-[#EACB8F] dark:bg-[hsl(var(--coffee))] dark:border-[hsl(var(--border))]',
        state === 'future' && !isSelected && 'bg-[#FAF2E4] border-[#EACB8F] dark:bg-[hsl(var(--coffee))] dark:border-[hsl(var(--border))]',
        state === 'missed' && !isSelected && 'bg-[#FAF2E4] border-[#EACB8F] dark:bg-[hsl(var(--coffee))] dark:border-[hsl(var(--border))]',
        isSelected && 'border-[#D7A042] shadow-[0_0_8px_0px_#D7A042] dark:border-[hsl(var(--honey))] dark:shadow-[0_0_8px_0px_hsl(var(--honey)/0.35)]',
        isSelected && state === 'completed' && 'bg-[#FAF2E4] dark:bg-[hsl(var(--coffee))]',
        isSelected && state === 'today' && 'bg-[#F7E6C5] dark:bg-[hsl(var(--honey)/0.12)]',
        isSelected && (state === 'makeup' || state === 'future' || state === 'missed') && 'bg-[#FAF2E4] dark:bg-[hsl(var(--coffee))]',
        !disabled && 'cursor-pointer hover:scale-[1.01] active:scale-[0.98]',
        disabled && 'cursor-default',
      )}
    >
      <span
        className={cn(
          'bear-body-xsmall-medium leading-none md:bear-body-small-medium',
          state === 'completed' && 'text-[#B2A094] dark:text-[hsl(var(--matcha)/0.7)]',
          state === 'today' && 'text-[#D7A042] dark:text-[hsl(var(--honey))]',
          state === 'makeup' && 'text-[#B2A094] dark:text-[hsl(var(--muted-foreground))]',
          state === 'future' && 'text-[#7C6F65] dark:text-[hsl(var(--muted-foreground)/0.65)]',
          state === 'missed' && 'text-[#B2A094] dark:text-[hsl(var(--muted-foreground))]',
        )}
      >
        <span className="sm:hidden">{day}</span>
        <span className="hidden sm:inline">DAY {day}</span>
      </span>
      <div className="md:hidden">
        <DayStatusIcon day={day} state={state} isToday={isTodayCard} size={14} />
      </div>
      <div className="hidden md:block">
        <DayStatusIcon day={day} state={state} isToday={isTodayCard} size={20} />
      </div>
    </button>
  );
}

export function DailyCheckInCard() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { status, loading, acting, performCheckin, performMakeupCheckin } = useCheckin(
    user?.discord_id,
  );
  const [rewardModal, setRewardModal] = useState<CheckinRewardModalData | null>(null);
  const closeRewardModal = useCallback(() => setRewardModal(null), []);
  const [selectedDay, setSelectedDay] = useState(() => Math.min(getCheckinToday().day, 28));

  const { year, month, day: todayDay } = getCheckinToday();
  const [weekIndex, setWeekIndex] = useState(() => getCheckinWeekIndex(todayDay));

  useEffect(() => {
    setWeekIndex(getCheckinWeekIndex(todayDay));
    setSelectedDay(Math.min(todayDay, 28));
  }, [todayDay]);

  const completedDays = useMemo(() => {
    if (!status) return new Set<number>();
    return new Set([...status.cycle.completed_days, ...status.cycle.makeup_days]);
  }, [status]);

  const rewardsByDay = useMemo(() => {
    const map = new Map<number, CheckinDailyReward>();
    status?.daily_rewards.forEach((reward) => map.set(reward.day_number, reward));
    return map;
  }, [status]);

  const visibleDays = getCheckinWeekDays(weekIndex);
  const streak = computeCheckinStreak(completedDays, todayDay);
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
  const rewardDetail = formatSelectedDayRewardDetail(selectedReward);
  const rewardSubtitle = formatSelectedDayRewardSubtitle(selectedState, selectedDay, todayDay);
  const showStrawberry = selectedReward?.reward_type === 'points';
  const isCompleted = selectedState === 'completed';

  const handleActionResult = (result: {
    ok: boolean;
    error?: string;
    reward?: Record<string, unknown>;
    big_reward_granted?: boolean;
  }) => {
    if (!result.ok) {
      const message = CHECKIN_ERROR_MESSAGES[result.error ?? ''] ?? 'ไม่สามารถเช็คอินได้';
      toast.error(message);
      return;
    }

    const modalData = result.reward
      ? rewardToPopup(result.reward)
      : selectedReward
        ? dailyRewardToModal(selectedReward)
        : { type: 'points' as const, pointsAdded: 0, message: 'เช็คอินสำเร็จ!' };

    setRewardModal(modalData);

    if (result.big_reward_granted) {
      toast.success('ครบ 28 วัน! ได้รับรางวัลใหญ่แล้ว ✨');
    }
  };

  const handleClaimSelected = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (selectedState === 'makeup') {
      const cost = selectedReward?.makeup_cost ?? 50;
      const confirmed = window.confirm(`เติมเช็คอินวันที่ ${selectedDay} ใช้ ${cost} แต้ม?`);
      if (!confirmed) return;
      const result = await performMakeupCheckin(selectedDay, year, month);
      handleActionResult(result);
      return;
    }
    if (selectedState === 'today') {
      const result = await performCheckin(todayDay);
      handleActionResult(result);
    }
  };

  const handleDaySelect = (day: number) => {
    setSelectedDay(day);
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
                เช็คอิน {streak} วัน ติดต่อกัน!
              </h3>
            </div>
            <p className="bear-body-small-regular md:bear-body-regular-medium text-[hsl(var(--bear-brown)/0.55)] dark:text-[hsl(var(--muted-foreground))] ">
              เช็คอินรายวันเพื่อรับของขวัญมากมาย ชวนเพื่อนมารับรางวัลกันด้วยน้า
            </p>
          </div>
          <Calendar className="h-4 w-4 shrink-0 text-[hsl(var(--bear-brown)/0.45)] dark:text-[hsl(var(--muted-foreground))] sm:h-5 sm:w-5" />
        </div>

        <div className="mb-3 flex items-center gap-1 sm:mb-4 sm:gap-1.5 md:gap-2">
          <button
            type="button"
            aria-label="สัปดาห์ก่อนหน้า"
            disabled={weekIndex === 0}
            onClick={() => setWeekIndex((w) => Math.max(0, w - 1))}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[hsl(var(--bear-brown)/0.45)] transition-colors hover:bg-[hsl(var(--latte)/0.5)] disabled:opacity-30 dark:text-[hsl(var(--muted-foreground))] dark:hover:bg-[hsl(var(--muted))]"
          >
            <ChevronLeft size={20} className="text-[hsl(var(--bear-brown)/0.45)] dark:text-[hsl(var(--muted-foreground))]" />
          </button>

          <div className="flex min-w-0 flex-1 gap-0.5 sm:gap-1.5 md:gap-2 justify-between items-stretch overflow-x-auto sm:overflow-visible [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {loading
              ? Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 min-w-[2.75rem] flex-1 animate-pulse rounded-xl bg-[hsl(var(--latte)/0.45)] dark:bg-[hsl(var(--muted))] sm:h-[4.5rem] sm:rounded-2xl md:h-[5.5rem] lg:h-[5.75rem]"
                />
              ))
              : visibleDays.map((day) => {
                const state = getCheckinDayState(
                  day,
                  completedDays,
                  todayDay,
                  status?.makeup_window_open ?? false,
                );

                return (
                  <CheckInDayCard
                    key={day}
                    day={day}
                    state={state}
                    isTodayCard={day === todayDay && todayDay <= 28}
                    isSelected={day === selectedDay}
                    disabled={acting}
                    onClick={() => handleDaySelect(day)}
                  />
                );
              })}
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

        <div className="flex flex-col gap-3 rounded-[20px] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5 sm:py-2.5 bg-[#0A0A0A] dark:bg-[hsl(var(--mocha))] border dark:border-[hsl(var(--border))]">
          <div className="min-w-0 space-y-0.5">
            <p className="bear-h2-medium">
              <span
                className={cn(
                  isCompleted
                    ? 'text-[#51443A] dark:text-[hsl(var(--muted-foreground))]'
                    : 'text-[#E9E6E2] dark:text-[hsl(var(--foreground)/0.9)]',
                )}
              >
                รางวัล
              </span>
              {rewardDetail && (
                <>
                  {' '}
                  <span
                    className={cn(
                      isCompleted
                        ? 'text-[#51443A] dark:text-[hsl(var(--muted-foreground))]'
                        : 'text-[#D7A042] dark:text-[hsl(var(--honey))]',
                    )}
                  >
                    {rewardDetail}
                  </span>
                </>
              )}
            </p>
            <p
              className={cn(
                'bear-body-small-regular',
                isCompleted
                  ? 'text-[#51443A] dark:text-[hsl(var(--muted-foreground)/0.8)]'
                  : 'text-[#9D8F7B] dark:text-[hsl(var(--muted-foreground))]',
              )}
            >
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
              onClick={handleClaimSelected}
              className="bg-[#1E3A2F] border-[#2D5C48] text-[#E9E6E2] bear-body-regular-medium rounded-full px-8 py-2 disabled:bg-[#0C1511] disabled:border-[#1E3A2F] disabled:text-[#214738] transition-all duration-200 hover:bg-[#2D5C48] hover:border-[#2D5C48] hover:text-[#E9E6E2]"
            >
              {acting ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              ) : selectedCheckedIn ? (
                'รับรางวัลแล้ว'
              ) : selectedDay > 28 ? (
                'หมดรอบเช็คอิน'
              ) : selectedState === 'makeup' ? (
                'เติมเช็คอิน'
              ) : selectedState === 'future' ? (
                'ยังรับรางวัลไม่ได้'
              ) : selectedState === 'missed' ? (
                'พลาดเช็คอินแล้ว'
              ) : (
                'รับรางวัลวันนี้'
              )}
            </button>
          )}
        </div>
      </div>
      {/* NOTE - Test Reward Modal */}
      {/* <Button onClick={() => setRewardModal({ type: 'points', pointsAdded: 100, message: 'ได้รับ 100 แต้ม' })}>Test Reward Modal</Button> */}

      <CheckinRewardModal reward={rewardModal} onClose={closeRewardModal} />
    </>
  );
}
