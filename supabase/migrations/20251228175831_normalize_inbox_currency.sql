-- ============================================================================
-- MIGRATION: Inbox Currency Normalization - Remove Redundant currency_original
-- Purpose: Extend structural normalization from transactions to inbox
-- Date: 2025-12-28
--
-- This migration implements "Zero Redundancy" normalization by removing the
-- currency_original column from the transaction_inbox table. The column is
-- redundant because currency should be derived from the account (when assigned).
--
-- Strategy: Create inbox view with smart aliasing, then drop currency_original
-- Impact: Database schema only - ZERO frontend code changes required.
--
-- Part 2 of Unified Structural Normalization (Part 1: transactions, Part 2: inbox)
-- ============================================================================

BEGIN;  -- Atomic transaction - all steps succeed or all rollback

-- ============================================================================
-- STEP 1: Create transaction_inbox_view with smart aliasing
-- ============================================================================
-- CRITICAL: Must create view BEFORE dropping currency_original column
-- STRATEGY: Alias bank_accounts.currency_code AS currency_original
-- This eliminates ALL frontend transformer changes (zero code changes needed)
-- The view now exposes the same field name, but sourced from the account JOIN

DROP VIEW IF EXISTS public.transaction_inbox_view;

CREATE VIEW public.transaction_inbox_view
WITH (security_invoker = true)
AS
SELECT
  -- Core inbox fields
  i.id,
  i.user_id,
  i.amount_original,
  i.description,
  i.date,
  i.source_text,
  i.status,
  i.account_id,
  i.category_id,
  i.exchange_rate,
  i.notes,
  i.created_at,
  i.updated_at,

  -- Account fields (currency aliased from account via LEFT JOIN)
  a.name AS account_name,
  a.currency_code AS currency_original,  -- ALIASED (NULL if no account assigned)
  a.color AS account_color,

  -- Category fields
  c.name AS category_name,
  c.color AS category_color,
  c.type AS category_type
FROM transaction_inbox i
LEFT JOIN bank_accounts a ON i.account_id = a.id
LEFT JOIN categories c ON i.category_id = c.id;

-- Grant permissions (maintain existing access patterns)
GRANT ALL ON public.transaction_inbox_view TO anon;
GRANT ALL ON public.transaction_inbox_view TO authenticated;
GRANT ALL ON public.transaction_inbox_view TO service_role;

-- Update view documentation
COMMENT ON VIEW public.transaction_inbox_view IS
'Denormalized inbox view with account/category details. currency_original is ALIASED from bank_accounts.currency_code (NULL if no account assigned). Normalized architecture - no redundant storage.';

-- ============================================================================
-- STEP 2: Drop currency_original column (POINT OF NO RETURN)
-- ============================================================================
-- After this executes and the transaction commits, rollback requires data restore

ALTER TABLE public.transaction_inbox
DROP COLUMN IF EXISTS currency_original;

-- Update table documentation to reflect normalized architecture
COMMENT ON TABLE public.transaction_inbox IS
'Normalized inbox table (scratchpad for unprocessed transactions). Currency is derived from bank_accounts.currency_code via account_id (NULL if no account selected). Status values: pending, processed.';

-- ============================================================================
-- STEP 3: Update promote_inbox_item documentation
-- ============================================================================
-- Function already correctly omits currency_original from INSERT
-- See migration: 20251228180000_add_exchange_rate_to_promote_inbox.sql
-- The function does NOT reference currency_original field ✅

-- ============================================================================
-- Transaction complete - commit all changes atomically
-- ============================================================================

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (run manually after migration)
-- ============================================================================
-- Uncomment and run these queries to verify migration success:

-- 1. Verify column is dropped from transaction_inbox table
-- SELECT column_name
-- FROM information_schema.columns
-- WHERE table_name = 'transaction_inbox'
--   AND column_name = 'currency_original';
-- Expected: 0 rows

-- 2. Verify view still exposes currency_original (aliased from account)
-- SELECT column_name
-- FROM information_schema.columns
-- WHERE table_name = 'transaction_inbox_view'
--   AND column_name = 'currency_original';
-- Expected: 1 row (aliased from bank_accounts.currency_code)

-- 3. Test inbox creation with NULL account (currency-less draft)
-- INSERT INTO transaction_inbox (user_id, amount_original, description, status)
-- VALUES (auth.uid(), 100, 'Test Draft', 'pending');
-- SELECT id, description, currency_original FROM transaction_inbox_view WHERE description = 'Test Draft';
-- Expected: Row shows currency_original = NULL (no account assigned)

-- 4. Test inbox creation with account
-- INSERT INTO transaction_inbox (user_id, amount_original, description, status, account_id)
-- VALUES (auth.uid(), 100, 'Test With Account', 'pending', '<your-account-id>');
-- SELECT id, description, currency_original FROM transaction_inbox_view WHERE description = 'Test With Account';
-- Expected: Row shows currency_original matching the account's currency_code

-- 5. Test account change updates currency
-- UPDATE transaction_inbox SET account_id = '<different-account-id>' WHERE description = 'Test With Account';
-- SELECT id, description, currency_original FROM transaction_inbox_view WHERE description = 'Test With Account';
-- Expected: currency_original automatically updated to match new account's currency
