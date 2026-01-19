-- ============================================================================
-- MIGRATION: Inbox BIGINT Standardization (Phase 1)
-- Purpose: Convert transaction_inbox from NUMERIC amount_original to BIGINT amount_cents
-- Date: 2026-01-20
-- ============================================================================
--
-- This migration completes the Integer Cents standardization by converting
-- the transaction_inbox table to use BIGINT amount_cents, matching the
-- ledger (transactions) table standardized in 20260119000000.
--
-- CRITICAL: This fixes the broken promote_inbox_item RPC which was proactively
-- hardened to reference amount_cents (see 20260119000002_harden_all_ledger_rpcs.sql).
--
-- CTO Mandate: "Integer Supremacy" - All monetary amounts stored as INTEGER CENTS.
-- ============================================================================

BEGIN;

-- Step 0: Drop dependent view
-- We need to drop the view before we can alter the columns it depends on
DROP VIEW IF EXISTS transaction_inbox_view CASCADE;

-- Step 1: Add new BIGINT column
-- This will store amounts in integer cents (e.g., $5.50 = 550)
ALTER TABLE transaction_inbox
ADD COLUMN amount_cents BIGINT;

-- Step 2: Migrate existing data (NUMERIC → BIGINT)
-- Current amount_original stores decimal dollars (e.g., 10.50)
-- Using ROUND to ensure precision during the one-time conversion
-- Example: 10.50 → ROUND(10.50 * 100) → 1050
UPDATE transaction_inbox
SET amount_cents = ROUND(amount_original * 100)::BIGINT
WHERE amount_original IS NOT NULL;

-- Step 3: Drop legacy NUMERIC column
-- Point of no return - we're burning the NUMERIC bridge
ALTER TABLE transaction_inbox
DROP COLUMN amount_original;

-- Step 4: Recreate view with BIGINT column
-- Maintains the same structure with amount_cents instead of amount_original
CREATE VIEW public.transaction_inbox_view
WITH (security_invoker = true)
AS
SELECT
  -- Core inbox fields
  i.id,
  i.user_id,
  i.amount_cents,        -- BIGINT (was amount_original)
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

-- Step 5: Restore view permissions (maintain existing access patterns)
GRANT ALL ON public.transaction_inbox_view TO anon;
GRANT ALL ON public.transaction_inbox_view TO authenticated;
GRANT ALL ON public.transaction_inbox_view TO service_role;

-- Step 6: Document changes for audit trail
COMMENT ON COLUMN transaction_inbox.amount_cents IS 'Integer Cents (BIGINT) - CTO Mandate: Integer Supremacy - standardized in Phase 1 migration';
COMMENT ON VIEW public.transaction_inbox_view IS 'Inbox view with BIGINT amount_cents and joined account/category data - migrated to INTEGER CENTS architecture';

COMMIT;
