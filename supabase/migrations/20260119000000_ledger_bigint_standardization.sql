-- ============================================================================
-- PREREQUISITE: Standardize Ledger (transactions) on BIGINT (Integer Cents)
-- CTO Mandate: Burn the NUMERIC bridge in the Sacred Ledger
-- Date: 2026-01-19
-- ============================================================================
--
-- Purpose: Convert transactions table from NUMERIC (decimal) to BIGINT (integer cents)
-- This creates the "Steel Foundation" for the Inbox migration by eliminating
-- the "Split Brain" where DB stores 10.50 but application expects 1050.
--
-- CRITICAL: This migration MUST succeed and `npm run build` must pass before
-- proceeding to the Inbox migration (Phase 1).
-- ============================================================================

BEGIN;

-- Step 0: Drop dependent views
-- We need to drop the view before we can alter the columns it depends on
DROP VIEW IF EXISTS transactions_view CASCADE;

-- Step 1: Add new BIGINT columns
-- These will store amounts in integer cents (e.g., $5.50 = 550)
ALTER TABLE transactions
ADD COLUMN amount_cents BIGINT,
ADD COLUMN amount_home_cents BIGINT;

-- Step 2: Migrate existing data (NUMERIC → BIGINT)
-- Using ROUND to ensure precision during the one-time conversion
-- Example: 10.50 → ROUND(10.50 * 100) → 1050
UPDATE transactions
SET
  amount_cents = ROUND(amount_original * 100)::BIGINT,
  amount_home_cents = ROUND(amount_home * 100)::BIGINT
WHERE amount_original IS NOT NULL;

-- Step 3: Drop legacy NUMERIC columns
-- Point of no return - we're burning the NUMERIC bridge
ALTER TABLE transactions
DROP COLUMN amount_original,
DROP COLUMN amount_home;

-- Step 4: Recreate view with BIGINT columns
CREATE OR REPLACE VIEW transactions_view
WITH (security_invoker = true) AS
SELECT
    t.id,
    t.user_id,
    t.account_id,
    t.category_id,
    t.amount_cents,        -- BIGINT (was amount_original)
    t.amount_home_cents,   -- BIGINT (was amount_home)
    ba.currency_code AS currency_original,  -- Derived from account
    t.exchange_rate,
    t.date,
    t.description,
    t.notes,
    t.source_text,
    t.transfer_id,
    t.reconciliation_id,
    t.cleared,
    t.inbox_id,
    t.version,
    t.created_at,
    t.updated_at,
    t.deleted_at,
    -- Joined data from accounts
    ba.name AS account_name,
    ba.currency_code AS account_currency,
    ba.color AS account_color,
    -- Joined data from categories
    c.name AS category_name,
    c.color AS category_color,
    c.type AS category_type,
    -- Joined data from reconciliations
    r.status AS reconciliation_status
FROM transactions t
LEFT JOIN bank_accounts ba ON t.account_id = ba.id
LEFT JOIN categories c ON t.category_id = c.id
LEFT JOIN reconciliations r ON t.reconciliation_id = r.id
WHERE t.deleted_at IS NULL;

-- Step 5: Audit Trail Preservation
-- Document the column types for future developers
COMMENT ON COLUMN transactions.amount_cents IS 'Sacred Ledger Unit: Integer Cents (BIGINT) - CTO Mandate #3: Sacred Integer Arithmetic';
COMMENT ON COLUMN transactions.amount_home_cents IS 'Home Currency Unit: Integer Cents (BIGINT) - Calculated by triggers based on exchange_rate';
COMMENT ON VIEW transactions_view IS 'Transactions view with BIGINT amount_cents and joined account/category data - updated for INTEGER CENTS migration';

COMMIT;
