-- ============================================================================
-- Migration: Add Minigame Change Requests and Audit Columns
-- Date: 2026-09-09
-- ============================================================================

-- 1. Add audit & status columns to public.minigame_questions
ALTER TABLE public.minigame_questions
ADD COLUMN IF NOT EXISTS created_by TEXT,
ADD COLUMN IF NOT EXISTS created_by_name TEXT,
ADD COLUMN IF NOT EXISTS updated_by TEXT,
ADD COLUMN IF NOT EXISTS updated_by_name TEXT,
ADD COLUMN IF NOT EXISTS deleted_by TEXT,
ADD COLUMN IF NOT EXISTS deleted_by_name TEXT,
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'pending_create', 'pending_update', 'pending_delete', 'deleted')),
ADD COLUMN IF NOT EXISTS pending_request_id UUID;

COMMENT ON COLUMN public.minigame_questions.created_by IS 'Discord ID หรือ Profile ID ของผู้เพิ่มคำถาม';
COMMENT ON COLUMN public.minigame_questions.created_by_name IS 'ชื่อของผู้เพิ่มคำถาม';
COMMENT ON COLUMN public.minigame_questions.updated_by IS 'Discord ID หรือ Profile ID ของผู้แก้ไขล่าสุด';
COMMENT ON COLUMN public.minigame_questions.updated_by_name IS 'ชื่อของผู้แก้ไขล่าสุด';
COMMENT ON COLUMN public.minigame_questions.status IS 'สถานะคำถาม (approved = ใช้งานในเกม, pending_create, pending_update, pending_delete, deleted)';

-- 2. Create Staging Table: public.minigame_change_requests
CREATE TABLE IF NOT EXISTS public.minigame_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id INT REFERENCES public.minigame_questions(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('create', 'update', 'delete')),
  game_id INT NOT NULL,
  new_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  old_data JSONB,
  requested_by TEXT NOT NULL,
  requested_by_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejected_by TEXT,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_minigame_change_requests_status ON public.minigame_change_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_minigame_change_requests_game_id ON public.minigame_change_requests(game_id);
CREATE INDEX IF NOT EXISTS idx_minigame_change_requests_question_id ON public.minigame_change_requests(question_id);

