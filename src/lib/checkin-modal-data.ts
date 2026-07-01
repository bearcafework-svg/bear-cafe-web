import type { CheckinActionResult } from '@/hooks/useCheckin';
import { REWARD_TYPE_LABELS, type CheckinDailyReward } from '@/lib/checkin';
import { formatNumber } from '@/lib/utils';
import type { CheckinRewardModalData } from '@/components/bear-cafe/CheckinRewardModal';
import type { CheckinMakeupConfirmModalData } from '@/components/bear-cafe/CheckinMakeupConfirmModal';

export type RoleMeta = { icon?: string; name?: string };

export function buildMakeupModalData(
  selectedReward: CheckinDailyReward,
  selectedDay: number,
  roleMeta: Record<string, RoleMeta>,
): CheckinMakeupConfirmModalData {
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

  return modalData;
}

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
    message: `ได้รับ ${formatNumber(amount)} ${label}`,
  };
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
    message: `ได้รับ ${formatNumber(amount)} ${label}`,
  };
}

export function buildRewardModalData(
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
