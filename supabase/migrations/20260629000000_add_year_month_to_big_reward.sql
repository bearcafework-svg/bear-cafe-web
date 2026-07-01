-- Add year and month columns to checkin_big_reward for per-month configuration

ALTER TABLE public.checkin_big_reward
  ADD COLUMN IF NOT EXISTS year INT,
  ADD COLUMN IF NOT EXISTS month INT CHECK (month BETWEEN 1 AND 12);

DO $$
DECLARE
  existing_reward_type public.checkin_reward_type := 'points';
  existing_reward_amount INT := 100;
  existing_role_id TEXT;
  existing_description TEXT := 'Perfect attendance reward — checked in all 28 days!';
  target_year INT;
  target_month INT;
  i INT;
BEGIN
  SELECT reward_type, reward_amount, role_id, description
  INTO existing_reward_type, existing_reward_amount, existing_role_id, existing_description
  FROM public.checkin_big_reward
  WHERE year IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT reward_type, reward_amount, role_id, description
    INTO existing_reward_type, existing_reward_amount, existing_role_id, existing_description
    FROM public.checkin_big_reward
    LIMIT 1;
  END IF;

  IF existing_reward_type IS NULL THEN
    existing_reward_type := 'points';
    existing_reward_amount := 100;
    existing_description := 'Perfect attendance reward — checked in all 28 days!';
  END IF;

  INSERT INTO public.checkin_big_reward (year, month, reward_type, reward_amount, role_id, description)
  SELECT DISTINCT
    dr.year,
    dr.month,
    existing_reward_type,
    existing_reward_amount,
    existing_role_id,
    existing_description
  FROM public.checkin_daily_rewards dr
  WHERE NOT EXISTS (
    SELECT 1 FROM public.checkin_big_reward br
    WHERE br.year = dr.year AND br.month = dr.month
  );

  FOR i IN 0..2 LOOP
    target_year := EXTRACT(YEAR FROM NOW())::INT;
    target_month := EXTRACT(MONTH FROM NOW())::INT + i;

    IF target_month > 12 THEN
      target_year := target_year + 1;
      target_month := target_month - 12;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.checkin_big_reward br
      WHERE br.year = target_year AND br.month = target_month
    ) THEN
      INSERT INTO public.checkin_big_reward (year, month, reward_type, reward_amount, role_id, description)
      VALUES (
        target_year,
        target_month,
        existing_reward_type,
        existing_reward_amount,
        existing_role_id,
        existing_description
      );
    END IF;
  END LOOP;
END $$;

DELETE FROM public.checkin_big_reward
WHERE year IS NULL OR month IS NULL;

ALTER TABLE public.checkin_big_reward
  ALTER COLUMN year SET NOT NULL,
  ALTER COLUMN month SET NOT NULL;

ALTER TABLE public.checkin_big_reward
  ADD CONSTRAINT checkin_big_reward_unique UNIQUE (year, month);

CREATE INDEX IF NOT EXISTS idx_checkin_big_reward_year_month
  ON public.checkin_big_reward (year, month);

COMMENT ON TABLE public.checkin_big_reward IS
  'Per-month config for the 28-day perfect-attendance reward. Each year/month can have different reward settings.';
