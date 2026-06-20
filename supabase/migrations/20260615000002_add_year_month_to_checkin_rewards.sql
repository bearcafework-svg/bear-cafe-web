-- Add year and month columns to checkin_daily_rewards for per-month configuration
-- This allows admins to set different rewards for each month

-- Step 1: Add new columns
ALTER TABLE public.checkin_daily_rewards
  ADD COLUMN year INT,
  ADD COLUMN month INT CHECK (month BETWEEN 1 AND 12);

-- Step 2: Set default values for existing rows (current month)
UPDATE public.checkin_daily_rewards
SET
  year = EXTRACT(YEAR FROM NOW()),
  month = EXTRACT(MONTH FROM NOW())
WHERE year IS NULL OR month IS NULL;

-- Step 3: Make columns NOT NULL after setting defaults
ALTER TABLE public.checkin_daily_rewards
  ALTER COLUMN year SET NOT NULL,
  ALTER COLUMN month SET NOT NULL;

-- Step 4: Drop old unique constraint and create new one with year/month
ALTER TABLE public.checkin_daily_rewards
  DROP CONSTRAINT IF EXISTS checkin_daily_rewards_day_number_key;

ALTER TABLE public.checkin_daily_rewards
  ADD CONSTRAINT checkin_daily_rewards_unique
  UNIQUE (year, month, day_number);

-- Step 5: Create index for faster queries
CREATE INDEX idx_checkin_daily_rewards_year_month
  ON public.checkin_daily_rewards (year, month);

-- Step 6: Update comment
COMMENT ON TABLE public.checkin_daily_rewards IS
  'Daily check-in rewards configuration per month. Each year/month can have different reward settings for days 1-28.';
