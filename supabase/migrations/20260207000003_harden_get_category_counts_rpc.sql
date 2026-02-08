-- ============================================================================
-- S-Tier Security Hardening: get_category_counts RPC
-- Date: 2026-02-07
-- ============================================================================
--
-- Problem: The SECURITY DEFINER function trusts the passed p_user_id parameter.
-- If a developer calls the RPC with a different user's ID, it bypasses RLS and
-- returns cross-tenant data. This is the standard SECURITY DEFINER pitfall.
--
-- Fix: Assert p_user_id = auth.uid() inside the function body. This follows
-- the established codebase pattern (see reconciliation RPCs, version-checked
-- delete, account version ops) where every SECURITY DEFINER function validates
-- the caller's identity against auth.uid().
--
-- Also: COALESCE NULL category_id to sentinel UUID for type-safe frontend
-- consumption (Ghost Category handling).
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
DECLARE
  v_auth_uid UUID;
BEGIN
  -- Multi-tenant safety: assert caller identity matches p_user_id
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  IF v_auth_uid != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: p_user_id does not match authenticated user';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(v.category_id, '00000000-0000-0000-0000-000000000000'::UUID) AS category_id,
    COUNT(*)::BIGINT
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

COMMENT ON FUNCTION get_category_counts IS 'Server-side category count aggregation with auth.uid() assertion. Queries transactions_view to inherit deleted_at filter. COALESCE maps NULL category to sentinel UUID.';
