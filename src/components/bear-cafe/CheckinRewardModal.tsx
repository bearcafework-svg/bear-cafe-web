import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { CozyModalShell } from '@/components/bear-cafe/CozyModalShell';
import { StrawberryColorIcon, TearTicketColorIcon, TicketColorIcon } from '@/icon/outline';
import {
  formatCheckinRewardBalance,
  formatCheckinRewardGranted,
  type CheckinRewardType,
} from '@/lib/checkin';
import { CheckinRoleIcon } from '@/components/bear-cafe/CheckinRoleIcon';
import { MaskingTape } from './FeatureCardFrame';
import { useUserBalances } from '@/hooks/useUserBalances';
import { supabase } from '@/integrations/supabase/client';

export type CheckinRewardModalData = {
  type: CheckinRewardType;
  pointsAdded?: number;
  roleId?: string;
  roleName?: string;
  roleIcon?: string;
  message?: string;
};

function RewardIcon({ type, roleIcon }: { type: CheckinRewardType; roleIcon?: string | null }) {
  switch (type) {
    case 'points':
      return <StrawberryColorIcon size={{ mobile: 48, desktop: 64 }} />;
    case 'ticket_point':
      return <TicketColorIcon size={{ mobile: 48, desktop: 64 }} />;
    case 'ticket_piece_point':
      return <TearTicketColorIcon size={{ mobile: 48, desktop: 64 }} />;
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

function balanceForType(
  balances: { points: number; ticketPoint: number; ticketPiecePoint: number },
  type: CheckinRewardType,
): number | null {
  switch (type) {
    case 'points':
      return balances.points;
    case 'ticket_point':
      return balances.ticketPoint;
    case 'ticket_piece_point':
      return balances.ticketPiecePoint;
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
  const { points, ticketPoint, ticketPiecePoint, loading, refetch } = useUserBalances(
    reward ? user?.discord_id : null,
  );
  const [roleDisplay, setRoleDisplay] = useState<{ name?: string; icon?: string } | null>(null);

  useEffect(() => {
    if (reward) void refetch();
  }, [reward, refetch]);

  // Lazy fallback: parent usually preloads role meta via useCheckinFlow
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
        /* non-blocking */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reward]);

  if (!reward) return null;

  const showBalance = reward.type !== 'role';
  const currentBalance = balanceForType(
    { points, ticketPoint, ticketPiecePoint },
    reward.type,
  );

  return (
    <CozyModalShell
      open={Boolean(reward)}
      onClose={onClose}
      titleId="checkin-reward-title"
      buttonLabel="กลับไปหน้าคาเฟ่เลย"
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
            {loading || currentBalance === null
              ? '...'
              : formatCheckinRewardBalance(reward.type, currentBalance)}
          </p>
        </div>
      )}
    </CozyModalShell>
  );
}
