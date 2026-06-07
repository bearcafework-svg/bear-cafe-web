-- Check-in RLS policies

alter table public.checkin_cycles       enable row level security;
alter table public.checkin_daily_rewards enable row level security;
alter table public.checkin_big_reward   enable row level security;
alter table public.checkin_logs         enable row level security;

-- ─── checkin_cycles ───────────────────────────────────────────────────────────
-- Users can only read their own cycle. Writes go through edge functions (service role).

create policy "Users can view own checkin_cycles"
  on public.checkin_cycles for select
  using (discord_id = get_jwt_discord_id());

-- ─── checkin_daily_rewards ────────────────────────────────────────────────────
-- Public read. Admin write.

create policy "Anyone can view checkin_daily_rewards"
  on public.checkin_daily_rewards for select
  using (true);

create policy "Admins can insert checkin_daily_rewards"
  on public.checkin_daily_rewards for insert
  with check (
    has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role)
    or has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role)
  );

create policy "Admins can update checkin_daily_rewards"
  on public.checkin_daily_rewards for update
  using (
    has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role)
    or has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role)
  )
  with check (
    has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role)
    or has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role)
  );

create policy "Admins can delete checkin_daily_rewards"
  on public.checkin_daily_rewards for delete
  using (
    has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role)
    or has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role)
  );

-- ─── checkin_big_reward ───────────────────────────────────────────────────────
-- Public read. Admin write.

create policy "Anyone can view checkin_big_reward"
  on public.checkin_big_reward for select
  using (true);

create policy "Admins can insert checkin_big_reward"
  on public.checkin_big_reward for insert
  with check (
    has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role)
    or has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role)
  );

create policy "Admins can update checkin_big_reward"
  on public.checkin_big_reward for update
  using (
    has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role)
    or has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role)
  )
  with check (
    has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role)
    or has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role)
  );

create policy "Admins can delete checkin_big_reward"
  on public.checkin_big_reward for delete
  using (
    has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role)
    or has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role)
  );

-- ─── checkin_logs ─────────────────────────────────────────────────────────────
-- Users can only read their own logs. Writes go through edge functions (service role).

create policy "Users can view own checkin_logs"
  on public.checkin_logs for select
  using (discord_id = get_jwt_discord_id());
