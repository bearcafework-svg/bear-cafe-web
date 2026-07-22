import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useCheckin, type CheckinActionResult } from '@/hooks/useCheckin';
import type { CheckinRewardModalData } from '@/components/bear-cafe/CheckinRewardModal';
import type { CheckinMakeupConfirmModalData } from '@/components/bear-cafe/CheckinMakeupConfirmModal';
import type { CheckinMakeupSuccessModalData } from '@/components/bear-cafe/CheckinMakeupSuccessModal';
import {
  CHECKIN_ERROR_MESSAGES,
  getCheckinToday,
  type CheckinDailyReward,
  type CheckinDayState,
} from '@/lib/checkin';
import {
  buildMakeupModalData,
  buildRewardModalData,
} from '@/lib/checkin-modal-data';
import {
  checkinStatusQueryKey,
  needsCheckinStatusReconcile,
} from '@/lib/checkin-status-cache';
import { useRoleInfo } from '@/hooks/useRoleInfo';
import { toast } from 'sonner';
import { useInvalidateUserBalances } from '@/hooks/useUserBalances';

interface UseCheckinFlowOptions {
  /** Include big_reward role in meta prefetch. Defaults to true. */
  includeBigRewardRole?: boolean;
}

export function useCheckinFlow(
  discordId: string | null | undefined,
  options: UseCheckinFlowOptions = {},
) {
  const { includeBigRewardRole = true } = options;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const { status, loading, acting, performCheckin, performMakeupCheckin } = useCheckin(discordId);
  const invalidateBalances = useInvalidateUserBalances();

  const [rewardModal, setRewardModal] = useState<CheckinRewardModalData | null>(null);
  const [makeupModal, setMakeupModal] = useState<CheckinMakeupConfirmModalData | null>(null);
  const [makeupSuccessModal, setMakeupSuccessModal] = useState<CheckinMakeupSuccessModalData | null>(null);

  const { year, month, day: todayDay } = getCheckinToday();

  const closeRewardModal = useCallback(() => setRewardModal(null), []);
  const closeMakeupModal = useCallback(() => setMakeupModal(null), []);
  const closeMakeupSuccessModal = useCallback(() => setMakeupSuccessModal(null), []);

  const completedDays = useMemo(() => {
    if (!status) return new Set<number>();
    return new Set([...status.cycle.completed_days, ...status.cycle.makeup_days]);
  }, [status]);

  const rewardsByDay = useMemo(() => {
    const map = new Map<number, CheckinDailyReward>();
    status?.daily_rewards.forEach((reward) => map.set(reward.day_number, reward));
    return map;
  }, [status]);

  // FR-6: RQ-by-role_id progressive fill — claim not gated on icons (AC-FE-012–013)
  const roleIdsForMeta = useMemo(() => {
    const ids =
      status?.daily_rewards
        .filter((r) => r.reward_type === 'role' && r.role_id)
        .map((r) => r.role_id as string) ?? [];
    if (includeBigRewardRole && status?.big_reward?.role_id) {
      ids.push(status.big_reward.role_id);
    }
    return ids;
  }, [status?.daily_rewards, status?.big_reward?.role_id, includeBigRewardRole]);

  const roleMeta = useRoleInfo(roleIdsForMeta);
  const scheduleMvpReconcile = useCallback(
    (result: Extract<CheckinActionResult, { ok: true }>) => {
      if (!discordId || !needsCheckinStatusReconcile(result)) return;
      const gate =
        result.big_reward_granted === true ? 'big_reward_granted' : 'role_grant_error';
      // Design Doc § Logging — gate name only; never tokens/session
      console.info('checkin status reconcile', { gate });
      void queryClient.refetchQueries({ queryKey: checkinStatusQueryKey(discordId) });
    },
    [discordId, queryClient],
  );

  const handleActionResult = useCallback(
    (result: CheckinActionResult, selectedReward: CheckinDailyReward | undefined) => {
      if (result.ok === false) {
        const message = CHECKIN_ERROR_MESSAGES[result.error] ?? 'ไม่สามารถเช็กอินได้';
        toast.error(message);
        return;
      }

      // Success UI first (modal + toasts + balances) — reconcile is non-blocking (D003 / AC-FE-006)
      setRewardModal(buildRewardModalData(result, selectedReward, roleMeta));
      invalidateBalances(discordId);

      if (result.reward && 'role_grant_error' in result.reward) {
        toast.error('เช็กอินสำเร็จแล้ว แต่ไม่สามารถมอบ Role ได้ กรุณาติดต่อแอดมิน');
      }

      if (result.big_reward_granted) {
        toast.success('ครบ 28 วัน! ได้รับรางวัลใหญ่แล้ว ✨');
      }

      scheduleMvpReconcile(result);
    },
    [roleMeta, invalidateBalances, discordId, scheduleMvpReconcile],
  );

  const openMakeupConfirmModal = useCallback(
    (selectedReward: CheckinDailyReward, selectedDay: number) => {
      setMakeupModal(buildMakeupModalData(selectedReward, selectedDay, roleMeta));
    },
    [roleMeta],
  );

  const handleMakeupConfirm = useCallback(async () => {
    if (!makeupModal) return;
    const { dayNumber } = makeupModal;
    const result = await performMakeupCheckin(dayNumber, year, month);
    if (result.ok === false) {
      const message = CHECKIN_ERROR_MESSAGES[result.error] ?? 'ไม่สามารถเติมเช็กอินได้';
      toast.error(message);
      return;
    }

    setMakeupModal(null);
    const rewardData = buildRewardModalData(result, rewardsByDay.get(dayNumber), roleMeta);
    setMakeupSuccessModal({ ...rewardData, makeupCost: makeupModal.makeupCost });
    invalidateBalances(discordId);

    if (result.reward && 'role_grant_error' in result.reward) {
      toast.error('เติมเช็กอินสำเร็จแล้ว แต่ไม่สามารถมอบ Role ได้ กรุณาติดต่อแอดมิน');
    }

    if (result.big_reward_granted) {
      toast.success('ครบ 28 วัน! ได้รับรางวัลใหญ่แล้ว ✨');
    }

    scheduleMvpReconcile(result);
  }, [
    makeupModal,
    performMakeupCheckin,
    year,
    month,
    rewardsByDay,
    roleMeta,
    invalidateBalances,
    discordId,
    scheduleMvpReconcile,
  ]);

  const handleClaimSelected = useCallback(
    async (
      selectedDay: number,
      selectedState: CheckinDayState,
      selectedReward: CheckinDailyReward | undefined,
    ) => {
      if (!isAuthenticated) {
        navigate('/login');
        return;
      }
      if (selectedState === 'makeup') {
        if (!selectedReward) return;
        openMakeupConfirmModal(selectedReward, selectedDay);
        return;
      }
      if (selectedState === 'today') {
        const result = await performCheckin(selectedDay);
        handleActionResult(result, selectedReward);
      }
    },
    [isAuthenticated, navigate, openMakeupConfirmModal, performCheckin, handleActionResult],
  );

  return {
    status,
    loading,
    acting,
    todayDay,
    completedDays,
    rewardsByDay,
    bigReward: status?.big_reward ?? null,
    bigRewardClaimed: status?.cycle.big_reward_claimed ?? false,
    roleMeta,
    rewardModal,
    makeupModal,
    makeupSuccessModal,
    closeRewardModal,
    closeMakeupModal,
    closeMakeupSuccessModal,
    handleClaimSelected,
    handleMakeupConfirm,
  };
}
