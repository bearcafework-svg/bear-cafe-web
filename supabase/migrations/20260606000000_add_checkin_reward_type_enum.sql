-- Check-in reward type enum (no inventory_item)

create type public.checkin_reward_type as enum ('points', 'ticket_point', 'ticket_piece_point', 'role');

create type public.checkin_action as enum ('daily', 'makeup', 'big_reward');
