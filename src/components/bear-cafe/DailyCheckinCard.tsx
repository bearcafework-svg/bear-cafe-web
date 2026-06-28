import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useCheckin, type CheckinActionResult } from '@/hooks/useCheckin';
import { CheckinRewardModal, type CheckinRewardModalData } from '@/components/bear-cafe/CheckinRewardModal';
import {
  CheckinMakeupConfirmModal,
  type CheckinMakeupConfirmModalData,
} from '@/components/bear-cafe/CheckinMakeupConfirmModal';
import {
  CheckinMakeupSuccessModal,
  type CheckinMakeupSuccessModalData,
} from '@/components/bear-cafe/CheckinMakeupSuccessModal';
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
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  CaffeLatteIcon,
  StrawberryColorIcon,
  TearTicketColorIcon,
  TicketColorIcon,
} from '@/icon/outline';
import { MaskingTape } from '@/components/bear-cafe/FeatureCardFrame';
import { IconDisplay } from '@/components/bear-cafe/IconDisplay';
type RoleMeta = { icon?: string; name?: string };

function rewardToPopup(
  reward: Record<string, unknown>,
  fallback?: CheckinDailyReward,
): CheckinRewardModalData {
  const rewardType = (reward.reward_type ?? fallback?.reward_type) as CheckinDailyReward['reward_type'];
  if (rewardType === 'role') {
    const roleId =
      (typeof reward.role_id === 'string' ? reward.role_id : null) ??
      fallback?.role_id ??
      undefined;
    return {
      type: 'role',
      roleId,
      roleName: fallback?.role_name ?? undefined,
      message: 'ได้รับ Role แล้ว!',
    };
  }
  const amount = Number(reward.reward_amount ?? fallback?.reward_amount ?? 0);
  const label = REWARD_TYPE_LABELS[rewardType] ?? 'แต้ม';
  return {
    type: rewardType,
    pointsAdded: amount,
    message: `ได้รับ ${amount} ${label}`,
  };
}

function buildRewardModalData(
  result: Pick<Extract<CheckinActionResult, { ok: true }>, 'reward'>,
  selectedReward: CheckinDailyReward | undefined,
  roleMeta: Record<string, RoleMeta>,
): CheckinRewardModalData {
  let modalData: CheckinRewardModalData = result.reward
    ? rewardToPopup(result.reward, selectedReward)
    : selectedReward
      ? dailyRewardToModal(selectedReward)
      : { type: 'points', pointsAdded: 0, message: 'เช็คอินสำเร็จ!' };

  if (modalData.type === 'role' && modalData.roleId) {
    const meta = roleMeta[modalData.roleId];
    if (meta) {
      modalData = {
        ...modalData,
        roleName: modalData.roleName ?? meta.name,
        roleIcon: meta.icon,
      };
    }
  }

  return modalData;
}

function dailyRewardToModal(reward: CheckinDailyReward): CheckinRewardModalData {
  if (reward.reward_type === 'role') {
    return {
      type: 'role',
      roleId: reward.role_id ?? undefined,
      roleName: reward.role_name ?? undefined,
      message: 'ได้รับ Role แล้ว!',
    };
  }
  const amount = reward.reward_amount ?? 0;
  const label = REWARD_TYPE_LABELS[reward.reward_type];
  return {
    type: reward.reward_type,
    pointsAdded: amount,
    message: `ได้รับ ${amount} ${label}`,
  };
}

function DayRewardDisplay({
  reward,
  roleIcon,
  state,
}: {
  reward: CheckinDailyReward | undefined;
  roleIcon?: string | null;
  state: CheckinDayState;
}) {
  if (!reward) return null;

  const iconSize = { mobile: 20, desktop: 24 };
  const scoreClass = cn(
    'bear-body-regular-semibold leading-none',
    state === 'completed' && 'text-[#B2A094] dark:text-[hsl(var(--matcha)/0.7)]',
    state === 'today' && 'text-[#D7A042] dark:text-[hsl(var(--honey))]',
    state === 'makeup' && 'text-[#B2A094] dark:text-[hsl(var(--muted-foreground))]',
    state === 'future' && 'text-[#7C6F65] dark:text-[hsl(var(--muted-foreground)/0.65)]',
    state === 'missed' && 'text-[#B2A094] dark:text-[hsl(var(--muted-foreground))]',
  );

  const icon = (() => {
    switch (reward.reward_type) {
      case 'points':
        return <StrawberryColorIcon size={iconSize} />;
      case 'ticket_point':
        return <TicketColorIcon size={iconSize} />;
      case 'ticket_piece_point':
        return <TearTicketColorIcon size={iconSize} />;
      case 'role':
        return (
          <IconDisplay
            icon={roleIcon}
            fallback="🎭"
            size="md"
            className="h-12 w-12 sm:h-16 sm:w-16 text-3xl sm:text-4xl"
          />
        );
      default:
        return null;
    }
  })();

  if (!icon) return null;

  const amount = reward.reward_amount;

  return (
    <div className="flex flex-col items-center gap-0.5">
      {icon}
      {reward.reward_type !== 'role' && amount != null && (
        <span className={scoreClass}>{amount.toLocaleString()}</span>
      )}
    </div>
  );
}

