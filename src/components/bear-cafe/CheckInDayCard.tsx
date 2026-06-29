import { cn, formatNumber } from '@/lib/utils';
import {
  StrawberryColorIcon,
  TearTicketColorIcon,
  TicketColorIcon,
} from '@/icon/outline';
import { CheckinRoleIcon } from '@/components/bear-cafe/CheckinRoleIcon';
import type { CheckinDailyReward, CheckinDayState } from '@/lib/checkin';

export function DayRewardDisplay({
  reward,
  roleIcon,
  state,
  iconSize = { mobile: 20, desktop: 24 },
}: {
  reward: CheckinDailyReward | undefined;
  roleIcon?: string | null;
  state: CheckinDayState;
  iconSize?: { mobile: number; desktop: number };
}) {
  if (!reward) return null;

  const scoreClass = cn(
    'bear-body-regular-semibold leading-none',
    state === 'completed' && 'text-[#B2A094] dark:text-[hsl(var(--matcha)/0.7)]',
    state === 'today' && 'text-[#D7A042] dark:text-[hsl(var(--honey))]',
    state === 'makeup' && 'text-[#B2A094] dark:text-[hsl(var(--muted-foreground))]',
    state === 'future' && 'text-[#7C6F65] dark:text-[hsl(var(--muted-foreground)/0.65)]',
    state === 'missed' && 'text-[#B2A094] dark:text-[hsl(var(--muted-foreground))]',
  );

  const icon = (() => {
    switch (reward.reward_type) {
      case 'points':
        return <StrawberryColorIcon size={iconSize} />;
      case 'ticket_point':
        return <TicketColorIcon size={iconSize} />;
      case 'ticket_piece_point':
        return <TearTicketColorIcon size={iconSize} />;
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
  })();

  if (!icon) return null;

  const amount = reward.reward_amount;

  return (
    <div className="flex flex-col items-center gap-0.5">
      {icon}
      {reward.reward_type !== 'role' && amount != null && (
        <span className={scoreClass}>{formatNumber(amount)}</span>
      )}
    </div>
  );
}

export function CheckInDayCard({
  day,
  state,
  reward,
  roleIcon,
  isSelected,
  disabled,
  onClick,
}: {
  day: number;
  state: CheckinDayState;
  reward?: CheckinDailyReward;
  roleIcon?: string | null;
  isSelected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex flex-1 flex-col items-center justify-center border rounded-lg sm:rounded-2xl lg:rounded-[20px] transition-all duration-200',
        'gap-1 py-2 px-1 sm:gap-2 sm:py-3 sm:px-2 md:gap-3 md:py-4 md:px-3 lg:gap-5 lg:py-5 lg:px-4',
        !disabled && 'cursor-pointer hover:scale-[1.01] active:scale-[0.98]',
        disabled && 'cursor-default',
        "bg-[#FAF2E4] dark:bg-[#0A0A0A] border-[#EACB8F] dark:border-[#47381E]",
        state === 'completed' && "bg-[#FAF2E4] dark:bg-[#0A0A0A] border-[#9CCC9E] dark:border-[#17251F]",
        state === 'completed' && isSelected && "bg-[#FAF2E4] dark:bg-[#0A0A0A] border-[#50A582] dark:border-[#2D5C48] shadow-[0_0_8px_0px_rgba(24,98,67,0.25)] dark:shadow-[0_0_8px_0px_rgba(41,114,83,0.25)]",
        state === 'today' && "bg-[#F7E6C5] dark:bg-[#241E15] border-[#EACB8F] dark:border-[#47381E]",
        state === 'today' && isSelected && "bg-[#F7E6C5] dark:bg-[#241E15] border-[#D7A042] dark:border-[#D7A042] shadow-[0_0_8px_0px_rgba(215,160,66,0.25)] dark:shadow-[0_0_8px_0px_rgba(215,160,66,0.25)]",
        state === 'makeup' && "bg-[#FAF2E4] dark:bg-[#0A0A0A] border-[#E98C8C] dark:border-[#402328]",
        state === 'makeup' && isSelected && "bg-[#FAF2E4] dark:bg-[#0A0A0A] border-[#E98C8C] dark:border-[#402328] shadow-[0_0_8px_0px_rgba(156,66,81,0.25)] dark:shadow-[0_0_8px_0px_rgba(156,66,81,0.25)]",
        state === 'future' && "bg-[#FAF2E4] dark:bg-[#0A0A0A] border-[#EACB8F] dark:border-[#47381E]",
        state === 'future' && isSelected && "bg-[#FAF2E4] dark:bg-[#0A0A0A] border-[#EACB8F] dark:border-[#47381E] shadow-[0_0_8px_0px_rgba(215,160,66,0.25)] dark:shadow-[0_0_8px_0px_rgba(215,160,66,0.25)]",
        state === 'missed' && "bg-[#FAF2E4] dark:bg-[#0A0A0A] border-[#E98C8C] dark:border-[#402328]",
        state === 'missed' && isSelected && "bg-[#FAF2E4] dark:bg-[#0A0A0A] border-[#E98C8C] dark:border-[#402328] shadow-[0_0_8px_0px_rgba(156,66,81,0.25)] dark:shadow-[0_0_8px_0px_rgba(156,66,81,0.25)]",
      )}
    >
      <span
        className={cn(
          'bear-body-xsmall-medium leading-none md:bear-body-small-medium',
          state === 'completed' && 'text-[#B2A094] dark:text-[hsl(var(--matcha)/0.7)]',
          state === 'today' && 'text-[#D7A042] dark:text-[hsl(var(--honey))]',
          state === 'makeup' && 'text-[#B2A094] dark:text-[hsl(var(--muted-foreground))]',
          state === 'future' && 'text-[#7C6F65] dark:text-[hsl(var(--muted-foreground)/0.65)]',
          state === 'missed' && 'text-[#B2A094] dark:text-[hsl(var(--muted-foreground))]',
        )}
      >
        DAY {day}
      </span>
      <DayRewardDisplay reward={reward} roleIcon={roleIcon} state={state} />
    </button>
  );
}
