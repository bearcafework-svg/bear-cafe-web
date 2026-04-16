CREATE TABLE public.lottery_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_code text NOT NULL UNIQUE,
  is_open boolean NOT NULL DEFAULT false,
  opens_at timestamptz NOT NULL DEFAULT now(),
  closes_at timestamptz,
  winning_number text,
  announced_at timestamptz,
  prize_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lottery_rounds_winning_number_format CHECK (winning_number IS NULL OR winning_number ~ '^[0-9]{6}$')
);

CREATE UNIQUE INDEX lottery_rounds_single_open_round
  ON public.lottery_rounds ((1))
  WHERE is_open = true AND announced_at IS NULL;

CREATE TABLE public.lottery_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.lottery_rounds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ticket_number text NOT NULL,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lottery_tickets_ticket_number_format CHECK (ticket_number ~ '^[0-9]{6}$'),
  CONSTRAINT lottery_tickets_unique_number_per_round UNIQUE (round_id, ticket_number)
);

CREATE INDEX lottery_tickets_round_id_idx ON public.lottery_tickets (round_id);
CREATE INDEX lottery_tickets_user_id_idx ON public.lottery_tickets (user_id);
CREATE INDEX lottery_tickets_round_user_idx ON public.lottery_tickets (round_id, user_id);

ALTER TABLE public.lottery_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lottery_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view lottery rounds"
ON public.lottery_rounds
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage lottery rounds"
ON public.lottery_rounds
FOR ALL
USING (
  has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role)
  OR has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role)
)
WITH CHECK (
  has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role)
  OR has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role)
);

CREATE POLICY "Anyone can view lottery tickets"
ON public.lottery_tickets
FOR SELECT
USING (true);

CREATE POLICY "Users can buy tickets for themselves"
ON public.lottery_tickets
FOR INSERT
WITH CHECK (
  user_id = get_profile_by_discord_id(get_jwt_discord_id())
  AND EXISTS (
    SELECT 1
    FROM public.lottery_rounds r
    WHERE r.id = round_id
      AND r.is_open = true
      AND r.announced_at IS NULL
      AND (r.closes_at IS NULL OR r.closes_at > now())
  )
);

CREATE POLICY "Admins can manage lottery tickets"
ON public.lottery_tickets
FOR ALL
USING (
  has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role)
  OR has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role)
)
WITH CHECK (
  has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role)
  OR has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role)
);

CREATE TRIGGER update_lottery_rounds_updated_at
BEFORE UPDATE ON public.lottery_rounds
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.lottery_rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lottery_tickets;

