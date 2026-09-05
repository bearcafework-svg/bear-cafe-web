-- Max makeup (re-checkin) days per user per month — admin-editable via site_settings.
-- Used count is checkin_cycles.makeup_days length for the current cycle.

INSERT INTO public.site_settings (key, value)
VALUES (
  'checkin_max_makeup_days',
  '{"days": 3}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
