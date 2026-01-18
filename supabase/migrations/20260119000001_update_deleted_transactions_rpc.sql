-- ============================================================================
-- UPDATE: Fix get_deleted_transactions RPC to return BIGINT columns
-- Part of Move 0: Ledger BIGINT Standardization
-- Date: 2026-01-19
-- ============================================================================
--
-- Purpose: Update get_deleted_transactions RPC to return amount_cents and
-- amount_home_cents (BIGINT) instead of amount_original and amount_home (NUMERIC)
--
-- This migration must run AFTER the main ledger BIGINT migration.
-- ============================================================================

-- Drop existing function (PostgreSQL doesn't allow changing return signature with CREATE OR REPLACE)
DROP FUNCTION IF EXISTS get_deleted_transactions(UUID, INTEGER);

-- Recreate with BIGINT return columns
CREATE FUNCTION get_deleted_transactions(
  p_user_id UUID,
  p_since_version INTEGER DEFAULT 0
) RETURNS TABLE (
  id UUID,
  user_id UUID,
  account_id UUID,
  category_id UUID,
  description TEXT,
  amount_cents BIGINT,         -- Changed from amount_original NUMERIC
  amount_home_cents BIGINT,    -- Changed from amount_home NUMERIC
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
  account_currency TEXT,
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
    t.amount_cents,              -- Changed from t.amount_original
    t.amount_home_cents,         -- Changed from t.amount_home
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
    ba.currency_code AS account_currency,
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

COMMENT ON FUNCTION get_deleted_transactions(UUID, INTEGER) IS 'Returns deleted transactions for delta sync - updated for BIGINT amount_cents columns';