-- Link foreign key constraint on minigame_questions.pending_request_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_minigame_questions_pending_request'
  ) THEN
    ALTER TABLE public.minigame_questions
    ADD CONSTRAINT fk_minigame_questions_pending_request
    FOREIGN KEY (pending_request_id)
    REFERENCES public.minigame_change_requests(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Enable RLS
ALTER TABLE public.minigame_change_requests ENABLE ROW LEVEL SECURITY;

-- Policies for minigame_change_requests
DROP POLICY IF EXISTS "Allow staff and owner to read minigame requests" ON public.minigame_change_requests;
CREATE POLICY "Allow staff and owner to read minigame requests"
ON public.minigame_change_requests FOR SELECT
TO authenticated
USING (public.is_owner() OR public.has_page_access('minigames') OR public.has_page_access('reports'));

DROP POLICY IF EXISTS "Allow staff to insert minigame requests" ON public.minigame_change_requests;
CREATE POLICY "Allow staff to insert minigame requests"
ON public.minigame_change_requests FOR INSERT
TO authenticated
WITH CHECK (public.is_owner() OR public.has_page_access('minigames'));

DROP POLICY IF EXISTS "Allow owner to update/manage minigame requests" ON public.minigame_change_requests;
CREATE POLICY "Allow owner to update/manage minigame requests"
ON public.minigame_change_requests FOR ALL
TO authenticated
USING (public.is_owner())
WITH CHECK (public.is_owner());

-- 4. Batch Approve RPC Function (Atomic Transaction)
CREATE OR REPLACE FUNCTION public.batch_approve_minigame_requests(
  _request_ids UUID[],
  _approver_id TEXT,
  _approver_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_req RECORD;
  v_approved_count INT := 0;
  v_new_q_id INT;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'เฉพาะเจ้าของร้าน (Owner) เท่านั้นที่มีสิทธิ์อนุมัติคำขอ';
  END IF;

  FOR v_req IN
    SELECT * FROM public.minigame_change_requests
    WHERE id = ANY(_request_ids) AND status = 'pending'
    FOR UPDATE
  LOOP
    IF v_req.action_type = 'create' THEN
      -- INSERT new question into minigame_questions
      INSERT INTO public.minigame_questions (
        game_id,
        word_or_question,
        answer,
        category,
        hints,
        options,
        difficulty,
        is_active,
        status,
        created_by,
        created_by_name,
        updated_by,
        updated_by_name
      ) VALUES (
        v_req.game_id,
        COALESCE(v_req.new_data->>'word_or_question', ''),
        COALESCE(v_req.new_data->>'answer', ''),
        COALESCE(v_req.new_data->>'category', 'คำทั่วไป'),
        CASE
          WHEN v_req.new_data ? 'hints' AND jsonb_typeof(v_req.new_data->'hints') = 'array'
          THEN ARRAY(SELECT jsonb_array_elements_text(v_req.new_data->'hints'))
          ELSE ARRAY[]::text[]
        END,
        CASE
          WHEN v_req.new_data ? 'options' AND jsonb_typeof(v_req.new_data->'options') = 'array'
          THEN ARRAY(SELECT jsonb_array_elements_text(v_req.new_data->'options'))
          ELSE ARRAY[]::text[]
        END,
        v_req.new_data->>'difficulty',
        COALESCE((v_req.new_data->>'is_active')::boolean, true),
        'approved',
        v_req.requested_by,
        v_req.requested_by_name,
        _approver_id,
        _approver_name
      )
      RETURNING id INTO v_new_q_id;

      -- Update request with new question id
      UPDATE public.minigame_change_requests
      SET question_id = v_new_q_id
      WHERE id = v_req.id;

    ELSIF v_req.action_type = 'update' AND v_req.question_id IS NOT NULL THEN
      -- UPDATE existing question
      UPDATE public.minigame_questions
      SET
        word_or_question = COALESCE(v_req.new_data->>'word_or_question', word_or_question),
        answer = COALESCE(v_req.new_data->>'answer', answer),
        category = COALESCE(v_req.new_data->>'category', category),
        hints = CASE
          WHEN v_req.new_data ? 'hints' AND jsonb_typeof(v_req.new_data->'hints') = 'array'
          THEN ARRAY(SELECT jsonb_array_elements_text(v_req.new_data->'hints'))
          ELSE hints
        END,
        options = CASE
          WHEN v_req.new_data ? 'options' AND jsonb_typeof(v_req.new_data->'options') = 'array'
          THEN ARRAY(SELECT jsonb_array_elements_text(v_req.new_data->'options'))
          ELSE options
        END,
        difficulty = CASE
          WHEN v_req.new_data ? 'difficulty' THEN v_req.new_data->>'difficulty'
          ELSE difficulty
        END,
        is_active = CASE
          WHEN v_req.new_data ? 'is_active' THEN (v_req.new_data->>'is_active')::boolean
          ELSE is_active
        END,
        status = 'approved',
        pending_request_id = NULL,
        updated_by = v_req.requested_by,
        updated_by_name = v_req.requested_by_name,
        updated_at = now()
      WHERE id = v_req.question_id;

    ELSIF v_req.action_type = 'delete' AND v_req.question_id IS NOT NULL THEN
      -- DELETE question from minigame_questions
      DELETE FROM public.minigame_questions
      WHERE id = v_req.question_id;
    END IF;

    -- Mark request as approved
    UPDATE public.minigame_change_requests
    SET
      status = 'approved',
      approved_by = _approver_id,
      approved_at = now(),
      updated_at = now()
    WHERE id = v_req.id;

    v_approved_count := v_approved_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'approved_count', v_approved_count
  );
END;
$$;

-- 5. Batch Reject RPC Function
CREATE OR REPLACE FUNCTION public.batch_reject_minigame_requests(
  _request_ids UUID[],
  _rejecter_id TEXT,
  _reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_req RECORD;
  v_rejected_count INT := 0;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'เฉพาะเจ้าของร้าน (Owner) เท่านั้นที่มีสิทธิ์ปฏิเสธคำขอ';
  END IF;

  FOR v_req IN
    SELECT * FROM public.minigame_change_requests
    WHERE id = ANY(_request_ids) AND status = 'pending'
    FOR UPDATE
  LOOP
    -- If there was a linked question in minigame_questions with pending status, clear pending_request_id and restore status
    IF v_req.question_id IS NOT NULL THEN
      UPDATE public.minigame_questions
      SET
        status = 'approved',
        pending_request_id = NULL
      WHERE id = v_req.question_id;
    END IF;

    -- Mark request as rejected
    UPDATE public.minigame_change_requests
    SET
      status = 'rejected',
      rejected_by = _rejecter_id,
      rejected_at = now(),
      rejection_reason = _reason,
      updated_at = now()
    WHERE id = v_req.id;

    v_rejected_count := v_rejected_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'rejected_count', v_rejected_count
  );
END;
$$;
