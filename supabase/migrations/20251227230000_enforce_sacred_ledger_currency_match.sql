-- ============================================================================
-- MIGRATION: Sacred Ledger - Currency Enforcement Trigger
-- Purpose: Enforce that transaction currency MUST match parent account currency
-- Strategy: Database trigger overrides incoming currency_original with account's currency_code
-- Date: 2025-12-27
-- ============================================================================

-- SACRED LEDGER ARCHITECTURE
-- This trigger enforces the fundamental invariant:
--   transactions.currency_original === bank_accounts.currency_code
--
-- WHY: Transactions belong to accounts. Accounts have ONE currency.
--      Therefore, transactions MUST use that currency.
--
-- HOW: On INSERT/UPDATE, we fetch the account's currency_code
--      and FORCE it into currency_original, ignoring incoming value.
--
-- GUARANTEES:
--   - UI always shows correct currency in detail panel
--   - No visual mismatches (List PEN vs Detail EUR)
--   - Database is source of truth, not frontend

-- STEP 1: Create the enforcement function
CREATE OR REPLACE FUNCTION public.enforce_transaction_currency_matches_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_account_currency TEXT;
BEGIN
  -- Fetch the account's currency
  SELECT currency_code INTO v_account_currency
  FROM bank_accounts
  WHERE id = NEW.account_id;

  -- If account not found, raise clear error
  -- (This will execute before the foreign key constraint, providing clearer messaging)
  IF v_account_currency IS NULL THEN
    RAISE EXCEPTION 'Cannot insert/update transaction: account_id % does not exist', NEW.account_id;
  END IF;

  -- SACRED LEDGER ENFORCEMENT: Force currency to match account
  -- Ignore whatever value was provided in NEW.currency_original
  NEW.currency_original := v_account_currency;

  RETURN NEW;
END;
$$;

-- Add ownership
ALTER FUNCTION public.enforce_transaction_currency_matches_account() OWNER TO postgres;

-- Add documentation
COMMENT ON FUNCTION public.enforce_transaction_currency_matches_account() IS
'Sacred Ledger Guardian: Enforces that transactions.currency_original ALWAYS matches bank_accounts.currency_code. This trigger makes the database the final arbiter of currency consistency, preventing mismatches regardless of entry point (API, RPC, import, etc).';

-- STEP 2: Create the trigger
-- CRITICAL: Use BEFORE INSERT OR UPDATE with priority ordering
-- Must run BEFORE calculate_amount_home trigger (which uses currency)
-- Trigger names execute alphabetically, so "enforce_sacred_ledger" runs before "set_amount_home"
DROP TRIGGER IF EXISTS enforce_sacred_ledger_currency ON transactions;

CREATE TRIGGER enforce_sacred_ledger_currency
  BEFORE INSERT OR UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_transaction_currency_matches_account();

-- Add documentation
COMMENT ON TRIGGER enforce_sacred_ledger_currency ON transactions IS
'Sacred Ledger enforcement point: Runs before all other triggers to ensure currency_original matches account currency_code before any calculations or validations occur.';

-- STEP 3: Grant permissions
GRANT EXECUTE ON FUNCTION public.enforce_transaction_currency_matches_account() TO anon;
GRANT EXECUTE ON FUNCTION public.enforce_transaction_currency_matches_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_transaction_currency_matches_account() TO service_role;

-- ============================================================================
-- VERIFICATION QUERIES (For manual testing after migration)
-- ============================================================================
-- Uncomment and run these queries to test the trigger:
--
-- Test 1: Try to insert a transaction with wrong currency (should be auto-corrected)
-- SELECT id, currency_code FROM bank_accounts LIMIT 1;
--
-- INSERT INTO transactions (user_id, account_id, amount_original, currency_original, exchange_rate, amount_home, date, description)
-- VALUES (
--   (SELECT user_id FROM bank_accounts LIMIT 1),
--   (SELECT id FROM bank_accounts WHERE currency_code = 'USD' LIMIT 1),
--   100,
--   'EUR',  -- Wrong currency intentionally provided
--   1.0,
--   100,
--   NOW(),
--   'Sacred Ledger Test'
-- ) RETURNING id, currency_original;
--
-- Expected Result: currency_original should be 'USD' (not 'EUR')
--
-- Clean up test:
-- DELETE FROM transactions WHERE description = 'Sacred Ledger Test';
