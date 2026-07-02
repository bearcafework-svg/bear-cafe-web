import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { cn, formatNumber } from '@/lib/utils';
import { StrawberryColorIcon, TearTicketColorIcon, TicketColorIcon } from '@/icon/outline';
import {
  formatCheckinMakeupCost,
  formatCheckinRewardBalance,
  formatCheckinRewardGranted,
  type CheckinRewardType,
} from '@/lib/checkin';
import { CheckinRoleIcon } from '@/components/bear-cafe/CheckinRoleIcon';
import { MaskingTape } from './FeatureCardFrame';
import { Loader2 } from 'lucide-react';

export type CheckinMakeupConfirmModalData = {
  type: CheckinRewardType;
  pointsAdded?: number;
  makeupCost: number;
  roleId?: string;
  roleName?: string;
  roleIcon?: string;
  dayNumber: number;
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

interface CheckinMakeupConfirmModalProps {
  data: CheckinMakeupConfirmModalData | null;
  confirming?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function CheckinMakeupConfirmModal({
  data,
  confirming = false,
  onConfirm,
  onClose,
}: CheckinMakeupConfirmModalProps) {
  const { user } = useAuth();
  const [balances, setBalances] = useState<UserBalances | null>(null);

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
      if (e.key === 'Escape' && !confirming) onClose();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    void fetchBalances();

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [data, onClose, fetchBalances, confirming]);

  if (!data || typeof document === 'undefined') return null;

  const currentPoints = balances?.points ?? null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="ปิด"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={confirming ? undefined : onClose}
        disabled={confirming}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkin-makeup-title"
        className={cn(
          'relative z-10 flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl border-2 p-5 sm:gap-5 md:p-7',
          'bg-[#FDFAF7] border-[#F4EEE5]',
          'dark:bg-[#121212] dark:border-[#51443A]',
          'animate-in fade-in zoom-in-95 duration-200',
        )}
      >
        <MaskingTape color="brown" rotate={-1} width={120} position={0} />
        <p
          id="checkin-makeup-title"
          className="bear-h3-bold text-[hsl(var(--mocha))] md:bear-h2-bold dark:text-[#E9E6E2]"
        >
          ยืนยันเติมเช็กอิน
        </p>

        <div className="flex items-center justify-center gap-3 py-4 px-3">
          <RewardIcon type={data.type} roleIcon={data.roleIcon} />
          {data.type === 'role' ? (
            <p className="bear-body-small-medium text-[hsl(var(--mocha))] md:bear-h1-medium dark:text-[#E9E6E2]">
              {data.roleName ?? 'Discord Role'}
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

        <div className="flex w-full flex-col items-center gap-3">
          <button
            type="button"
            disabled={confirming}
            onClick={onConfirm}
            className={cn(
              'w-full rounded-full border px-8 py-2 bear-body-small-medium md:bear-body-regular-medium',
              'bg-[#C7EEC8] border-[#9CCC9E] text-[#89654A]',
              'dark:bg-[#1E3A2F] dark:border-[#2D5C48] dark:text-[#E9E6E2]',
              'dark:hover:bg-[#2D5C48] dark:hover:border-[#2D5C48]',
              'disabled:opacity-60 disabled:cursor-not-allowed',
              'transition-all duration-200',
            )}
          >
            {confirming ? (
              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
            ) : (
              `ยืนยันใช้ ${formatNumber(data.makeupCost)} แต้มรับย้อนหลัง`
            )}
          </button>
          <button
            type="button"
            disabled={confirming}
            onClick={onClose}
            className="bear-body-small-medium text-[hsl(var(--mocha))] dark:text-[#E9E6E2] hover:underline disabled:opacity-60"
          >
            กลับไปหน้าคาเฟ่เลย
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
