-- Bear Cafe bootstrap: RLS + policies (aligned with src usage)

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.custom_permissions enable row level security;
alter table public.user_custom_permissions enable row level security;
alter table public.site_settings enable row level security;
alter table public.categories enable row level security;
alter table public.discord_roles enable row level security;
alter table public.category_roles enable row level security;
alter table public.banned_words enable row level security;
alter table public.sessions enable row level security;
alter table public.voice_states enable row level security;
alter table public.reports enable row level security;
alter table public.banners enable row level security;
alter table public.tag_warn_logs enable row level security;
alter table public.tag_warn_cancel_requests enable row level security;
alter table public.redeem_codes enable row level security;
alter table public.redeem_logs enable row level security;
alter table public.user_points enable row level security;
alter table public.trading_history enable row level security;
alter table public.work_sessions enable row level security;
alter table public.promotion_tasks enable row level security;
alter table public.leave_requests enable row level security;
alter table public.banned_discord_roles enable row level security;
alter table public.non_transferable_roles enable row level security;
alter table public.role_transfer_logs enable row level security;
alter table public.lottery_rounds enable row level security;
alter table public.lottery_tickets enable row level security;
alter table public.user_gacha_stats enable row level security;
alter table public.gacha_rewards enable row level security;
alter table public.discord_server_categories enable row level security;
alter table public.discord_servers enable row level security;
alter table public.server_clicks enable row level security;
alter table public.server_ratings enable row level security;
alter table public.server_click_stats enable row level security;
alter table public.healing_messages enable row level security;

-- Profiles
drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
for select to authenticated
using (id = auth.uid() or has_page_access('users'));

drop policy if exists "profiles_self_insert" on public.profiles;
create policy "profiles_self_insert" on public.profiles
for insert to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
for update to authenticated
using (id = auth.uid() or has_page_access('users'))
with check (id = auth.uid() or has_page_access('users'));

-- Roles / permissions
drop policy if exists "user_roles_read" on public.user_roles;
create policy "user_roles_read" on public.user_roles
for select to authenticated
using (user_id = auth.uid() or has_page_access('users'));

drop policy if exists "user_roles_manage" on public.user_roles;
create policy "user_roles_manage" on public.user_roles
for all to authenticated
using (has_page_access('users'))
with check (has_page_access('users'));

drop policy if exists "custom_permissions_read" on public.custom_permissions;
create policy "custom_permissions_read" on public.custom_permissions
for select to authenticated using (true);

drop policy if exists "custom_permissions_manage" on public.custom_permissions;
create policy "custom_permissions_manage" on public.custom_permissions
for all to authenticated
using (has_page_access('permissions'))
with check (has_page_access('permissions'));

drop policy if exists "user_custom_permissions_read" on public.user_custom_permissions;
create policy "user_custom_permissions_read" on public.user_custom_permissions
for select to authenticated
using (user_id = auth.uid() or has_page_access('permissions'));

drop policy if exists "user_custom_permissions_manage" on public.user_custom_permissions;
create policy "user_custom_permissions_manage" on public.user_custom_permissions
for all to authenticated
using (has_page_access('permissions'))
with check (has_page_access('permissions'));

-- Settings
drop policy if exists "site_settings_read" on public.site_settings;
create policy "site_settings_read" on public.site_settings
for select to authenticated using (true);

drop policy if exists "site_settings_manage" on public.site_settings;
create policy "site_settings_manage" on public.site_settings
for all to authenticated
using (is_owner())
with check (is_owner());

-- Categories / roles
drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read" on public.categories
for select to authenticated
using (is_active or has_page_access('categories'));

drop policy if exists "categories_manage" on public.categories;
create policy "categories_manage" on public.categories
for all to authenticated
using (has_page_access('categories'))
with check (has_page_access('categories'));

drop policy if exists "discord_roles_read" on public.discord_roles;
create policy "discord_roles_read" on public.discord_roles
for select to authenticated
using (is_active or has_page_access('roles'));

drop policy if exists "discord_roles_manage" on public.discord_roles;
create policy "discord_roles_manage" on public.discord_roles
for all to authenticated
using (has_page_access('roles'))
with check (has_page_access('roles'));

drop policy if exists "category_roles_read" on public.category_roles;
create policy "category_roles_read" on public.category_roles
for select to authenticated using (true);

drop policy if exists "category_roles_manage" on public.category_roles;
create policy "category_roles_manage" on public.category_roles
for all to authenticated
using (has_page_access('categories'))
with check (has_page_access('categories'));

