-- ============================================================================
-- MIGRATION: Fix Account Balance Currency Bug
-- Date: 2025-12-29
-- File: 20251229015648_fix_account_balance_currency_bug.sql
--
-- CRITICAL BUG FIX:
-- The update_account_balance_ledger() trigger incorrectly uses amount_home
-- (converted to home currency) instead of amount_original (account's native
-- currency) to update bank_accounts.current_balance.
--
-- IMPACT:
-- All foreign-currency accounts have corrupted balances. Example:
-- - Account currency: EUR, User home currency: USD
-- - Transaction: €100 with exchange rate 1.1 → amount_home = $110
-- - Bug: Adds $110 to EUR account balance (WRONG)
-- - Fix: Adds €100 to EUR account balance (CORRECT)
--
-- ARCHITECTURE:
-- We follow "One Account = One Currency" - each account holds exactly one
-- currency. The bug affects accounts whose currency differs from the user's
-- home currency (foreign-currency accounts).
--
-- SOLUTION:
-- 1. Pre-flight audit (log current state)
-- 2. Create backup table (for rollback and verification)
-- 3. Fix trigger function (replace amount_home with amount_original)
-- 4. Reconcile all account balances (recalculate from transactions)
-- 5. Verification queries (for manual post-migration testing)
--
-- SAFETY:
-- - Atomic transaction (all succeed or all rollback)
-- - Backup table preserves original state for 30 days
-- - Verification block fails migration if reconciliation incomplete
-- - Rollback strategy documented below
-- ============================================================================

BEGIN;  -- Start atomic transaction

-- ============================================================================
-- STEP 1: Pre-Flight Audit (Read-Only)
-- ============================================================================
-- Log current state before making any changes
-- This provides baseline metrics for verification

DO $$
DECLARE
  v_total_accounts INTEGER;
  v_accounts_with_transactions INTEGER;
  v_total_transactions INTEGER;
  v_max_balance_diff NUMERIC;
BEGIN
  -- Count total accounts
  SELECT COUNT(*) INTO v_total_accounts
  FROM bank_accounts;

  -- Count accounts with at least one transaction
  SELECT COUNT(DISTINCT account_id) INTO v_accounts_with_transactions
  FROM transactions;

  -- Count total transactions
  SELECT COUNT(*) INTO v_total_transactions
  FROM transactions;

  -- Calculate worst-case balance discrepancy
  SELECT MAX(ABS(discrepancy)) INTO v_max_balance_diff
  FROM (
    SELECT
      COALESCE(SUM(t.amount_original), 0) - ba.current_balance AS discrepancy
    FROM bank_accounts ba
    LEFT JOIN transactions t ON ba.id = t.account_id
    GROUP BY ba.id, ba.current_balance
  ) AS discrepancies;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Account Balance Currency Bug Fix';
  RAISE NOTICE 'Pre-Migration Audit';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total accounts: %', v_total_accounts;
  RAISE NOTICE 'Accounts with transactions: %', v_accounts_with_transactions;
  RAISE NOTICE 'Total transactions: %', v_total_transactions;
  RAISE NOTICE 'Maximum balance discrepancy: %', COALESCE(v_max_balance_diff, 0);
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- STEP 2: Create Backup Table
-- ============================================================================
-- Preserve original balances for audit trail and potential rollback

DROP TABLE IF EXISTS account_balance_currency_fix_backup;

CREATE TABLE account_balance_currency_fix_backup AS
SELECT
  ba.id AS account_id,
  ba.user_id,
  ba.name AS account_name,
  ba.currency_code AS account_currency,
  ba.current_balance AS old_balance,
  COALESCE(SUM(t.amount_original), 0) AS calculated_balance,
  ba.current_balance - COALESCE(SUM(t.amount_original), 0) AS discrepancy,
  COUNT(t.id) AS transaction_count,
  NOW() AS backed_up_at
FROM bank_accounts ba
LEFT JOIN transactions t ON ba.id = t.account_id
GROUP BY ba.id, ba.user_id, ba.name, ba.currency_code, ba.current_balance;

-- Create index for faster lookup during rollback
CREATE INDEX idx_backup_account_id ON account_balance_currency_fix_backup(account_id);

-- Add documentation
COMMENT ON TABLE account_balance_currency_fix_backup IS
'Backup of account balances before currency bug fix (2025-12-29). Contains old_balance (incorrect), calculated_balance (correct), and discrepancy. Safe to drop 30 days after migration success.';

-- Log backup statistics
DO $$
DECLARE
  v_accounts_with_discrepancy INTEGER;
  v_total_discrepancy NUMERIC;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE ABS(discrepancy) > 0.01),
    SUM(ABS(discrepancy))
  INTO v_accounts_with_discrepancy, v_total_discrepancy
  FROM account_balance_currency_fix_backup;

  RAISE NOTICE 'Backup created successfully';
  RAISE NOTICE 'Accounts affected by bug: %', v_accounts_with_discrepancy;
  RAISE NOTICE 'Total absolute discrepancy: %', COALESCE(v_total_discrepancy, 0);
