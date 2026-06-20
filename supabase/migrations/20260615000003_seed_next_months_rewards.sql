-- Seed next 3 months with default reward configurations
-- This ensures admins have a template to start with

DO $$
DECLARE
  current_year INT;
  current_month INT;
  target_year INT;
  target_month INT;
  i INT;
BEGIN
  -- Get current year/month
  current_year := EXTRACT(YEAR FROM NOW());
  current_month := EXTRACT(MONTH FROM NOW());

  -- Seed current month + next 2 months (3 months total)
  FOR i IN 0..2 LOOP
    target_year := current_year;
    target_month := current_month + i;

    -- Handle year rollover
    IF target_month > 12 THEN
      target_year := target_year + 1;
      target_month := target_month - 12;
    END IF;

    -- Insert 28 days of default rewards for this month
    INSERT INTO public.checkin_daily_rewards (year, month, day_number, reward_type, reward_amount, makeup_cost, is_active)
    SELECT
      target_year,
      target_month,
      day_number,
      'points'::public.checkin_reward_type,
      10,
      50,
      true
    FROM generate_series(1, 28) as day_number
    ON CONFLICT (year, month, day_number) DO NOTHING;
  END LOOP;
END $$;
