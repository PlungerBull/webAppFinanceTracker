-- ============================================================================
-- MIGRATION: Currency Normalization - Remove Redundant currency_original
-- Purpose: Transition from enforced consistency to structural consistency
-- Date: 2025-12-28
--
-- This migration implements "Zero Redundancy" normalization by removing the
-- currency_original column from the transactions table. The column is redundant
-- because it's always synchronized with bank_accounts.currency_code via trigger.
--
-- Strategy: Atomic transaction with smart view aliasing to eliminate frontend changes.
-- Impact: Database schema only - ZERO frontend code changes required.
-- ============================================================================

BEGIN;  -- Atomic transaction - all steps succeed or all rollback

-- ============================================================================
-- STEP 1: Drop Foreign Key Constraint
-- ============================================================================
-- Must drop FK before dropping the column it references

ALTER TABLE public.transactions
DROP CONSTRAINT IF EXISTS fk_transactions_currency;

-- ============================================================================
-- STEP 2: Update transactions_view (CRITICAL - must execute before column drop)
-- ============================================================================
-- STRATEGY: Alias bank_accounts.currency_code AS currency_original
-- This eliminates ALL frontend transformer changes (zero code changes needed)
-- The view now exposes the same field name, but sourced from the account JOIN

DROP VIEW IF EXISTS public.transactions_view;

CREATE VIEW public.transactions_view
WITH (security_invoker = true)
AS
SELECT
  -- Core transaction fields
  t.id,
  t.user_id,
  t.account_id,
  t.category_id,
  t.description,
  t.amount_original,
  t.amount_home,
  t.exchange_rate,
  t.date,
  t.notes,
  t.source_text,
  t.inbox_id,
  t.transfer_id,
  t.created_at,
  t.updated_at,

  -- Account fields (currency now aliased from account)
  a.name AS account_name,
  a.currency_code AS currency_original,  -- ALIASED to match frontend expectation
  a.currency_code AS account_currency,   -- Also exposed for clarity
  a.color AS account_color,

  -- Category fields
  c.name AS category_name,
  c.color AS category_color,
  c.type AS category_type
FROM transactions t
LEFT JOIN bank_accounts a ON t.account_id = a.id
LEFT JOIN categories c ON t.category_id = c.id;

-- Grant permissions (maintain existing access patterns)
GRANT ALL ON public.transactions_view TO anon;
GRANT ALL ON public.transactions_view TO authenticated;
GRANT ALL ON public.transactions_view TO service_role;

-- Update view documentation
COMMENT ON VIEW public.transactions_view IS
'Denormalized view with account/category details. currency_original is ALIASED from bank_accounts.currency_code (normalized architecture - no redundant storage).';

-- ============================================================================
-- STEP 3: Drop Trigger (no longer needed)
-- ============================================================================
-- The trigger enforced currency synchronization, but normalization makes it obsolete

DROP TRIGGER IF EXISTS enforce_sacred_ledger_currency ON public.transactions;
DROP FUNCTION IF EXISTS public.enforce_transaction_currency_matches_account();

-- ============================================================================
-- STEP 4: Drop Column (POINT OF NO RETURN)
-- ============================================================================
-- After this executes and the transaction commits, rollback requires data restore

ALTER TABLE public.transactions
DROP COLUMN IF EXISTS currency_original;

-- Update table documentation to reflect normalized architecture
COMMENT ON TABLE public.transactions IS
'Normalized transactions table. Currency is ALWAYS derived from bank_accounts.currency_code via account_id. Type is determined implicitly: transfer (transfer_id NOT NULL), opening balance (category_id NULL and transfer_id NULL), or standard (category_id NOT NULL).';