END $$;

-- ============================================================================
-- STEP 3: Fix Trigger Function
-- ============================================================================
-- Replace amount_home with amount_original in all operations
-- Target by function name (not line numbers, as line numbers may vary)

CREATE OR REPLACE FUNCTION public.update_account_balance_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Handle DELETES (Subtract old amount in account's native currency)
    IF (TG_OP = 'DELETE') THEN
        UPDATE bank_accounts
        SET current_balance = current_balance - OLD.amount_original  -- FIXED: was amount_home
        WHERE id = OLD.account_id;
        RETURN OLD;

    -- Handle INSERTS (Add new amount in account's native currency)
    ELSIF (TG_OP = 'INSERT') THEN
        UPDATE bank_accounts
        SET current_balance = current_balance + NEW.amount_original  -- FIXED: was amount_home
        WHERE id = NEW.account_id;
        RETURN NEW;

    -- Handle UPDATES (Subtract old, Add new in account's native currency)
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Only update if the amount or account changed
        IF (OLD.amount_original <> NEW.amount_original) OR (OLD.account_id <> NEW.account_id) THEN  -- FIXED: was amount_home
            -- Revert old impact
            UPDATE bank_accounts
            SET current_balance = current_balance - OLD.amount_original  -- FIXED: was amount_home
            WHERE id = OLD.account_id;

            -- Apply new impact
            UPDATE bank_accounts
            SET current_balance = current_balance + NEW.amount_original  -- FIXED: was amount_home
            WHERE id = NEW.account_id;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$;

-- Update function ownership
ALTER FUNCTION public.update_account_balance_ledger() OWNER TO postgres;

-- Update function documentation
COMMENT ON FUNCTION public.update_account_balance_ledger() IS
'Maintains bank_accounts.current_balance as ledger of transactions in ACCOUNT NATIVE CURRENCY. Uses amount_original (not amount_home) to ensure balances reflect actual account currency amounts. Part of Zero Redundancy architecture where One Account = One Currency.';

-- Log trigger update
DO $$
BEGIN
  RAISE NOTICE 'Trigger function updated successfully';
END $$;

-- ============================================================================
-- STEP 4: Reconcile All Account Balances
-- ============================================================================
-- Recalculate every account balance from scratch using correct field

-- Update all account balances to sum of amount_original (correct calculation)
UPDATE bank_accounts ba
SET current_balance = COALESCE(calculated.balance, 0)
FROM (
  SELECT
    account_id,
    SUM(amount_original) AS balance
  FROM transactions
  GROUP BY account_id
) AS calculated
WHERE ba.id = calculated.account_id;

-- Handle accounts with zero transactions (set balance to 0)
UPDATE bank_accounts
SET current_balance = 0
WHERE id NOT IN (SELECT DISTINCT account_id FROM transactions);

-- Verification: Ensure all balances now match calculated values
DO $$
DECLARE
  v_mismatched_count INTEGER;
  v_total_updated INTEGER;
  v_zero_balance_accounts INTEGER;
BEGIN
  -- Count accounts that still have mismatched balances (should be 0)
  SELECT COUNT(*) INTO v_mismatched_count
  FROM bank_accounts ba
  LEFT JOIN (
    SELECT account_id, SUM(amount_original) AS balance
    FROM transactions
    GROUP BY account_id
  ) AS calc ON ba.id = calc.account_id
  WHERE ABS(ba.current_balance - COALESCE(calc.balance, 0)) > 0.01;

  -- Count how many accounts were reconciled
  SELECT COUNT(*) INTO v_total_updated
  FROM account_balance_currency_fix_backup
  WHERE ABS(discrepancy) > 0.01;

  -- Count accounts with zero balance
  SELECT COUNT(*) INTO v_zero_balance_accounts
  FROM bank_accounts
  WHERE current_balance = 0;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Balance Reconciliation Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Accounts reconciled: %', v_total_updated;
  RAISE NOTICE 'Accounts with zero balance: %', v_zero_balance_accounts;
  RAISE NOTICE 'Remaining mismatches: %', v_mismatched_count;

  IF v_mismatched_count > 0 THEN
    RAISE EXCEPTION 'RECONCILIATION FAILED: % accounts still have incorrect balances', v_mismatched_count;
  ELSE
    RAISE NOTICE 'SUCCESS: All account balances are now correct';
  END IF;

  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- Transaction complete - commit all changes atomically
-- ============================================================================

COMMIT;

-- ============================================================================
-- STEP 5: Post-Migration Verification Queries
-- ============================================================================
-- Uncomment and run these queries manually after migration to verify success

-- Query 1: View accounts that had their balance corrected
-- SELECT
--   account_name,
--   account_currency,
--   old_balance,
--   calculated_balance,
--   discrepancy,
--   transaction_count
-- FROM account_balance_currency_fix_backup
-- WHERE ABS(discrepancy) > 0.01
-- ORDER BY ABS(discrepancy) DESC;

-- Query 2: Verify trigger function uses correct field
-- SELECT
--   prosrc
-- FROM pg_proc
-- WHERE proname = 'update_account_balance_ledger';
-- Expected: Should contain 'amount_original', NOT 'amount_home'

-- Query 3: Test trigger with new transaction (in a separate transaction)
-- BEGIN;
--
-- -- Insert test transaction
-- INSERT INTO transactions (
--   user_id,
--   account_id,
--   amount_original,
--   exchange_rate,
--   amount_home,
--   date,
--   description
-- ) VALUES (
--   auth.uid(),
--   (SELECT id FROM bank_accounts LIMIT 1),
--   100.00,
--   1.1,
--   110.00,
--   NOW(),
--   'Trigger Test Transaction'
-- );
--
-- -- Verify balance updated by amount_original (100), not amount_home (110)
-- SELECT
--   ba.name,
--   ba.currency_code,
--   ba.current_balance,
--   (SELECT SUM(amount_original) FROM transactions WHERE account_id = ba.id) AS calculated_balance
-- FROM bank_accounts ba
-- WHERE id = (SELECT id FROM bank_accounts LIMIT 1);
-- -- Expected: current_balance should equal calculated_balance
--
-- ROLLBACK;

-- Query 4: Overall integrity check
-- SELECT
--   COUNT(*) as total_accounts,
--   COUNT(*) FILTER (WHERE current_balance = 0) as zero_balance_accounts,
--   COUNT(*) FILTER (WHERE current_balance > 0) as positive_balance_accounts,
--   COUNT(*) FILTER (WHERE current_balance < 0) as negative_balance_accounts,
--   SUM(current_balance) as total_balance_all_currencies
-- FROM bank_accounts;

-- Query 5: Per-currency balance summary
-- SELECT
--   currency_code,
--   COUNT(*) as account_count,
--   SUM(current_balance) as total_balance,
--   AVG(current_balance) as avg_balance,
--   MIN(current_balance) as min_balance,
--   MAX(current_balance) as max_balance
-- FROM bank_accounts
-- GROUP BY currency_code
-- ORDER BY currency_code;

-- ============================================================================
-- ROLLBACK STRATEGY (Use only in emergency)
-- ============================================================================
-- WARNING: This restores the BUG. Only use if migration causes production issues.
--
-- BEGIN;
--
-- -- Step 1: Restore old balances from backup
-- UPDATE bank_accounts ba
-- SET current_balance = backup.old_balance
-- FROM account_balance_currency_fix_backup backup
-- WHERE ba.id = backup.account_id;
--
-- -- Step 2: Restore old trigger function (with bug)
-- CREATE OR REPLACE FUNCTION public.update_account_balance_ledger()
-- RETURNS TRIGGER
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path TO 'public'
-- AS $$
-- BEGIN
--     IF (TG_OP = 'DELETE') THEN
--         UPDATE bank_accounts
--         SET current_balance = current_balance - OLD.amount_home  -- RESTORED BUG
--         WHERE id = OLD.account_id;
--         RETURN OLD;
--     ELSIF (TG_OP = 'INSERT') THEN
--         UPDATE bank_accounts
--         SET current_balance = current_balance + NEW.amount_home  -- RESTORED BUG
--         WHERE id = NEW.account_id;
--         RETURN NEW;
--     ELSIF (TG_OP = 'UPDATE') THEN
--         IF (OLD.amount_home <> NEW.amount_home) OR (OLD.account_id <> NEW.account_id) THEN
--             UPDATE bank_accounts
--             SET current_balance = current_balance - OLD.amount_home  -- RESTORED BUG
--             WHERE id = OLD.account_id;
--             UPDATE bank_accounts
--             SET current_balance = current_balance + NEW.amount_home  -- RESTORED BUG
--             WHERE id = NEW.account_id;
--         END IF;
--         RETURN NEW;
--     END IF;
--     RETURN NULL;
-- END;
-- $$;
--
-- -- Step 3: Verify rollback
-- SELECT COUNT(*) FROM account_balance_currency_fix_backup;
-- -- If 0 rows, rollback is impossible (backup table was dropped)
--
-- COMMIT;
--
-- RECOMMENDATION: Keep backup table for at least 30 days after migration

-- ============================================================================
-- CLEANUP (Run 30 days after migration if no issues)
-- ============================================================================
-- DROP TABLE IF EXISTS account_balance_currency_fix_backup;

-- ============================================================================
-- Migration Complete
-- ============================================================================
