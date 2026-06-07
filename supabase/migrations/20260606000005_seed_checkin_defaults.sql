-- Seed default data for the check-in system
-- Inserts 28 daily reward rows (10 points each) and one big reward row.
-- Uses INSERT ... ON CONFLICT DO NOTHING so re-running is safe.

-- ─── Daily rewards (days 1–28, default: 10 points) ───────────────────────────

insert into public.checkin_daily_rewards (day_number, reward_type, reward_amount, is_active)
select
  day_number,
  'points'::public.checkin_reward_type,
  10,
  true
from generate_series(1, 28) as day_number
on conflict (day_number) do nothing;

-- ─── Big reward (default: 100 points, makeup cost 50 points/day) ─────────────

insert into public.checkin_big_reward (reward_type, reward_amount, description, makeup_cost_per_day)
select
  'points'::public.checkin_reward_type,
  100,
  'Perfect attendance reward — checked in all 28 days!',
  50
where not exists (select 1 from public.checkin_big_reward);