-- ============================================================================
-- STEP 5: Update Trigger Documentation
-- ============================================================================
-- The calculate_amount_home trigger continues to work (doesn't reference currency)

COMMENT ON FUNCTION public.calculate_amount_home() IS
'Calculates amount_home as amount_original * exchange_rate. Currency is implicitly determined by account_id (via JOIN to bank_accounts.currency_code).';

-- ============================================================================
-- STEP 6: Fix create_account RPC
-- ============================================================================
-- This is the ONLY RPC that explicitly sets currency_original in its INSERT
-- Updated to remove currency_original from the opening balance transaction

CREATE OR REPLACE FUNCTION public.create_account(
  p_account_name text,
  p_account_color text,
  p_currency_code text,
  p_starting_balance numeric DEFAULT 0,
  p_account_type public.account_type DEFAULT 'checking'::public.account_type
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_account_id uuid;
  v_user_id uuid;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();

  -- Create bank account with specified currency
  INSERT INTO bank_accounts (user_id, name, color, currency_code, type)
  VALUES (v_user_id, p_account_name, p_account_color, p_currency_code, p_account_type)
  RETURNING id INTO v_account_id;

  -- Create opening balance transaction (if non-zero)
  IF p_starting_balance <> 0 THEN
    INSERT INTO transactions (
      user_id,
      account_id,
      category_id,     -- NULL (structural marker for opening balance)
      transfer_id,     -- NULL (not a transfer)
      -- REMOVED: currency_original - now derived from account_id via JOIN
      amount_original,
      amount_home,     -- Trigger will recalculate (amount_original * exchange_rate)
      exchange_rate,
      date,
      description
    ) VALUES (
      v_user_id,
      v_account_id,
      NULL,            -- Opening balance has no category
      NULL,            -- Opening balance has no transfer
      p_starting_balance,
      p_starting_balance,  -- Placeholder value, trigger will update
      1.0,             -- Opening balances use 1:1 rate (same currency as account)
      CURRENT_DATE,
      'Opening Balance'
    );
  END IF;

  -- Return account metadata
  RETURN jsonb_build_object(
    'id', v_account_id,
    'name', p_account_name,
    'color', p_account_color,
    'currency_code', p_currency_code,
    'type', p_account_type
  );
END;
$$;

-- Update function ownership and permissions
ALTER FUNCTION public.create_account(text, text, text, numeric, public.account_type) OWNER TO postgres;
GRANT ALL ON FUNCTION public.create_account(text, text, text, numeric, public.account_type) TO anon;
GRANT ALL ON FUNCTION public.create_account(text, text, text, numeric, public.account_type) TO authenticated;
GRANT ALL ON FUNCTION public.create_account(text, text, text, numeric, public.account_type) TO service_role;

-- Update function documentation
COMMENT ON FUNCTION public.create_account IS
'Creates account with optional opening balance. Currency is set on the account; opening balance transaction inherits currency via account_id.';

-- ============================================================================
-- STEP 7: Update replace_account_currency RPC
-- ============================================================================
-- Remove transaction update logic - currency now auto-derives from account

-- First, drop existing overloads to avoid naming conflicts
DROP FUNCTION IF EXISTS public.replace_account_currency(uuid, varchar, varchar, numeric);
DROP FUNCTION IF EXISTS public.replace_account_currency(uuid, varchar, varchar);

CREATE OR REPLACE FUNCTION public.replace_account_currency(
  p_account_id uuid,
  p_old_currency_code varchar,
  p_new_currency_code varchar
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Verify user owns this account (security check)
  IF NOT EXISTS (
    SELECT 1 FROM bank_accounts
    WHERE id = p_account_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Account not found or access denied';
  END IF;

  -- Update account's currency_code
  -- All transactions automatically reflect new currency via JOIN (normalized architecture)
  UPDATE bank_accounts
  SET currency_code = p_new_currency_code
  WHERE id = p_account_id
    AND currency_code = p_old_currency_code;

  -- REMOVED: Transaction update logic
  -- Previously updated transactions.currency_original, which is now deleted
  -- Currency is now automatically derived from account via JOIN
  -- All transactions instantly reflect new currency without explicit UPDATE
END;
$$;

-- Update function ownership and permissions
ALTER FUNCTION public.replace_account_currency(uuid, varchar, varchar) OWNER TO postgres;
GRANT ALL ON FUNCTION public.replace_account_currency(uuid, varchar, varchar) TO anon;
GRANT ALL ON FUNCTION public.replace_account_currency(uuid, varchar, varchar) TO authenticated;
GRANT ALL ON FUNCTION public.replace_account_currency(uuid, varchar, varchar) TO service_role;

-- Update function documentation
COMMENT ON FUNCTION public.replace_account_currency IS
'Updates account currency. All transactions automatically reflect new currency via account_id join (normalized architecture).';

-- ============================================================================
-- STEP 8: Verify promote_inbox_item RPC (NO CHANGES NEEDED)
-- ============================================================================
-- This function already correctly OMITS currency_original from INSERT
-- See migration: 20251228180000_add_exchange_rate_to_promote_inbox.sql
-- INSERT statement (lines 66-86) does NOT include currency_original ✅
-- Function documentation already reflects normalized architecture

-- ============================================================================
-- STEP 9: Verify import_transactions RPC (NO CHANGES NEEDED)
-- ============================================================================
-- This function already correctly OMITS currency_original from INSERT
-- See migration: 20251227230003_update_import_transactions_remove_currency.sql
-- INSERT statement (lines 88-110) does NOT include currency_original ✅
-- Function documentation already reflects normalized architecture

-- ============================================================================
-- STEP 10: Verify create_transfer RPC (NO CHANGES NEEDED)
-- ============================================================================
-- This function already correctly OMITS currency_original from INSERT
-- See migration: 20251227230004_update_create_transfer_remove_currency.sql
-- INSERT statement (lines 36-58) does NOT include currency_original ✅
-- Function documentation already reflects normalized architecture

-- ============================================================================
-- NOTE: calculate_amount_home trigger requires NO code changes
-- ============================================================================
-- The trigger only performs arithmetic (amount_original * exchange_rate)
-- It does NOT reference currency_original field ✅
-- It continues to work unchanged after column removal

-- ============================================================================
-- Transaction complete - commit all changes atomically
-- ============================================================================

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (run manually after migration)
-- ============================================================================
-- Uncomment and run these queries to verify migration success:

-- 1. Verify column is dropped from transactions table
-- SELECT column_name
-- FROM information_schema.columns
-- WHERE table_name = 'transactions'
--   AND column_name = 'currency_original';
-- Expected: 0 rows

-- 2. Verify view still exposes currency_original (aliased from account)
-- SELECT column_name
-- FROM information_schema.columns
-- WHERE table_name = 'transactions_view'
--   AND column_name = 'currency_original';
-- Expected: 1 row (aliased from bank_accounts.currency_code)

-- 3. Verify view also exposes account_currency
-- SELECT column_name
-- FROM information_schema.columns
-- WHERE table_name = 'transactions_view'
--   AND column_name = 'account_currency';
-- Expected: 1 row

-- 4. Test transaction creation with currency derivation
-- INSERT INTO transactions (user_id, account_id, amount_original, date, description)
-- VALUES (auth.uid(), '<your-account-id>', 100, now(), 'Normalization Test');
-- SELECT id, description, currency_original FROM transactions_view WHERE description = 'Normalization Test';
-- Expected: Row shows currency matching the account's currency_code

-- 5. Verify trigger is dropped
-- SELECT tgname
-- FROM pg_trigger
-- WHERE tgname = 'enforce_sacred_ledger_currency';
-- Expected: 0 rows

-- 6. Verify FK constraint is dropped
-- SELECT constraint_name
-- FROM information_schema.table_constraints
-- WHERE table_name = 'transactions'
--   AND constraint_name = 'fk_transactions_currency';
-- Expected: 0 rows
