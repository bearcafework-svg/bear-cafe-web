-- Check-in tables

-- ─── checkin_cycles ───────────────────────────────────────────────────────────
-- One row per user per calendar month. Tracks which days were checked in.

create table public.checkin_cycles (
  id                 uuid        primary key default gen_random_uuid(),
  discord_id         text        not null references public.user_points(discord_id),
  year               int         not null,
  month              int         not null check (month between 1 and 12),
  completed_days     int[]       not null default '{}',  -- free daily check-ins (1–28)
  makeup_days        int[]       not null default '{}',  -- paid retro-fills (1–28)
  big_reward_claimed boolean     not null default false,
  created_at         timestamptz not null default now(),
  unique (discord_id, year, month)
);

-- ─── checkin_daily_rewards ────────────────────────────────────────────────────
-- Admin-configurable reward per day slot (1–28). One row per day.
-- reward_type: 'points' | 'ticket_point' | 'ticket_piece_point' | 'role'
-- Only the field matching the reward_type should be set.

create table public.checkin_daily_rewards (
  id            uuid                       primary key default gen_random_uuid(),
  day_number    int                        not null check (day_number between 1 and 28),
  reward_type   public.checkin_reward_type not null,
  reward_amount int,   -- amount to add; used for points / ticket_point / ticket_piece_point
  role_id       text,  -- Discord role ID; used when reward_type = 'role'
  is_active     boolean                    not null default true,
  updated_at    timestamptz                not null default now(),
  updated_by    text,  -- discord_id of admin who last edited
  unique (day_number)
);

-- ─── checkin_big_reward ───────────────────────────────────────────────────────
-- Single-row config for the 28-day perfect-attendance reward.
-- Also stores the make-up cost per missed day.

create table public.checkin_big_reward (
  id                  uuid                       primary key default gen_random_uuid(),
  reward_type         public.checkin_reward_type not null,
  reward_amount       int,   -- for points / ticket_point / ticket_piece_point
  role_id             text,  -- for role reward
  description         text,
  makeup_cost_per_day int                        not null default 50,
  updated_at          timestamptz                not null default now(),
  updated_by          text
);

-- ─── checkin_logs ─────────────────────────────────────────────────────────────
-- Immutable audit trail for every check-in event.

create table public.checkin_logs (
  id           uuid                       primary key default gen_random_uuid(),
  discord_id   text                       not null,
  year         int                        not null,
  month        int                        not null,
  day_number   int                        not null,
  action       public.checkin_action      not null,
  reward_type  public.checkin_reward_type,
  reward_value jsonb,   -- snapshot of what was granted
  points_cost  int,     -- only for makeup actions
  created_at   timestamptz not null default now()
);
