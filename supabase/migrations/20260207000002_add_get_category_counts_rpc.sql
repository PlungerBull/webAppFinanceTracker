-- ============================================================================
-- Add get_category_counts RPC + Composite Partial Indexes
-- Date: 2026-02-07
-- ============================================================================
--
-- Purpose: Replace client-side category count aggregation with server-side RPC.
-- Previously, getCategoryCounts fetched ALL category_id values for a user
-- and counted them in JavaScript (~10K rows for ~20 counts).
--
-- S-Tier Architecture: Queries transactions_view (not raw table) to inherit
-- the view's deleted_at IS NULL filter and any future view-level logic.
-- One source of truth for "what is an active transaction."
-- ============================================================================

-- ============================================================================
-- 1. RPC: get_category_counts
-- ============================================================================

CREATE OR REPLACE FUNCTION get_category_counts(
  p_user_id UUID,
  p_account_id UUID DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_cleared BOOLEAN DEFAULT NULL,
  p_reconciliation_id UUID DEFAULT NULL
) RETURNS TABLE (category_id UUID, count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT v.category_id, COUNT(*)::BIGINT
  FROM transactions_view v
  WHERE v.user_id = p_user_id
    AND (p_account_id IS NULL OR v.account_id = p_account_id)
    AND (p_start_date IS NULL OR v.date >= p_start_date)
    AND (p_end_date IS NULL OR v.date <= p_end_date)
    AND (p_cleared IS NULL OR v.cleared = p_cleared)
    AND (p_reconciliation_id IS NULL OR v.reconciliation_id = p_reconciliation_id)
  GROUP BY v.category_id;
END;
$$;

COMMENT ON FUNCTION get_category_counts IS 'Server-side category count aggregation. Queries transactions_view to inherit deleted_at filter. Returns one row per category_id with BIGINT count.';

-- ============================================================================
-- 2. Composite Partial Indexes for Filtered Pagination
-- ============================================================================

-- Account filter: the most common UI pattern (viewing one account at a time)
CREATE INDEX IF NOT EXISTS idx_transactions_composite_account_date
ON transactions (user_id, account_id, date DESC)
WHERE deleted_at IS NULL;

-- Category filter: used by sidebar counts and category-scoped views
CREATE INDEX IF NOT EXISTS idx_transactions_composite_category_date
ON transactions (user_id, category_id, date DESC)
WHERE deleted_at IS NULL;
