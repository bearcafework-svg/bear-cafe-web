-- Update transaction format from DD/MM/YYYY (or D/M/YYYY) to YYYY-MM-DD (ISO 8601) for correct sorting
-- This handles both Christian Year (AD) and Buddhist Era (BE) by converting BE (>2400) to AD

UPDATE trading_history
SET transaction = 
  TO_CHAR(
    MAKE_DATE(
      -- Year: If > 2400 (BE), subtract 543 to get AD. Otherwise use as is.
      (split_part(transaction, '/', 3)::int - CASE WHEN split_part(transaction, '/', 3)::int > 2400 THEN 543 ELSE 0 END),
      -- Month
      split_part(transaction, '/', 2)::int,
      -- Day
      split_part(transaction, '/', 1)::int
    ),
    'YYYY-MM-DD'
  )
WHERE transaction ~ '^\d{1,2}/\d{1,2}/\d{4}$';
