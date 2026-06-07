-- Add ticket_point and ticket_piece_point columns to user_points

alter table public.user_points
  add column if not exists ticket_point       integer not null default 0 check (ticket_point >= 0),
  add column if not exists ticket_piece_point integer not null default 0 check (ticket_piece_point >= 0);