drop policy if exists "banned_words_read" on public.banned_words;
create policy "banned_words_read" on public.banned_words
for select to authenticated using (true);

drop policy if exists "banned_words_manage" on public.banned_words;
create policy "banned_words_manage" on public.banned_words
for all to authenticated
using (has_page_access('banned-words'))
with check (has_page_access('banned-words'));

-- Sessions
drop policy if exists "sessions_read" on public.sessions;
create policy "sessions_read" on public.sessions
for select to authenticated
using (user_id = auth.uid() or matched_user_id = auth.uid() or has_page_access('users'));

drop policy if exists "sessions_insert" on public.sessions;
create policy "sessions_insert" on public.sessions
for insert to authenticated
with check (user_id = auth.uid() and not exists (
  select 1 from public.profiles p where p.id = auth.uid() and p.is_banned = true
));

drop policy if exists "sessions_update" on public.sessions;
create policy "sessions_update" on public.sessions
for update to authenticated
using (user_id = auth.uid() or has_page_access('users'))
with check (user_id = auth.uid() or has_page_access('users'));

-- Voice states (read-only for authenticated)
drop policy if exists "voice_states_read" on public.voice_states;
create policy "voice_states_read" on public.voice_states
for select to authenticated using (true);

-- Reports
drop policy if exists "reports_insert" on public.reports;
create policy "reports_insert" on public.reports
for insert to authenticated
with check (reporter_id = auth.uid());

drop policy if exists "reports_read" on public.reports;
create policy "reports_read" on public.reports
for select to authenticated
using (reporter_id = auth.uid() or reported_user_id = auth.uid() or has_page_access('reports'));

drop policy if exists "reports_manage" on public.reports;
create policy "reports_manage" on public.reports
for update to authenticated
using (has_page_access('reports'))
with check (has_page_access('reports'));

-- Banners
drop policy if exists "banners_public_read" on public.banners;
create policy "banners_public_read" on public.banners
for select to authenticated using (is_active or has_page_access('banners'));

drop policy if exists "banners_manage" on public.banners;
create policy "banners_manage" on public.banners
for all to authenticated
using (has_page_access('banners'))
with check (has_page_access('banners'));

-- Tag warn
drop policy if exists "tag_warn_logs_read" on public.tag_warn_logs;
create policy "tag_warn_logs_read" on public.tag_warn_logs
for select to authenticated
using (has_page_access('tag-warn'));

drop policy if exists "tag_warn_logs_manage" on public.tag_warn_logs;
create policy "tag_warn_logs_manage" on public.tag_warn_logs
for all to authenticated
using (has_page_access('tag-warn'))
with check (has_page_access('tag-warn'));

drop policy if exists "tag_warn_cancel_requests_read" on public.tag_warn_cancel_requests;
create policy "tag_warn_cancel_requests_read" on public.tag_warn_cancel_requests
for select to authenticated
using (requested_by = auth.uid() or has_page_access('tag-warn'));

drop policy if exists "tag_warn_cancel_requests_insert" on public.tag_warn_cancel_requests;
create policy "tag_warn_cancel_requests_insert" on public.tag_warn_cancel_requests
for insert to authenticated
with check (requested_by = auth.uid() or has_page_access('tag-warn'));

drop policy if exists "tag_warn_cancel_requests_update" on public.tag_warn_cancel_requests;
create policy "tag_warn_cancel_requests_update" on public.tag_warn_cancel_requests
for update to authenticated
using (has_page_access('tag-warn'))
with check (has_page_access('tag-warn'));

-- Redeem / points (admin UI)
drop policy if exists "redeem_codes_manage" on public.redeem_codes;
create policy "redeem_codes_manage" on public.redeem_codes
for all to authenticated
using (jwt_has_page_access('redeem-codes'))
with check (jwt_has_page_access('redeem-codes'));

drop policy if exists "redeem_logs_manage" on public.redeem_logs;
create policy "redeem_logs_manage" on public.redeem_logs
for all to authenticated
using (jwt_has_page_access('redeem-codes'))
with check (jwt_has_page_access('redeem-codes'));

drop policy if exists "user_points_manage" on public.user_points;
create policy "user_points_manage" on public.user_points
for all to authenticated
using (jwt_has_page_access('redeem-codes'))
with check (jwt_has_page_access('redeem-codes'));

