-- Add makeup_cost column to checkin_daily_rewards table
-- Each day can now have its own makeup cost

alter table public.checkin_daily_rewards
  add column makeup_cost int not null default 50
  check (makeup_cost >= 0);

comment on column public.checkin_daily_rewards.makeup_cost is
  'Cost in points to retroactively fill this day during makeup window';

-- Seed default makeup costs for existing rows (50 points per day)
update public.checkin_daily_rewards
set makeup_cost = 50
where makeup_cost is null;
