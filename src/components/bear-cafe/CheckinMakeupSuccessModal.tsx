import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { StrawberryColorIcon, TearTicketColorIcon, TicketColorIcon } from '@/icon/outline';
import {
  formatCheckinMakeupCost,
  formatCheckinRewardBalance,
  formatCheckinRewardGranted,
  type CheckinRewardType,
} from '@/lib/checkin';
import { MaskingTape } from './FeatureCardFrame';
import { TeaBagColorIcon } from '@/icon/outline/TeaBagColorIcon';

export type CheckinMakeupSuccessModalData = {
  type: CheckinRewardType;
  pointsAdded?: number;
  makeupCost: number;
  roleId?: string;
  roleName?: string;
  roleIcon?: string;
};

type UserBalances = {
  points: number;
  ticket_point: number;
  ticket_piece_point: number;
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
      return <TeaBagColorIcon size={{ mobile: 48, desktop: 64 }} />;
    default:
      return null;
  }
}

interface CheckinMakeupSuccessModalProps {
  data: CheckinMakeupSuccessModalData | null;
  onClose: () => void;
}

export function CheckinMakeupSuccessModal({ data, onClose }: CheckinMakeupSuccessModalProps) {
  const { user } = useAuth();
  const [balances, setBalances] = useState<UserBalances | null>(null);
  const [roleDisplay, setRoleDisplay] = useState<{ name?: string; icon?: string } | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!user?.discord_id) {
      setBalances({ points: 0, ticket_point: 0, ticket_piece_point: 0 });
      return;
    }

    const { data: row } = await supabase
      .from('user_points')
      .select('points, ticket_point, ticket_piece_point')
      .eq('discord_id', user.discord_id)
      .maybeSingle();

    const typed = row as {
      points?: number;
      ticket_point?: number;
      ticket_piece_point?: number;
    } | null;

    setBalances({
      points: typed?.points ?? 0,
      ticket_point: typed?.ticket_point ?? 0,
      ticket_piece_point: typed?.ticket_piece_point ?? 0,
    });
  }, [user?.discord_id]);

  useEffect(() => {
    if (!data) return;

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
  }, [data, onClose, fetchBalances]);

  useEffect(() => {
    if (!data || data.type !== 'role') {
      setRoleDisplay(null);
      return;
    }

    if (data.roleName || data.roleIcon) {
      setRoleDisplay({ name: data.roleName, icon: data.roleIcon });
    }

    if (!data.roleId || (data.roleName && data.roleIcon)) return;

    let cancelled = false;
    void (async () => {
      try {
        const { data: roleInfo } = await supabase.functions.invoke('get-role-info', {
          body: { role_id: data.roleId },
        });
        if (!cancelled && roleInfo && !roleInfo.error) {
          setRoleDisplay({
            name: data.roleName ?? roleInfo.name,
            icon: data.roleIcon ?? roleInfo.icon ?? roleInfo.unicode_emoji ?? undefined,
          });
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [data]);

  if (!data || typeof document === 'undefined') return null;

  const currentPoints = balances?.points ?? null;

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
        aria-labelledby="checkin-makeup-success-title"
        className={cn(
          'relative z-10 flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl border-2 p-5 sm:gap-5 md:p-7',
          'bg-[#FDFAF7] border-[#F4EEE5]',
          'dark:bg-[#121212] dark:border-[#51443A]',
          'animate-in fade-in zoom-in-95 duration-200',
        )}
      >
        <MaskingTape color="brown" rotate={-1} width={120} position={0} />
        <p
          id="checkin-makeup-success-title"
          className="bear-h3-bold text-[hsl(var(--mocha))] md:bear-h2-bold dark:text-[#E9E6E2]"
        >
          รับรางวัลสำเร็จ!
        </p>

        <div className="flex items-center justify-center gap-3 py-4 px-3">
          <RewardIcon type={data.type} roleIcon={data.roleIcon ?? roleDisplay?.icon} />
          {data.type === 'role' ? (
            <p className="bear-body-small-medium text-[hsl(var(--mocha))] md:bear-h1-medium dark:text-[#E9E6E2]">
              {data.roleName ?? roleDisplay?.name ?? 'Discord Role'}
            </p>
          ) : data.pointsAdded !== undefined ? (
            <p className="bear-h1-medium text-[#D7A042] md:bear-h1-medium dark:text-[hsl(var(--honey))]">
              {formatCheckinRewardGranted(data.type, data.pointsAdded)}
            </p>
          ) : null}
        </div>

        <div className="flex w-full flex-col gap-2">
          <div className="flex w-full items-center justify-between gap-3">
            <p className="bear-body-small-medium text-[#51443A] md:bear-body-regular-medium dark:text-[#E9E6E2]">
              ใช้แต้มสำหรับรับย้อนหลัง
            </p>
            <p className="bear-body-small-medium text-[hsl(var(--mocha))] md:bear-body-regular-medium dark:text-[#E9E6E2]">
              {formatCheckinMakeupCost(data.makeupCost)}
            </p>
          </div>
          <div className="flex w-full items-center justify-between gap-3">
            <p className="bear-body-small-medium text-[#51443A] md:bear-body-regular-medium dark:text-[#E9E6E2]">
              ยอดสะสมปัจจุบัน
            </p>
            <p className="bear-body-small-medium text-[hsl(var(--mocha))] md:bear-body-regular-medium dark:text-[#E9E6E2]">
              {currentPoints !== null
                ? formatCheckinRewardBalance('points', currentPoints)
                : '...'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className={cn(
            'w-full rounded-full border px-8 py-2 bear-body-small-medium md:bear-body-regular-medium',
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