function CheckInDayCard({
  day,
  state,
  reward,
  roleIcon,
  isSelected,
  disabled,
  onClick,
}: {
  day: number;
  state: CheckinDayState;
  reward?: CheckinDailyReward;
  roleIcon?: string | null;
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
        'flex min-w-[5rem] flex-1 flex-col items-center justify-center border rounded-lg sm:rounded-2xl lg:rounded-[20px] transition-all duration-200',
        'gap-1 py-2 px-1 sm:gap-2 sm:py-3 sm:px-2 md:gap-3 md:py-4 md:px-3 lg:gap-5 lg:py-5 lg:px-4',
        !disabled && 'cursor-pointer hover:scale-[1.01] active:scale-[0.98]',
        disabled && 'cursor-default',
        "bg-[#FAF2E4] dark:bg-[#0A0A0A] border-[#EACB8F] dark:border-[#47381E]",
        state === 'completed' && "bg-[#FAF2E4] dark:bg-[#0A0A0A] border-[#9CCC9E] dark:border-[#17251F]",
        state === 'completed' && isSelected && "bg-[#FAF2E4] dark:bg-[#0A0A0A] border-[#50A582] dark:border-[#2D5C48] shadow-[0_0_8px_0px_#186243] dark:shadow-[0_0_8px_0px_#297253]",
        state === 'today' && "bg-[#F7E6C5] dark:bg-[#241E15] border-[#EACB8F] dark:border-[#47381E]",
        state === 'today' && isSelected && "bg-[#F7E6C5] dark:bg-[#241E15] border-[#D7A042] dark:border-[#D7A042] shadow-[0_0_8px_0px_#D7A042] dark:shadow-[0_0_8px_0px_#D7A042]",
        state === 'makeup' && "bg-[#FAF2E4] dark:bg-[#0A0A0A] border-[#E98C8C] dark:border-[#402328]",
        state === 'makeup' && isSelected && "bg-[#FAF2E4] dark:bg-[#0A0A0A] border-[#E98C8C] dark:border-[#402328] shadow-[0_0_8px_0px_#9C4251] dark:shadow-[0_0_8px_0px_#9C4251]",
        state === 'future' && "bg-[#FAF2E4] dark:bg-[#0A0A0A] border-[#EACB8F] dark:border-[#47381E]",
        state === 'future' && isSelected && "bg-[#FAF2E4] dark:bg-[#0A0A0A] border-[#EACB8F] dark:border-[#47381E] shadow-[0_0_8px_0px_#D7A042] dark:shadow-[0_0_8px_0px_#D7A042]",
        state === 'missed' && "bg-[#FAF2E4] dark:bg-[#0A0A0A] border-[#E98C8C] dark:border-[#402328]",
        state === 'missed' && isSelected && "bg-[#FAF2E4] dark:bg-[#0A0A0A] border-[#E98C8C] dark:border-[#402328] shadow-[0_0_8px_0px_#9C4251] dark:shadow-[0_0_8px_0px_#9C4251]",
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
        <span className="sm:hidden">DAY {day}</span>
        <span className="hidden sm:inline">DAY {day}</span>
      </span>
      <DayRewardDisplay reward={reward} roleIcon={roleIcon} state={state} />
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
  const [makeupModal, setMakeupModal] = useState<CheckinMakeupConfirmModalData | null>(null);
  const [makeupSuccessModal, setMakeupSuccessModal] = useState<CheckinMakeupSuccessModalData | null>(null);
  const [roleMeta, setRoleMeta] = useState<Record<string, RoleMeta>>({});
  const closeRewardModal = useCallback(() => setRewardModal(null), []);
  const closeMakeupModal = useCallback(() => setMakeupModal(null), []);
  const closeMakeupSuccessModal = useCallback(() => setMakeupSuccessModal(null), []);
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

  useEffect(() => {
    const roleIds = [
      ...new Set(
        status?.daily_rewards
          .filter((r) => r.reward_type === 'role' && r.role_id)
          .map((r) => r.role_id as string),
      ),
    ];
    if (roleIds.length === 0) return;

    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        roleIds.map(async (roleId) => {
          try {
            const { data: roleInfo } = await supabase.functions.invoke('get-role-info', {
              body: { role_id: roleId },
            });
            if (roleInfo && !roleInfo.error) {
              const icon = roleInfo.icon || roleInfo.unicode_emoji;
              return [roleId, { icon: icon || undefined, name: roleInfo.name }] as const;
            }
          } catch {
            /* ignore */
          }
          return null;
        }),
      );

      if (!cancelled) {
        setRoleMeta((prev) => ({
          ...prev,
          ...Object.fromEntries(entries.filter(Boolean) as [string, RoleMeta][]),
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status?.daily_rewards]);

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

  const handleActionResult = (result: CheckinActionResult) => {
    if (result.ok === false) {
      const message = CHECKIN_ERROR_MESSAGES[result.error] ?? 'ไม่สามารถเช็คอินได้';
      toast.error(message);
      return;
    }

    setRewardModal(buildRewardModalData(result, selectedReward, roleMeta));

    if (result.big_reward_granted) {
      toast.success('ครบ 28 วัน! ได้รับรางวัลใหญ่แล้ว ✨');
    }
  };

  const openMakeupConfirmModal = () => {
    if (!selectedReward) return;
    const modalData: CheckinMakeupConfirmModalData = {
      type: selectedReward.reward_type,
      pointsAdded: selectedReward.reward_amount ?? undefined,
      makeupCost: selectedReward.makeup_cost ?? 50,
      dayNumber: selectedDay,
    };
    if (selectedReward.reward_type === 'role') {
      modalData.roleId = selectedReward.role_id ?? undefined;
      modalData.roleName = selectedReward.role_name ?? undefined;
      const meta = selectedReward.role_id ? roleMeta[selectedReward.role_id] : undefined;
      if (meta) {
        modalData.roleName = modalData.roleName ?? meta.name;
        modalData.roleIcon = meta.icon;
      }
    }
    setMakeupModal(modalData);
  };

  const handleMakeupConfirm = async () => {
    if (!makeupModal) return;
    const { dayNumber, makeupCost } = makeupModal;
    const result = await performMakeupCheckin(dayNumber, year, month);
    if (result.ok === false) {
      const message = CHECKIN_ERROR_MESSAGES[result.error] ?? 'ไม่สามารถเติมเช็คอินได้';
      toast.error(message);
      return;
    }
    setMakeupModal(null);
    const rewardData = buildRewardModalData(result, rewardsByDay.get(dayNumber), roleMeta);
    setMakeupSuccessModal({ ...rewardData, makeupCost });

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
      openMakeupConfirmModal();
      return;
    }
    if (selectedState === 'today') {
      const result = await performCheckin(selectedDay);
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

        <div className="flex flex-col gap-3 rounded-[20px] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5 sm:py-2.5 bg-[#FAF2E4] border-[#F4EEE5] dark:bg-[#0A0A0A] border dark:border-[#0A0A0A]">
          <div className="min-w-0 space-y-0.5">
            <p className="bear-h2-medium">
              <span
                className={cn(
                  "text-[#89654A] dark:text-[#E9E6E2]",
                  // TODO - Complete the styles for the different states
                  // isCompleted
                  //   ? 'text-[#51443A] dark:text-[#E9E6E2]'
                  //   : 'text-[#E9E6E2] dark:text-[hsl(var(--foreground)/0.9)]',
                )}
              >
                รางวัล
              </span>
              {rewardDetail && (
                <>
                  {' '}
                  <span
                    className={cn(
                      "text-[#9A7331] dark:text-[#D7A042]",
                    )}
                  >
                    {rewardDetail}
                  </span>
                  {' '}
                </>
              )}
              <span
                className={cn(
                  "text-[#89654A] dark:text-[#E9E6E2]",
                )}
              >
                รับเลย!
              </span>
            </p>
            <p
              className={cn(
                'bear-body-small-regular text-[#94735C] dark:text-[#9D8F7B]',
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
              className={cn(
                "bear-body-regular-medium rounded-full px-8 py-2 cursor-pointer border-2",
                "bg-[#C7EEC8] dark:bg-[#1E3A2F] border-[#9CCC9E] dark:border-[#2D5C48] text-[#89654A] dark:text-[#E9E6E2] disabled:bg-[#bedebf] dark:disabled:bg-[#0C1511] disabled:border-[#88ae89] dark:disabled:border-[#1E3A2F] disabled:text-[#a3c0a4] dark:disabled:text-[#1E3A2F]",
              )}
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

      {/* dev toggle reward modal */}
      {/* <Button onClick={() => setRewardModal({ type: 'points', pointsAdded: 100, message: 'ได้รับ 100 แต้ม' })}>Test Reward Modal</Button> */}
      {/* <Button onClick={() => setRewardModal({ type: 'ticket_point', pointsAdded: 100, message: 'ได้รับ 100 แต้ม' })}>Test Reward Modal</Button> */}
      {/* <Button onClick={() => setRewardModal({ type: 'ticket_piece_point', pointsAdded: 100, message: 'ได้รับ 100 แต้ม' })}>Test Reward Modal</Button> */}
      {/* <Button onClick={() => setRewardModal({ type: 'role', roleName: "test" })}>Test Reward Modal</Button> */}

      {/* dev toggle makeup modal */}
      {/* <Button onClick={openMakeupConfirmModal}>Test Makeup Modal</Button> */}

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
