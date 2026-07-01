import { useCallback, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { IconDisplay } from '@/components/bear-cafe/IconDisplay';
import { MaskingTape } from '@/components/bear-cafe/FeatureCardFrame';
import { CozyModalShell, COZY_MODAL_BUTTON } from '@/components/bear-cafe/CozyModalShell';
import { StrawberryColorIcon } from '@/icon/outline';
import { useUserBalances } from '@/hooks/useUserBalances';
import { getRedeemErrorInfo, isRedeemErrorMessage } from '@/lib/redeem';
import { formatNumber } from '@/lib/utils';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Lock,
  ShieldAlert,
  XCircle,
} from 'lucide-react';

export type RewardPopupData = {
  type: 'points' | 'role' | 'both';
  pointsAdded?: number;
  roleName?: string;
  roleEmoji?: string;
  roleColor?: string;
  message?: string;
};

interface RewardPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reward: RewardPopupData | null;
}

const ERROR_ICONS: Record<string, React.ReactNode> = {
  'โค้ดหมดอายุแล้ว': <Clock className="w-7 h-7" />,
  'ยังไม่ถึงเวลาใช้งาน': <Clock className="w-7 h-7" />,
  'โค้ดถูกใช้แล้ว': <Ban className="w-7 h-7" />,
  'ใช้โค้ดนี้แล้ว': <CheckCircle2 className="w-7 h-7" />,
  'โค้ดถูกใช้ครบแล้ว': <ShieldAlert className="w-7 h-7" />,
  'โค้ดถูกปิดใช้งาน': <Lock className="w-7 h-7" />,
  'ไม่พบโค้ดนี้': <XCircle className="w-7 h-7" />,
  'โค้ดมีปัญหา': <AlertTriangle className="w-7 h-7" />,
  'ยังไม่ได้กรอกโค้ด': <AlertTriangle className="w-7 h-7" />,
  'เกิดข้อผิดพลาด': <AlertTriangle className="w-7 h-7" />,
  'ไม่พบข้อมูลผู้ใช้': <AlertTriangle className="w-7 h-7" />,
};

export function RewardPopup({ open, onOpenChange, reward }: RewardPopupProps) {
  const { user } = useAuth();
  const { points, loading, refetch } = useUserBalances(open && reward ? user?.discord_id : null);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const showPointsReward =
    open &&
    reward &&
    (reward.type === 'points' || reward.type === 'both') &&
    reward.pointsAdded !== undefined;

  useEffect(() => {
    if (showPointsReward) void refetch();
  }, [showPointsReward, refetch]);

  if (!open || !reward) return null;

  const showPoints = reward.type === 'points' || reward.type === 'both';

  // Error detection uses Thai keyword substring match (not error codes)
  const errorInfo = isRedeemErrorMessage(reward) ? getRedeemErrorInfo(reward.message) : null;

  if (errorInfo) {
    return (
      <CozyModalShell open={open} onClose={handleClose} titleId="reward-popup-error-title">
        <MaskingTape color="brown" rotate={-1} width={120} position={0} />

        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--latte)/0.5)] text-[hsl(var(--mocha))] dark:bg-[hsl(var(--coffee)/0.35)] dark:text-[#E9E6E2]">
          {ERROR_ICONS[errorInfo.title] ?? <AlertTriangle className="w-7 h-7" />}
        </div>

        <p
          id="reward-popup-error-title"
          className="bear-h3-bold text-center text-[hsl(var(--mocha))] md:bear-h2-bold dark:text-[#E9E6E2]"
        >
          {errorInfo.title}
        </p>

        <p className="bear-body-small-regular text-center text-[#51443A] dark:text-[#A1A1A1]">
          {reward.message}
        </p>

        <button type="button" onClick={handleClose} className={COZY_MODAL_BUTTON}>
          เข้าใจแล้ว
        </button>
      </CozyModalShell>
    );
  }

  const showRole = reward.type === 'role' || reward.type === 'both';

  return (
    <CozyModalShell open={open} onClose={handleClose} titleId="reward-popup-success-title">
      <MaskingTape color="brown" rotate={-1} width={120} position={0} />

      <p
        id="reward-popup-success-title"
        className="bear-h3-bold text-[hsl(var(--mocha))] md:bear-h2-bold dark:text-[#E9E6E2]"
      >
        รับรางวัลสำเร็จ!
      </p>

      {showPoints && reward.pointsAdded !== undefined && (
        <div className="flex w-full items-center justify-center gap-3 px-3 py-2">
          <StrawberryColorIcon size={{ mobile: 48, desktop: 64 }} />
          <p className="bear-h1-medium text-[#D7A042] dark:text-[hsl(var(--honey))]">
            + {formatNumber(reward.pointsAdded)} สตรอว์เบอร์รี่
          </p>
        </div>
      )}

      {showRole && (
        <div className="flex w-full items-center justify-center gap-3 px-3 py-2">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center sm:h-16 sm:w-16">
            <IconDisplay icon={reward.roleEmoji} fallback="🎭" size="xl" />
          </div>
          <p
            className="bear-body-small-medium text-[hsl(var(--mocha))] md:bear-h1-medium dark:text-[#E9E6E2]"
            style={reward.roleColor ? { color: reward.roleColor } : undefined}
          >
            {reward.roleName || 'ยศพิเศษ'}
          </p>
        </div>
      )}

      {showPoints && reward.pointsAdded !== undefined && (
        <div className="flex w-full items-center justify-between gap-3">
          <p className="bear-body-small-medium text-[#51443A] md:bear-body-regular-medium dark:text-[#E9E6E2]">
            ยอดสะสมปัจจุบัน
          </p>
          <p className="bear-body-small-medium text-[hsl(var(--mocha))] md:bear-body-regular-medium dark:text-[#E9E6E2]">
            {loading ? '...' : `${formatNumber(points)} สตรอว์เบอร์รี่`}
          </p>
        </div>
      )}

      <button type="button" onClick={handleClose} className={COZY_MODAL_BUTTON}>
        เยี่ยมเลย!
      </button>
    </CozyModalShell>
  );
}