-- Trading history
drop policy if exists "trading_history_view" on public.trading_history;
create policy "trading_history_view" on public.trading_history
for select to authenticated
using (has_page_access('trading-history'));

drop policy if exists "trading_history_insert" on public.trading_history;
create policy "trading_history_insert" on public.trading_history
for insert to authenticated
with check (has_page_access('trading-history'));

drop policy if exists "trading_history_update" on public.trading_history;
create policy "trading_history_update" on public.trading_history
for update to authenticated
using (has_page_access('trading-history'))
with check (has_page_access('trading-history'));

drop policy if exists "trading_history_delete" on public.trading_history;
create policy "trading_history_delete" on public.trading_history
for delete to authenticated
using (is_owner());

-- Staff tables
drop policy if exists "work_sessions_read" on public.work_sessions;
create policy "work_sessions_read" on public.work_sessions
for select to authenticated
using (user_id = auth.uid() or has_page_access('staff'));

drop policy if exists "work_sessions_manage" on public.work_sessions;
create policy "work_sessions_manage" on public.work_sessions
for all to authenticated
using (user_id = auth.uid() or has_page_access('staff'))
with check (user_id = auth.uid() or has_page_access('staff'));

drop policy if exists "promotion_tasks_read" on public.promotion_tasks;
create policy "promotion_tasks_read" on public.promotion_tasks
for select to authenticated
using (user_id = auth.uid() or has_page_access('staff'));

drop policy if exists "promotion_tasks_manage" on public.promotion_tasks;
create policy "promotion_tasks_manage" on public.promotion_tasks
for all to authenticated
using (user_id = auth.uid() or has_page_access('staff'))
with check (user_id = auth.uid() or has_page_access('staff'));

drop policy if exists "leave_requests_read" on public.leave_requests;
create policy "leave_requests_read" on public.leave_requests
for select to authenticated
using (user_id = auth.uid() or has_page_access('staff'));

drop policy if exists "leave_requests_manage" on public.leave_requests;
create policy "leave_requests_manage" on public.leave_requests
for all to authenticated
using (user_id = auth.uid() or has_page_access('staff'))
with check (user_id = auth.uid() or has_page_access('staff'));

-- Role moderation + transfer
drop policy if exists "banned_discord_roles_read" on public.banned_discord_roles;
create policy "banned_discord_roles_read" on public.banned_discord_roles
for select to authenticated using (true);

drop policy if exists "banned_discord_roles_manage" on public.banned_discord_roles;
create policy "banned_discord_roles_manage" on public.banned_discord_roles
for all to authenticated
using (has_page_access('banned-roles'))
with check (has_page_access('banned-roles'));

drop policy if exists "non_transferable_roles_read" on public.non_transferable_roles;
create policy "non_transferable_roles_read" on public.non_transferable_roles
for select to authenticated using (true);

drop policy if exists "non_transferable_roles_manage" on public.non_transferable_roles;
create policy "non_transferable_roles_manage" on public.non_transferable_roles
for all to authenticated
using (has_page_access('non-transferable-roles'))
with check (has_page_access('non-transferable-roles'));

drop policy if exists "role_transfer_logs_read" on public.role_transfer_logs;
create policy "role_transfer_logs_read" on public.role_transfer_logs
for select to authenticated
using (has_page_access('role-transfer'));

drop policy if exists "role_transfer_logs_insert" on public.role_transfer_logs;
create policy "role_transfer_logs_insert" on public.role_transfer_logs
for insert to authenticated
with check (has_page_access('role-transfer'));

drop policy if exists "role_transfer_logs_update" on public.role_transfer_logs;
create policy "role_transfer_logs_update" on public.role_transfer_logs
for update to authenticated
using (has_page_access('role-transfer'))
with check (has_page_access('role-transfer'));

-- Lottery
drop policy if exists "lottery_rounds_read" on public.lottery_rounds;
create policy "lottery_rounds_read" on public.lottery_rounds
for select to authenticated using (true);

drop policy if exists "lottery_rounds_manage" on public.lottery_rounds;
create policy "lottery_rounds_manage" on public.lottery_rounds
for all to authenticated
using (has_page_access('lottery'))
with check (has_page_access('lottery'));

drop policy if exists "lottery_tickets_read" on public.lottery_tickets;
create policy "lottery_tickets_read" on public.lottery_tickets
for select to authenticated
using (user_id = auth.uid() or has_page_access('lottery'));

drop policy if exists "lottery_tickets_insert" on public.lottery_tickets;
create policy "lottery_tickets_insert" on public.lottery_tickets
for insert to authenticated
with check (user_id = auth.uid() or has_page_access('lottery'));

