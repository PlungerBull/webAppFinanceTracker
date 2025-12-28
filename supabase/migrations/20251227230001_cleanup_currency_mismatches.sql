-- ============================================================================
-- MIGRATION: Sacred Ledger - Clean Existing Currency Mismatches
-- Purpose: One-time fix for transactions with mismatched currencies
-- Strategy: Update all transactions to match their account's currency_code
-- Date: 2025-12-27
-- ============================================================================

-- STEP 1: Audit existing mismatches (for logging)
DO $$
DECLARE
  v_mismatch_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_mismatch_count
  FROM transactions t
  INNER JOIN bank_accounts a ON t.account_id = a.id
  WHERE t.currency_original != a.currency_code;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Sacred Ledger Data Cleanup';
  RAISE NOTICE 'Found % transactions with currency mismatches', v_mismatch_count;
  RAISE NOTICE 'These will be corrected to match their account currency';
  RAISE NOTICE '========================================';
END $$;

-- STEP 2: Create backup table for audit trail
DROP TABLE IF EXISTS transactions_currency_cleanup_backup;

CREATE TABLE transactions_currency_cleanup_backup AS
SELECT
  t.id AS transaction_id,
  t.account_id,
  a.name AS account_name,
  t.currency_original AS old_currency,
  a.currency_code AS new_currency,
  t.amount_original,
  t.exchange_rate,
  t.amount_home,
  t.description,
  t.date,
  NOW() AS cleaned_at
FROM transactions t
INNER JOIN bank_accounts a ON t.account_id = a.id
WHERE t.currency_original != a.currency_code;

-- Add comment
COMMENT ON TABLE transactions_currency_cleanup_backup IS
'Audit trail of currency corrections made during Sacred Ledger migration (2025-12-27). Contains original values before trigger enforcement was implemented. This table can be safely dropped after verifying the migration was successful.';

-- STEP 3: Fix the mismatches
UPDATE transactions t
SET currency_original = a.currency_code
FROM bank_accounts a
WHERE t.account_id = a.id
  AND t.currency_original != a.currency_code;

-- STEP 4: Verify cleanup success
DO $$
DECLARE
  v_remaining_count INTEGER;
  v_fixed_count INTEGER;
BEGIN
  -- Check for remaining mismatches
  SELECT COUNT(*) INTO v_remaining_count
  FROM transactions t
  INNER JOIN bank_accounts a ON t.account_id = a.id
  WHERE t.currency_original != a.currency_code;

  -- Count how many we fixed
  SELECT COUNT(*) INTO v_fixed_count
  FROM transactions_currency_cleanup_backup;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Sacred Ledger Cleanup Results';
  RAISE NOTICE 'Fixed: % transactions', v_fixed_count;
  RAISE NOTICE 'Remaining mismatches: %', v_remaining_count;

  IF v_remaining_count > 0 THEN
    RAISE EXCEPTION 'CLEANUP FAILED: % mismatches still remain', v_remaining_count;
  ELSE
    RAISE NOTICE 'SUCCESS: All transactions now match their account currencies';
  END IF;

  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- VERIFICATION QUERY (Run manually after migration)
-- ============================================================================
-- Check integrity of Sacred Ledger:
--
-- SELECT
--   COUNT(*) as total_transactions,
--   COUNT(CASE WHEN t.currency_original = a.currency_code THEN 1 END) as matching,
--   COUNT(CASE WHEN t.currency_original != a.currency_code THEN 1 END) as mismatched
-- FROM transactions t
-- INNER JOIN bank_accounts a ON t.account_id = a.id;
--
-- Expected: mismatched = 0
--
-- View backup of corrected transactions:
-- SELECT * FROM transactions_currency_cleanup_backup ORDER BY cleaned_at DESC;
