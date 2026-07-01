-- Check-in indexes

create index idx_checkin_cycles_discord_id       on public.checkin_cycles(discord_id);
create index idx_checkin_cycles_year_month        on public.checkin_cycles(year, month);
create index idx_checkin_logs_discord_id          on public.checkin_logs(discord_id);
create index idx_checkin_logs_year_month          on public.checkin_logs(year, month);
create index idx_checkin_daily_rewards_day_number on public.checkin_daily_rewards(day_number);