drop policy if exists "lottery_tickets_manage" on public.lottery_tickets;
create policy "lottery_tickets_manage" on public.lottery_tickets
for all to authenticated
using (has_page_access('lottery'))
with check (has_page_access('lottery'));

-- Gacha
drop policy if exists "user_gacha_stats_read" on public.user_gacha_stats;
create policy "user_gacha_stats_read" on public.user_gacha_stats
for select to authenticated using (true);

drop policy if exists "user_gacha_stats_update_self" on public.user_gacha_stats;
create policy "user_gacha_stats_update_self" on public.user_gacha_stats
for update to authenticated
using (discord_id = (select p.discord_id from public.profiles p where p.id = auth.uid()))
with check (discord_id = (select p.discord_id from public.profiles p where p.id = auth.uid()));

drop policy if exists "user_gacha_stats_manage" on public.user_gacha_stats;
create policy "user_gacha_stats_manage" on public.user_gacha_stats
for all to authenticated
using (is_owner())
with check (is_owner());

drop policy if exists "gacha_rewards_read" on public.gacha_rewards;
create policy "gacha_rewards_read" on public.gacha_rewards
for select to authenticated using (true);

drop policy if exists "gacha_rewards_manage" on public.gacha_rewards;
create policy "gacha_rewards_manage" on public.gacha_rewards
for all to authenticated
using (is_owner())
with check (is_owner());

-- Discord server listing
drop policy if exists "discord_server_categories_read" on public.discord_server_categories;
create policy "discord_server_categories_read" on public.discord_server_categories
for select to public using (true);

drop policy if exists "discord_server_categories_manage" on public.discord_server_categories;
create policy "discord_server_categories_manage" on public.discord_server_categories
for all to authenticated
using (is_owner())
with check (is_owner());

drop policy if exists "discord_servers_public_read" on public.discord_servers;
create policy "discord_servers_public_read" on public.discord_servers
for select to public
using (status = 'approved');

drop policy if exists "discord_servers_staff_read" on public.discord_servers;
create policy "discord_servers_staff_read" on public.discord_servers
for select to authenticated
using (is_owner() or auth.uid() in (select id from public.profiles where discord_id = owner_id));

drop policy if exists "discord_servers_insert_own" on public.discord_servers;
create policy "discord_servers_insert_own" on public.discord_servers
for insert to authenticated
with check (auth.uid() in (select id from public.profiles where discord_id = owner_id));

drop policy if exists "discord_servers_update_own" on public.discord_servers;
create policy "discord_servers_update_own" on public.discord_servers
for update to authenticated
using (is_owner() or auth.uid() in (select id from public.profiles where discord_id = owner_id))
with check (is_owner() or auth.uid() in (select id from public.profiles where discord_id = owner_id));

drop policy if exists "server_clicks_read" on public.server_clicks;
create policy "server_clicks_read" on public.server_clicks
for select to public using (true);

drop policy if exists "server_clicks_insert" on public.server_clicks;
create policy "server_clicks_insert" on public.server_clicks
for insert to authenticated
with check (true);

drop policy if exists "server_ratings_read" on public.server_ratings;
create policy "server_ratings_read" on public.server_ratings
for select to public using (true);

drop policy if exists "server_ratings_manage" on public.server_ratings;
create policy "server_ratings_manage" on public.server_ratings
for all to authenticated
using (true)
with check (true);

drop policy if exists "server_click_stats_read" on public.server_click_stats;
create policy "server_click_stats_read" on public.server_click_stats
for select to public using (true);

drop policy if exists "server_click_stats_manage" on public.server_click_stats;
create policy "server_click_stats_manage" on public.server_click_stats
for all to authenticated
using (true)
with check (true);

-- Healing messages
drop policy if exists "healing_messages_insert_own" on public.healing_messages;
create policy "healing_messages_insert_own" on public.healing_messages
for insert to authenticated
with check (author_id = auth.uid());

drop policy if exists "healing_messages_select" on public.healing_messages;
create policy "healing_messages_select" on public.healing_messages
for select to authenticated
using (status = 'approved' or author_id = auth.uid() or has_page_access('healing-messages'));

drop policy if exists "healing_messages_manage" on public.healing_messages;
create policy "healing_messages_manage" on public.healing_messages
for all to authenticated
using (has_page_access('healing-messages'))
with check (has_page_access('healing-messages'));

