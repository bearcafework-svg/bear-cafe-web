-- Migration: Add salmon_point feature
-- Requirements: 1.1, 1.2, 2.1, 3.x, 4.x, 5.x, 6.x, 9.x

-- ============================================================
-- 1. เพิ่มคอลัมน์ salmon_point ใน user_points
-- ============================================================
ALTER TABLE public.user_points
  ADD COLUMN IF NOT EXISTS salmon_point INTEGER NOT NULL DEFAULT 0
    CHECK (salmon_point >= 0);

-- ============================================================
-- 2. สร้างตาราง salmon_point_logs (audit log)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.salmon_point_logs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id       text        NOT NULL,
  bill_id          uuid        NOT NULL,
  change_type      text        NOT NULL CHECK (change_type IN ('insert', 'update', 'delete')),
  old_salmon_point integer,
  new_salmon_point integer,
  delta            integer,
  amount_before    numeric,
  amount_after     numeric,
  created_at       timestamptz DEFAULT now()
);

-- ============================================================
-- 3. Indexes สำหรับ salmon_point_logs
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_salmon_point_logs_discord_id
  ON public.salmon_point_logs (discord_id);

CREATE INDEX IF NOT EXISTS idx_salmon_point_logs_bill_id
  ON public.salmon_point_logs (bill_id);

CREATE INDEX IF NOT EXISTS idx_salmon_point_logs_created_at
  ON public.salmon_point_logs (created_at);

-- ============================================================
-- 4. Trigger function: fn_sync_salmon_point()
-- Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5,
--               5.1, 5.2, 5.3, 5.4, 5.5, 6.2
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_sync_salmon_point()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_discord_id    TEXT;
  v_old_sp        INTEGER;
  v_new_sp        INTEGER;
  v_delta         INTEGER;
  v_amount_before NUMERIC;
  v_amount_after  NUMERIC;
  v_change_type   TEXT;
  v_bill_id       UUID;
BEGIN
  -- --------------------------------------------------------
  -- Determine operation type and compute delta
  -- --------------------------------------------------------
  IF TG_OP = 'INSERT' THEN
    v_discord_id    := NEW.member_id;
    v_bill_id       := NEW.id;
    v_delta         := FLOOR(COALESCE(NEW.amount, 0) / 100);
    v_change_type   := 'insert';
    v_amount_before := NULL;
    v_amount_after  := NEW.amount;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Early return when FLOOR-level amount has not changed (Req 4.5)
    IF FLOOR(COALESCE(NEW.amount, 0) / 100) = FLOOR(COALESCE(OLD.amount, 0) / 100) THEN
      RETURN NEW;
    END IF;
    v_discord_id    := NEW.member_id;
    v_bill_id       := NEW.id;
    v_delta         := FLOOR(COALESCE(NEW.amount, 0) / 100) - FLOOR(COALESCE(OLD.amount, 0) / 100);
    v_change_type   := 'update';
    v_amount_before := OLD.amount;
    v_amount_after  := NEW.amount;

  ELSIF TG_OP = 'DELETE' THEN
    v_discord_id    := OLD.member_id;
    v_bill_id       := OLD.id;
    v_delta         := -(FLOOR(COALESCE(OLD.amount, 0) / 100));
    v_change_type   := 'delete';
    v_amount_before := OLD.amount;
    v_amount_after  := NULL;
  END IF;

  -- --------------------------------------------------------
  -- Early return when delta is zero (covers NULL amount too)
  -- --------------------------------------------------------
  IF v_delta = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- --------------------------------------------------------
  -- Read current salmon_point (0 if row does not exist yet)
  -- --------------------------------------------------------
  SELECT COALESCE(salmon_point, 0)
  INTO   v_old_sp
  FROM   public.user_points
  WHERE  discord_id = v_discord_id;

  v_old_sp := COALESCE(v_old_sp, 0);

  -- --------------------------------------------------------
  -- Compute new value, clamped at 0 (Req 6.2)
  -- --------------------------------------------------------
  v_new_sp := GREATEST(0, v_old_sp + v_delta);

  -- --------------------------------------------------------
  -- Upsert user_points (Req 3.2, 3.3, 4.2, 5.2)
  -- --------------------------------------------------------
  INSERT INTO public.user_points (discord_id, salmon_point)
  VALUES (v_discord_id, v_new_sp)
  ON CONFLICT (discord_id) DO UPDATE
    SET salmon_point = v_new_sp,
        updated_at   = now();

  -- --------------------------------------------------------
  -- Insert audit log (Req 3.4, 4.4, 5.4)
  -- --------------------------------------------------------
  INSERT INTO public.salmon_point_logs
    (discord_id, bill_id, change_type,
     old_salmon_point, new_salmon_point, delta,
     amount_before, amount_after, created_at)
  VALUES
    (v_discord_id, v_bill_id, v_change_type,
     v_old_sp, v_new_sp, v_new_sp - v_old_sp,
     v_amount_before, v_amount_after, now());

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================
-- 5. Trigger: trg_sync_salmon_point
-- Requirements: 3.x, 4.x, 5.x
-- ============================================================
DROP TRIGGER IF EXISTS trg_sync_salmon_point ON public.trading_history;
CREATE TRIGGER trg_sync_salmon_point
  AFTER INSERT OR UPDATE OR DELETE ON public.trading_history
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_salmon_point();

-- ============================================================
-- 6. RLS สำหรับ salmon_point_logs
-- Requirements: 9.1, 9.2, 9.3, 9.4
-- ============================================================
ALTER TABLE public.salmon_point_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read salmon_point_logs" ON public.salmon_point_logs;
CREATE POLICY "Admins can read salmon_point_logs"
  ON public.salmon_point_logs FOR SELECT
  TO authenticated
  USING ( public.has_page_access('trading-history') );

DROP POLICY IF EXISTS "Service role full access to salmon_point_logs" ON public.salmon_point_logs;
CREATE POLICY "Service role full access to salmon_point_logs"
  ON public.salmon_point_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
