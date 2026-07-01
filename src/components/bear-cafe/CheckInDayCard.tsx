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
  variant = 'light',
  isSelected = false,
}: {
  reward: CheckinDailyReward | undefined;
  roleIcon?: string | null;
  state: CheckinDayState;
  iconSize?: { mobile: number; desktop: number };
  variant?: 'light' | 'dark';
  isSelected?: boolean;
}) {
  if (!reward) return null;

  const scoreClass = cn(
    'bear-body-regular-semibold leading-none',
    variant === 'dark' && isSelected && 'text-[#D7A042]',
    variant === 'dark' && !isSelected && 'text-[#6B6B6B]',
    variant === 'light' && state === 'completed' && 'text-[#B2A094] dark:text-[hsl(var(--matcha)/0.7)]',
    variant === 'light' && state === 'today' && 'text-[#D7A042] dark:text-[hsl(var(--honey))]',
    variant === 'light' && state === 'makeup' && 'text-[#B2A094] dark:text-[hsl(var(--muted-foreground))]',
    variant === 'light' && state === 'future' && 'text-[#7C6F65] dark:text-[hsl(var(--muted-foreground)/0.65)]',
    variant === 'light' && state === 'missed' && 'text-[#B2A094] dark:text-[hsl(var(--muted-foreground))]',
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
  variant = 'light',
}: {
  day: number;
  state: CheckinDayState;
  reward?: CheckinDailyReward;
  roleIcon?: string | null;
  isSelected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  variant?: 'light' | 'dark';
}) {
  const dayLabelClass = cn(
    'bear-body-small-medium leading-none md:bear-body-regular-medium',
    variant === 'dark' && isSelected && 'text-[#D7A042]',
    variant === 'dark' && !isSelected && 'text-[#6B6B6B]',
    variant === 'light' && state === 'completed' && 'text-[#B2A094] dark:text-[hsl(var(--matcha)/0.7)]',
    variant === 'light' && state === 'today' && 'text-[#D7A042] dark:text-[hsl(var(--honey))]',
    variant === 'light' && state === 'makeup' && 'text-[#B2A094] dark:text-[hsl(var(--muted-foreground))]',
    variant === 'light' && state === 'future' && 'text-[#7C6F65] dark:text-[hsl(var(--muted-foreground)/0.65)]',
    variant === 'light' && state === 'missed' && 'text-[#B2A094] dark:text-[hsl(var(--muted-foreground))]',
  );

  const cardClass = cn(
    'flex flex-1 flex-col items-center justify-center border rounded-lg sm:rounded-2xl lg:rounded-[20px] transition-all duration-200',
    'gap-1 py-2 px-1 sm:gap-2 sm:py-3 sm:px-2 md:gap-3 md:py-4 md:px-3 lg:gap-5 lg:py-5 lg:px-4',
    !disabled && 'cursor-pointer hover:scale-[1.01] active:scale-[0.98]',
    disabled && 'cursor-default',
    variant === 'dark' && 'bg-[#0A0A0A] border-[#2A2A2A]',
    variant === 'dark' && isSelected && 'border-[#D7A042] shadow-[0_0_10px_0px_rgba(215,160,66,0.3)]',
    variant === 'dark' && state === 'completed' && !isSelected && 'border-[#1E3A2F]',
    variant === 'dark' && state === 'missed' && !isSelected && 'border-[#402328]',
    variant === 'dark' && state === 'makeup' && !isSelected && 'border-[#402328]',
    variant === 'light' && "bg-[#FAF2E4] dark:bg-[#0A0A0A] border-[#EACB8F] dark:border-[#47381E]",
    variant === 'light' && state === 'completed' && "bg-[#FAF2E4] dark:bg-[#0A0A0A] border-[#9CCC9E] dark:border-[#17251F]",
    variant === 'light' && state === 'completed' && isSelected && "bg-[#FAF2E4] dark:bg-[#0A0A0A] border-[#50A582] dark:border-[#2D5C48] shadow-[0_0_8px_0px_rgba(24,98,67,0.25)] dark:shadow-[0_0_8px_0px_rgba(41,114,83,0.25)]",
    variant === 'light' && state === 'today' && "bg-[#F7E6C5] dark:bg-[#241E15] border-[#EACB8F] dark:border-[#47381E]",
    variant === 'light' && state === 'today' && isSelected && "bg-[#F7E6C5] dark:bg-[#241E15] border-[#D7A042] dark:border-[#D7A042] shadow-[0_0_8px_0px_rgba(215,160,66,0.25)] dark:shadow-[0_0_8px_0px_rgba(215,160,66,0.25)]",
    variant === 'light' && state === 'makeup' && "bg-[#FAF2E4] dark:bg-[#0A0A0A] border-[#E98C8C] dark:border-[#402328]",
    variant === 'light' && state === 'makeup' && isSelected && "bg-[#FAF2E4] dark:bg-[#0A0A0A] border-[#E98C8C] dark:border-[#402328] shadow-[0_0_8px_0px_rgba(156,66,81,0.25)] dark:shadow-[0_0_8px_0px_rgba(156,66,81,0.25)]",
    variant === 'light' && state === 'future' && "bg-[#FAF2E4] dark:bg-[#0A0A0A] border-[#EACB8F] dark:border-[#47381E]",
    variant === 'light' && state === 'future' && isSelected && "bg-[#FAF2E4] dark:bg-[#0A0A0A] border-[#EACB8F] dark:border-[#47381E] shadow-[0_0_8px_0px_rgba(215,160,66,0.25)] dark:shadow-[0_0_8px_0px_rgba(215,160,66,0.25)]",
    variant === 'light' && state === 'missed' && "bg-[#FAF2E4] dark:bg-[#0A0A0A] border-[#E98C8C] dark:border-[#402328]",
    variant === 'light' && state === 'missed' && isSelected && "bg-[#FAF2E4] dark:bg-[#0A0A0A] border-[#E98C8C] dark:border-[#402328] shadow-[0_0_8px_0px_rgba(156,66,81,0.25)] dark:shadow-[0_0_8px_0px_rgba(156,66,81,0.25)]",
  );

  return (
    <button type="button" disabled={disabled} onClick={onClick} className={cardClass}>
      <span className={dayLabelClass}>DAY {day}</span>
      <DayRewardDisplay
        reward={reward}
        roleIcon={roleIcon}
        state={state}
        variant={variant}
        isSelected={isSelected}
      />
    </button>
  );
}
