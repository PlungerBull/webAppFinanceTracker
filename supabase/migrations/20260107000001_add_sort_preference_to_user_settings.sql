-- Add transaction_sort_preference column to user_settings (idempotent)
-- This stores the user's preferred sorting mode for the transaction ledger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_settings'
    AND column_name = 'transaction_sort_preference'
  ) THEN
    ALTER TABLE public.user_settings
    ADD COLUMN transaction_sort_preference text DEFAULT 'date' NOT NULL;
  END IF;
END $$;

-- Add constraint to enforce valid values ('date' or 'created_at') (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_settings_sort_preference_check'
  ) THEN
    ALTER TABLE public.user_settings
    ADD CONSTRAINT user_settings_sort_preference_check
    CHECK (transaction_sort_preference IN ('date', 'created_at'));
  END IF;
END $$;

-- Comment for documentation
COMMENT ON COLUMN user_settings.transaction_sort_preference IS
'User preference for transaction list sorting: date (Financial Ledger) or created_at (Activity Feed)';
