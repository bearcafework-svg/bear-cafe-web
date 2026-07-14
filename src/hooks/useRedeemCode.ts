import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { RewardPopupData } from '@/components/bear-cafe/RewardPopup';
import {
  buildRedeemRewardPopupData,
  buildRewardMessage,
  REDEEM_ERROR_MESSAGES,
  type ResolvedRoleMeta,
} from '@/lib/redeem';
import { useInvalidateUserBalances } from '@/hooks/useUserBalances';

type RedeemStatus = 'idle' | 'loading' | 'success' | 'error';

export function useRedeemCode(discordId: string | null | undefined) {
  const invalidateBalances = useInvalidateUserBalances();
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemStatus, setRedeemStatus] = useState<RedeemStatus>('idle');
  const [rewardPopupOpen, setRewardPopupOpen] = useState(false);
  const [rewardPopup, setRewardPopup] = useState<RewardPopupData | null>(null);

  const grantDiscordRole = useCallback(
    async (roleId: string): Promise<boolean> => {
      if (!discordId) return false;

      try {
        const { data, error } = await supabase.functions.invoke('grant-discord-role', {
          body: {
            discordUserId: discordId,
            discordRoleId: roleId,
          },
        });

        if (error) {
          console.error('Failed to grant Discord role:', error);
          toast.error('ไม่สามารถแอดยศ Discord ได้ กรุณาติดต่อแอดมิน');
          return false;
        }

        if (data?.error) {
          console.error('Role grant error:', data.error);
          toast.error(data.message || 'ไม่สามารถแอดยศได้');
          return false;
        }

        return true;
      } catch (error) {
        console.error('Error calling grant-discord-role:', error);
        return false;
      }
    },
    [discordId],
  );

  const resolveRoleMeta = useCallback(async (roleId: string): Promise<ResolvedRoleMeta> => {
    let roleName: string | undefined;
    let roleEmoji: string | undefined;
    let roleColor: string | undefined;

    try {
      const { data: roleInfo } = await supabase.functions.invoke('get-role-info', {
        body: { role_id: roleId },
      });
      if (roleInfo && !roleInfo.error) {
        roleName = roleInfo.name;
        roleEmoji = roleInfo.icon || roleInfo.unicode_emoji || undefined;
        roleColor = roleInfo.color || undefined;
      }
    } catch {
      /* non-blocking */
    }

    if (!roleName) roleName = `ยศพิเศษ (${roleId.slice(-6)})`;
    if (!roleEmoji) roleEmoji = '🎭';

    return { roleName, roleEmoji, roleColor };
  }, []);

  const showError = useCallback((errorMsg: string) => {
    setRedeemStatus('error');
    setRewardPopup({ type: 'points', message: errorMsg });
    setRewardPopupOpen(true);
  }, []);

  const handleRedeem = useCallback(async () => {
    if (!discordId) {
      showError('ยังไม่พบข้อมูลผู้ใช้ในระบบ');
      return;
    }

    const trimmedCode = redeemCode.trim();
    if (!trimmedCode) {
      showError(REDEEM_ERROR_MESSAGES.missing_code);
      return;
    }

    setRedeemStatus('loading');

    try {
      const { data, error } = await supabase.functions.invoke('redeem-code', {
        body: { userId: discordId, code: trimmedCode },
      });

      if (error) throw error;

      if (!data.ok) {
        const errorKey = data.error || 'invalid_code';
        const errorMsg =
          REDEEM_ERROR_MESSAGES[errorKey as keyof typeof REDEEM_ERROR_MESSAGES] ||
          REDEEM_ERROR_MESSAGES.invalid_code;
        showError(errorMsg);
        return;
      }

      if (data.granted?.roleGranted) {
        await grantDiscordRole(data.granted.roleGranted);
      }

      let roleMeta: ResolvedRoleMeta = {};
      if (data.granted?.roleGranted) {
        roleMeta = await resolveRoleMeta(data.granted.roleGranted);
      }

      const rewardMessage = buildRewardMessage(data.granted);
      setRedeemStatus('success');
      setRewardPopup(
        buildRedeemRewardPopupData(data.granted, roleMeta, rewardMessage),
      );
      setRewardPopupOpen(true);
      setRedeemCode('');
      invalidateBalances(discordId);
    } catch {
      showError('ระบบขัดข้อง กรุณาลองใหม่');
    }
  }, [discordId, redeemCode, grantDiscordRole, resolveRoleMeta, showError, invalidateBalances]);

  const closeRewardPopup = useCallback((open: boolean) => {
    setRewardPopupOpen(open);
    if (!open) {
      setRewardPopup(null);
      setRedeemStatus('idle');
    }
  }, []);

  return {
    redeemCode,
    setRedeemCode,
    redeemStatus,
    isRedeeming: redeemStatus === 'loading',
    rewardPopupOpen,
    rewardPopup,
    handleRedeem,
    closeRewardPopup,
  };
}
