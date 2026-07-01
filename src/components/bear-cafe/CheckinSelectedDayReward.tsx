import {
  StrawberryColorIcon,
  TearTicketColorIcon,
  TicketColorIcon,
} from '@/icon/outline';
import { CheckinRoleIcon } from '@/components/bear-cafe/CheckinRoleIcon';
import {
  formatCheckinRewardGranted,
  type CheckinDailyReward,
  type CheckinRewardType,
} from '@/lib/checkin';
import { cn } from '@/lib/utils';

const ICON_SIZE = { mobile: 56, desktop: 72 };

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
          className="h-14 w-14 sm:h-[4.5rem] sm:w-[4.5rem]"
        />
      );
    default:
      return null;
  }
}

interface CheckinSelectedDayRewardProps {
  reward: CheckinDailyReward;
  roleIcon?: string | null;
  roleName?: string | null;
  className?: string;
}

export function CheckinSelectedDayReward({
  reward,
  roleIcon,
  roleName,
  className,
}: CheckinSelectedDayRewardProps) {
  const isRole = reward.reward_type === 'role';
  const displayRoleName =
    roleName ?? reward.role_name ?? reward.role_id ?? 'Discord Role';

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex shrink-0 items-center justify-center">
        <RewardIcon type={reward.reward_type} roleIcon={roleIcon} />
      </div>

      {isRole ? (
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="bear-body-small-regular text-[#94735C] dark:text-[#9D8F7B]">บทบาท</p>
          <p className="bear-h2-medium text-[#89654A] dark:text-[#E9E6E2]">{displayRoleName}</p>
        </div>
      ) : (
        <p className="bear-h1-medium text-[#9A7331] dark:text-[#D7A042]">
          {formatCheckinRewardGranted(
            reward.reward_type,
            reward.reward_amount ?? 0,
          )}
        </p>
      )}
    </div>
  );
}
