import {
  StrawberryColorIcon,
  TearTicketColorIcon,
  TicketColorIcon,
} from '@/icon/outline';
import { CheckinRoleIcon } from '@/components/bear-cafe/CheckinRoleIcon';
import {
  formatCheckinRewardGranted,
  type CheckinBigReward,
  type CheckinRewardType,
} from '@/lib/checkin';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

const ICON_SIZE = { mobile: 40, desktop: 48 };

function RewardIcon({
  type,
  roleIcon,
}: {
  type: CheckinRewardType;
  roleIcon?: string | null;
}) {
  switch (type) {
    case 'points':
      return <StrawberryColorIcon size={ICON_SIZE} />;
    case 'ticket_point':
      return <TicketColorIcon size={ICON_SIZE} />;
    case 'ticket_piece_point':
      return <TearTicketColorIcon size={ICON_SIZE} />;
    case 'role':
      return (
        <CheckinRoleIcon
          roleIcon={roleIcon}
          size={ICON_SIZE}
          className="h-10 w-10 sm:h-12 sm:w-12"
        />
      );
    default:
      return null;
  }
}

interface CheckinBigRewardPreviewProps {
  bigReward: CheckinBigReward | null | undefined;
  completedDays: number;
  claimed?: boolean;
  roleIcon?: string | null;
  roleName?: string | null;
  compact?: boolean;
  className?: string;
}

export function CheckinBigRewardPreview({
  bigReward,
  completedDays,
  claimed = false,
  roleIcon,
  roleName,
  compact = false,
  className,
}: CheckinBigRewardPreviewProps) {
  const progress = Math.min(completedDays, 28);
  const progressPct = (progress / 28) * 100;

  if (!bigReward) {
    return (
      <div
        className={cn(
          'rounded-[20px] border border-[#F4EEE5] bg-[#FAF2E4] px-3 py-3 dark:border-[#242424] dark:bg-[#121212]',
          className,
        )}
      >
        <p className="bear-body-small-regular text-center text-[#94735C] dark:text-[#9D8F7B]">
          ยังไม่มีรางวัลใหญ่สำหรับเดือนนี้
        </p>
      </div>
    );
  }

  const isRole = bigReward.reward_type === 'role';
  const displayRoleName = roleName ?? bigReward.role_id ?? 'Discord Role';

  return (
    <div
      className={cn(
        'rounded-[20px] border border-[#F4EEE5] bg-[#FAF2E4] dark:border-[#242424] dark:bg-[#121212]',
        compact ? 'px-3 py-2.5 sm:px-4 sm:py-3' : 'px-3 py-3 sm:px-4 sm:py-4',
        className,
      )}
    >
      <div className="flex items-start gap-2.5 sm:gap-3">
        <div className="flex shrink-0 items-center justify-center">
          <RewardIcon type={bigReward.reward_type} roleIcon={roleIcon} />
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#D7A042]" />
            <p className="bear-body-small-regular-medium sm:bear-body-regular-medium text-[#89654A] dark:text-[#E9E6E2]">
              รางวัลใหญ่เดือนนี้
            </p>
            {claimed && (
              <span className="rounded-full bg-[#C7EEC8] px-2 py-0.5 bear-body-xsmall-regular text-[#1E3A2F] dark:bg-[#1E3A2F] dark:text-[#C7EEC8]">
                รับแล้ว
              </span>
            )}
          </div>

          {isRole ? (
            <p className="bear-body-regular-medium text-[#9A7331] dark:text-[#D7A042] truncate">
              {displayRoleName}
            </p>
          ) : (
            <p className="bear-body-regular-medium text-[#9A7331] dark:text-[#D7A042]">
              {formatCheckinRewardGranted(bigReward.reward_type, bigReward.reward_amount ?? 0)}
            </p>
          )}

          {!compact && bigReward.description && (
            <p className="bear-body-xsmall-regular text-[#94735C] dark:text-[#9D8F7B] line-clamp-2">
              {bigReward.description}
            </p>
          )}

          <div className="space-y-1 pt-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className="bear-body-xsmall-regular text-[#94735C] dark:text-[#9D8F7B]">
                ความคืบหน้า
              </span>
              <span className="bear-body-xsmall-regular-medium text-[#89654A] dark:text-[#E9E6E2]">
                {progress}/28 วัน
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#EDE4D4] dark:bg-[#1A1A1A]">
              <div
                className="h-full rounded-full bg-[#D7A042] transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
