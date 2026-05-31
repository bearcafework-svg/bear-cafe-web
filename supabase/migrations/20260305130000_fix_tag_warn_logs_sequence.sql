-- Create a sequence for tag_warn_logs if it doesn't exist (though it should as identity)
-- Assuming 'tag_warn_logs_sequence_seq' is the name, let's reset it.
-- But first, we need to find the MAX current sequence.

DO $$
DECLARE
  max_seq INTEGER;
BEGIN
  -- Get the current maximum sequence number from the table
  SELECT COALESCE(MAX(sequence), 0) INTO max_seq FROM public.tag_warn_logs;
  
  -- Reset the sequence to the next value
  -- Note: The sequence name is usually table_column_seq for IDENTITY columns
  -- We'll try to set it dynamically.
  
  IF max_seq < 586 THEN
      -- If the max found is less than the jump (e.g. 482), we might want to manually set it back?
      -- User said "jumped from 482 to 586". This means the next insert was 586.
      -- To fix "future" inserts, we should restart the sequence.
      -- But if 586 is already inserted, we can't easily "fill the gap" automatically without manual update.
      -- However, to ensure *future* numbers are consecutive from the *actual* max, we reset it.
      
      -- If the user wants to FIX the gap (renumber 586 -> 483), that's a data update.
      -- Let's provide a query to re-number the anomalous rows first.
      
      NULL; -- Logic handled in the SQL block below for the user to run.
  END IF;
END $$;

-- 1. Update the rows that jumped (e.g. 586) to be correct (e.g. 483)
-- This assumes we want to close the gap.
-- CAUTION: Only run this if you are sure you want to renumber existing rows.
WITH sorted_logs AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as new_rn
  FROM public.tag_warn_logs
)
UPDATE public.tag_warn_logs
SET sequence = sorted_logs.new_rn
FROM sorted_logs
WHERE public.tag_warn_logs.id = sorted_logs.id;

-- 2. Reset the sequence counter to the correct next value
SELECT setval(pg_get_serial_sequence('public.tag_warn_logs', 'sequence'), (SELECT COALESCE(MAX(sequence), 1) FROM public.tag_warn_logs));
