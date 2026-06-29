import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { StrawberryColorIcon, TearTicketColorIcon, TicketColorIcon } from '@/icon/outline';
import {
  formatCheckinRewardBalance,
  formatCheckinRewardGranted,
  type CheckinRewardType,
} from '@/lib/checkin';
import { CheckinRoleIcon } from '@/components/bear-cafe/CheckinRoleIcon';
import { MaskingTape } from './FeatureCardFrame';

export type CheckinRewardModalData = {
  type: CheckinRewardType;
  pointsAdded?: number;
  roleId?: string;
  roleName?: string;
  roleIcon?: string;
  message?: string;
};

type UserBalances = {
  points: number;
  ticket_point: number;
  ticket_piece_point: number;
};

function RewardIcon({ type, roleIcon }: { type: CheckinRewardType; roleIcon?: string | null }) {
  switch (type) {
    case 'points':
      return (
        <StrawberryColorIcon size={{ mobile: 48, desktop: 64 }} />
      );
    case 'ticket_point':
      return (
        <TicketColorIcon size={{ mobile: 48, desktop: 64 }} />
      );
    case 'ticket_piece_point':
      return (
        <TearTicketColorIcon size={{ mobile: 48, desktop: 64 }} />
      );
    case 'role':
      return (
        <CheckinRoleIcon
          roleIcon={roleIcon}
          size={{ mobile: 48, desktop: 64 }}
          className="h-12 w-12 sm:h-16 sm:w-16"
        />
      );
    default:
      return null;
  }
}

function balanceForType(balances: UserBalances, type: CheckinRewardType): number | null {
  switch (type) {
    case 'points':
      return balances.points;
    case 'ticket_point':
      return balances.ticket_point;
    case 'ticket_piece_point':
      return balances.ticket_piece_point;
    default:
      return null;
  }
}

interface CheckinRewardModalProps {
  reward: CheckinRewardModalData | null;
  onClose: () => void;
}

export function CheckinRewardModal({ reward, onClose }: CheckinRewardModalProps) {
  const { user } = useAuth();
  const [balances, setBalances] = useState<UserBalances | null>(null);
  const [roleDisplay, setRoleDisplay] = useState<{ name?: string; icon?: string } | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!user?.discord_id) {
      setBalances({ points: 0, ticket_point: 0, ticket_piece_point: 0 });
      return;
    }

    const { data } = await supabase
      .from('user_points')
      .select('points, ticket_point, ticket_piece_point')
      .eq('discord_id', user.discord_id)
      .maybeSingle();

    const row = data as {
      points?: number;
      ticket_point?: number;
      ticket_piece_point?: number;
    } | null;

    setBalances({
      points: row?.points ?? 0,
      ticket_point: row?.ticket_point ?? 0,
      ticket_piece_point: row?.ticket_piece_point ?? 0,
    });
  }, [user?.discord_id]);

  useEffect(() => {
    if (!reward) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    void fetchBalances();

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [reward, onClose, fetchBalances]);

  useEffect(() => {
    if (!reward || reward.type !== 'role') {
      setRoleDisplay(null);
      return;
    }

    if (reward.roleName || reward.roleIcon) {
      setRoleDisplay({
        name: reward.roleName,
        icon: reward.roleIcon,
      });
    }

    if (!reward.roleId || (reward.roleName && reward.roleIcon)) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const { data: roleInfo } = await supabase.functions.invoke('get-role-info', {
          body: { role_id: reward.roleId },
        });
        if (!cancelled && roleInfo && !roleInfo.error) {
          setRoleDisplay({
            name: reward.roleName ?? roleInfo.name,
            icon: reward.roleIcon ?? roleInfo.icon ?? roleInfo.unicode_emoji ?? undefined,
          });
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reward]);

  if (!reward || typeof document === 'undefined') return null;

  const showBalance = reward.type !== 'role';
  const currentBalance = balances ? balanceForType(balances, reward.type) : null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="ปิด"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkin-reward-title"
        className={cn(
          'relative z-10 flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl border-2 p-5 sm:gap-5 md:p-7',
          'bg-[#FDFAF7] border-[#F4EEE5]',
          'dark:bg-[#121212] dark:border-[#51443A]',
          'animate-in fade-in zoom-in-95 duration-200',
        )}
      >
        <MaskingTape color="brown" rotate={-1} width={120} position={0} />
        <p
          id="checkin-reward-title"
          className="bear-h3-bold text-[hsl(var(--mocha))] md:bear-h2-bold dark:text-[#E9E6E2]"
        >
          รับรางวัลสำเร็จ!
        </p>

        <div className="flex items-center justify-center gap-3 py-4 px-3">
          <RewardIcon type={reward.type} roleIcon={reward.roleIcon ?? roleDisplay?.icon} />
          {reward.type === 'role' ? (
            <p className="bear-body-small-medium text-[hsl(var(--mocha))] md:bear-h1-medium dark:text-[#E9E6E2]">
              {reward.roleName ?? roleDisplay?.name ?? 'Discord Role'}
            </p>
          ) : reward.pointsAdded !== undefined ? (
            <p className="bear-h1-medium text-[#D7A042] md:bear-h1-medium dark:text-[hsl(var(--honey))]">
              {formatCheckinRewardGranted(reward.type, reward.pointsAdded)}
            </p>
          ) : null}
        </div>

        {showBalance && (
          <div className="flex w-full items-center justify-between gap-3">
            <p className="bear-body-small-medium text-[#51443A] md:bear-body-regular-medium dark:text-[#E9E6E2]">
              ยอดสะสมปัจจุบัน
            </p>
            <p className="bear-body-small-medium text-[hsl(var(--mocha))] md:bear-body-regular-medium dark:text-[#E9E6E2]">
              {currentBalance !== null
                ? formatCheckinRewardBalance(reward.type, currentBalance)
                : '...'}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className={cn(
            'w-full rounded-full border px-8 py-2 bear-body-small-medium sm:w-auto md:bear-body-regular-medium',
            'bg-[#FAF2E4] border-[#EACB8F] text-[#46362A]',
            'hover:bg-[#F7E6C5] hover:border-[#D7A042]',
            'dark:bg-[#242424] dark:border-[#51443A] dark:text-[#E9E6E2]',
            'dark:hover:bg-[#333333] dark:hover:border-[#51443A]',
            'transition-all duration-200',
          )}
        >
          กลับไปหน้าคาเฟ่เลย
        </button>
      </div>
    </div>,
    document.body,
  );
}
