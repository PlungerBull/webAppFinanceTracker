-- ============================================================================
-- Ghost Prop Audit: Remove account_currency from transactions_view
-- S-Tier Architecture: Serialization Boundary Contract Enforcement
-- Date: 2026-02-01
-- ============================================================================
--
-- Purpose: Remove the redundant `account_currency` column from the transactions
-- view and related RPCs. This column duplicates `currency_original` and is never
-- accessed in UI components (confirmed via code grep).
--
-- Impact:
-- - Reduces JSON payload size for iOS native bridge
-- - Removes redundant JOIN data
-- - Aligns with Serialization Boundary Contract (MANIFESTO.md Section 7)
--
-- See: docs/NATIVE_PORTING_GUIDE.md for property inventory
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Recreate transactions_view WITHOUT account_currency
-- ============================================================================

DROP VIEW IF EXISTS transactions_view CASCADE;

CREATE OR REPLACE VIEW transactions_view
WITH (security_invoker = true) AS
SELECT
    t.id,
    t.user_id,
    t.account_id,
    t.category_id,
    t.amount_cents,
    t.amount_home_cents,
    ba.currency_code AS currency_original,  -- This is the canonical currency field
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
    -- REMOVED: ba.currency_code AS account_currency (Ghost Prop - redundant with currency_original)
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

COMMENT ON VIEW transactions_view IS 'Transactions view with joined account/category data - Ghost Prop audit removed redundant account_currency (use currency_original instead)';

-- ============================================================================
-- Step 2: Recreate get_deleted_transactions WITHOUT account_currency
-- ============================================================================

DROP FUNCTION IF EXISTS get_deleted_transactions(UUID, INTEGER);

CREATE FUNCTION get_deleted_transactions(
  p_user_id UUID,
  p_since_version INTEGER DEFAULT 0
) RETURNS TABLE (
  id UUID,
  user_id UUID,
  account_id UUID,
  category_id UUID,
  description TEXT,
  amount_cents BIGINT,
  amount_home_cents BIGINT,
  exchange_rate NUMERIC,
  date TIMESTAMPTZ,
  notes TEXT,
  source_text TEXT,
  inbox_id UUID,
  transfer_id UUID,
  reconciliation_id UUID,
  cleared BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  version INTEGER,
  deleted_at TIMESTAMPTZ,
  account_name TEXT,
  currency_original TEXT,
  -- REMOVED: account_currency TEXT (Ghost Prop - redundant with currency_original)
  account_color TEXT,
  category_name TEXT,
  category_color TEXT,
  category_type TEXT,
  reconciliation_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.user_id,
    t.account_id,
    t.category_id,
    t.description,
    t.amount_cents,
    t.amount_home_cents,
    t.exchange_rate,
    t.date,
    t.notes,
    t.source_text,
    t.inbox_id,
    t.transfer_id,
    t.reconciliation_id,
    t.cleared,
    t.created_at,
    t.updated_at,
    t.version,
    t.deleted_at,
    ba.name AS account_name,
    ba.currency_code AS currency_original,
    -- REMOVED: ba.currency_code AS account_currency
    ba.color AS account_color,
    c.name AS category_name,
    c.color AS category_color,
    c.type::TEXT AS category_type,
    r.status::TEXT AS reconciliation_status
  FROM transactions t
  LEFT JOIN bank_accounts ba ON t.account_id = ba.id
  LEFT JOIN categories c ON t.category_id = c.id
  LEFT JOIN reconciliations r ON t.reconciliation_id = r.id
  WHERE t.user_id = p_user_id
    AND t.deleted_at IS NOT NULL
    AND t.version > p_since_version
  ORDER BY t.version ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_deleted_transactions(UUID, INTEGER) IS 'Returns deleted transactions for delta sync - Ghost Prop audit removed redundant account_currency';

COMMIT;

-- ============================================================================
-- Post-migration: Regenerate TypeScript types
-- Run: supabase gen types typescript --project-id [id] > types/supabase.ts
-- ============================================================================
