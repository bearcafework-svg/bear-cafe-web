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
import { Calendar, Sparkles } from 'lucide-react';

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
  inline?: boolean;
  onCalendarClick?: () => void;
  fullCalendar?: boolean;
}

export function CheckinBigRewardPreview({
  bigReward,
  completedDays,
  claimed = false,
  roleIcon,
  roleName,
  compact = false,
  className,
  inline = false,
  onCalendarClick,
  fullCalendar = false,
}: CheckinBigRewardPreviewProps) {
  const progress = Math.min(completedDays, 28);
  const progressPct = (progress / 28) * 100;

  if (!bigReward) {
    return (
      <div
        className={cn(
          inline
            ? 'px-0 py-0'
            : 'rounded-[20px] border border-[#F4EEE5] bg-[#FAF2E4] px-3 py-3 dark:border-[#242424] dark:bg-[#121212]',
          className,
        )}
      >
        <p className="bear-body-small-regular text-center text-[#94735C] dark:text-[#6B6B6B]">
          ยังไม่มีรางวัลใหญ่สำหรับเดือนนี้
        </p>
      </div>
    );
  }

  const isRole = bigReward.reward_type === 'role';
  const displayRoleName = roleName ?? bigReward.role_id ?? 'Discord Role';
  const rewardLabel = isRole
    ? `@${displayRoleName}`
    : formatCheckinRewardGranted(bigReward.reward_type, bigReward.reward_amount ?? 0);

  if (fullCalendar) {
    return (
      <div className="flex flex-col items-center gap-2.5 sm:gap-3">
        <div className='flex flex-col items-center gap-1 sm:gap-3'>
          {claimed && (
            <span className="rounded-full bg-[#C7EEC8] px-2 py-0.5 bear-body-small-regular text-[#1E3A2F] dark:bg-[#1E3A2F] dark:text-[#C7EEC8]">
              รับแล้ว
            </span>
          )}
          <div className="flex shrink-0 items-center justify-center">
            <RewardIcon type={bigReward.reward_type} roleIcon={roleIcon} />
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#D7A042]" />
            <p className="bear-body-small-medium sm:bear-body-regular-medium text-[#89654A] dark:text-[#E9E6E2]">
              รางวัลใหญ่เดือนนี้
            </p>
            {isRole ? (
              <p className="bear-body-regular-medium text-[#9A7331] dark:text-[#D7A042] truncate">
                {displayRoleName}
              </p>
            ) : (
              <p className="bear-body-regular-medium text-[#9A7331] dark:text-[#D7A042]">
                {formatCheckinRewardGranted(bigReward.reward_type, bigReward.reward_amount ?? 0)}
              </p>
            )}
          </div>

          {!compact && bigReward.description && (
            <p className="bear-body-small-regular text-[#94735C] dark:text-[#9D8F7B] line-clamp-2">
              {bigReward.description}
            </p>
          )}

          <div className="space-y-1 pt-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className="bear-body-small-regular text-[#94735C] dark:text-[#9D8F7B]">
                ความคืบหน้า
              </span>
              <span className="bear-body-small-medium text-[#89654A] dark:text-[#E9E6E2]">
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
    )
  }

  if (inline) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex flex-col items-start gap-3">
          <div className="min-w-0 space-y-1 flex items-center justify-between gap-3 flex-1 w-full">
            <p className="bear-body-regular-semibold text-[#89654A] dark:text-[#E9E6E2]">
              รางวัลใหญ่เดือนนี้{' '}
              <span className="text-[#9A7331] dark:text-[#D7A042]">{rewardLabel}</span>
              {claimed && (
                <span className="ml-1.5 rounded-full bg-[#C7EEC8] px-2 py-0.5 bear-body-small-regular text-[#1E3A2F] dark:bg-[#1E3A2F] dark:text-[#C7EEC8]">
                  รับแล้ว
                </span>
              )}
            </p>
            {onCalendarClick && (
              <button
                type="button"
                onClick={onCalendarClick}
                aria-label="เปิดปฏิทินเช็คอิน"
                className="shrink-0 text-[hsl(var(--bear-brown)/0.45)] transition-colors hover:text-[hsl(var(--mocha))] dark:text-[#6B6B6B] dark:hover:text-[#E9E6E2]"
              >
                <Calendar className="h-5 w-5" />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 flex-1 w-full">
            <p className="bear-body-small-medium text-[#94735C] dark:text-[#6B6B6B]">
              เช็คอินสะสมให้ครบ 28 วันเพื่อรับรางวัลใหญ่สุดพิเศษ
            </p>
            <span className="shrink-0 bear-body-small-medium text-[#94735C] dark:text-[#6B6B6B]">
              {progress} / 28
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[#EDE4D4] dark:bg-[#1A1A1A]">
            <div
              className="h-full rounded-full bg-[#D7A042] transition-all duration-300 dark:bg-gradient-to-r dark:from-[#E8A87C] dark:to-[#F5C4B8]"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

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
            <p className="bear-body-small-medium sm:bear-body-regular-medium text-[#89654A] dark:text-[#E9E6E2]">
              รางวัลใหญ่เดือนนี้
            </p>
            {claimed && (
              <span className="rounded-full bg-[#C7EEC8] px-2 py-0.5 bear-body-small-regular text-[#1E3A2F] dark:bg-[#1E3A2F] dark:text-[#C7EEC8]">
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
            <p className="bear-body-small-regular text-[#94735C] dark:text-[#9D8F7B] line-clamp-2">
              {bigReward.description}
            </p>
          )}

          <div className="space-y-1 pt-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className="bear-body-small-regular text-[#94735C] dark:text-[#9D8F7B]">
                ความคืบหน้า
              </span>
              <span className="bear-body-small-medium text-[#89654A] dark:text-[#E9E6E2]">
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
