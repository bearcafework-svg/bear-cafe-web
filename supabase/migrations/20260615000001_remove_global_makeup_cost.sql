-- Remove makeup_cost_per_day from checkin_big_reward table
-- since makeup cost is now stored per-day in checkin_daily_rewards

alter table public.checkin_big_reward
  drop column if exists makeup_cost_per_day;

comment on table public.checkin_big_reward is
  'Single-row config for the 28-day perfect-attendance reward. Makeup costs are now per-day in checkin_daily_rewards.';
