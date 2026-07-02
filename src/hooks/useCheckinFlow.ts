import { useCallback, useEffect, useMemo, useState } from 'react';
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
  type RoleMeta,
} from '@/lib/checkin-modal-data';
import { supabase } from '@/integrations/supabase/client';
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
  const { isAuthenticated } = useAuth();
  const { status, loading, acting, performCheckin, performMakeupCheckin } = useCheckin(discordId);
  const invalidateBalances = useInvalidateUserBalances();

  const [rewardModal, setRewardModal] = useState<CheckinRewardModalData | null>(null);
  const [makeupModal, setMakeupModal] = useState<CheckinMakeupConfirmModalData | null>(null);
  const [makeupSuccessModal, setMakeupSuccessModal] = useState<CheckinMakeupSuccessModalData | null>(null);
  const [roleMeta, setRoleMeta] = useState<Record<string, RoleMeta>>({});

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

  // Prefetch Discord role icons/names for reward display
  useEffect(() => {
    const roleIds = [
      ...new Set(
        status?.daily_rewards
          .filter((r) => r.reward_type === 'role' && r.role_id)
          .map((r) => r.role_id as string),
      ),
    ];
    if (includeBigRewardRole && status?.big_reward?.role_id) {
      roleIds.push(status.big_reward.role_id);
    }
    const uniqueRoleIds = [...new Set(roleIds)];
    if (uniqueRoleIds.length === 0) return;

    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        uniqueRoleIds.map(async (roleId) => {
          try {
            const { data: roleInfo } = await supabase.functions.invoke('get-role-info', {
              body: { role_id: roleId },
            });
            if (roleInfo && !roleInfo.error) {
              const icon = roleInfo.icon || roleInfo.unicode_emoji;
              return [roleId, { icon: icon || undefined, name: roleInfo.name }] as const;
            }
          } catch {
            /* non-blocking */
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
  }, [status?.daily_rewards, status?.big_reward?.role_id, includeBigRewardRole]);

  const handleActionResult = useCallback(
    (result: CheckinActionResult, selectedReward: CheckinDailyReward | undefined) => {
      if (result.ok === false) {
        const message = CHECKIN_ERROR_MESSAGES[result.error] ?? 'ไม่สามารถเช็กอินได้';
        toast.error(message);
        return;
      }

      setRewardModal(buildRewardModalData(result, selectedReward, roleMeta));
      invalidateBalances(discordId);

      if (result.reward && 'role_grant_error' in result.reward) {
        toast.error('เช็กอินสำเร็จแล้ว แต่ไม่สามารถมอบ Role ได้ กรุณาติดต่อแอดมิน');
      }

      if (result.big_reward_granted) {
        toast.success('ครบ 28 วัน! ได้รับรางวัลใหญ่แล้ว ✨');
      }
    },
    [roleMeta, invalidateBalances, discordId],
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
  }, [makeupModal, performMakeupCheckin, year, month, rewardsByDay, roleMeta, invalidateBalances, discordId]);

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
