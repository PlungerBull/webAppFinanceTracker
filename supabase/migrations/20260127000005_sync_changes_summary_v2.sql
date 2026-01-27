-- ============================================================================
-- MIGRATION: Sync Changes Summary V2 for Delta Sync Quick Check
-- Purpose: 10ms early-exit optimization - check if sync is needed
-- Date: 2026-01-27
--
-- CTO MANDATES:
-- - Pull Engine MUST have quick check (~10ms)
-- - Returns has_changes boolean for early exit
-- - Returns latest_server_version for comparison
--
-- If latest_server_version === local_last_synced_version, exit without fetching data.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_sync_changes_summary_v2(
  p_user_id UUID,
  p_since_version INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_latest_version INTEGER;
  v_has_changes BOOLEAN;
BEGIN
  -- Get latest server version across all syncable tables
  -- Using subquery with UNION ALL for efficiency
  SELECT COALESCE(MAX(version), 0)
  INTO v_latest_version
  FROM (
    SELECT MAX(version) as version
    FROM transactions
    WHERE user_id = p_user_id

    UNION ALL

    SELECT MAX(version)
    FROM bank_accounts
    WHERE user_id = p_user_id

    UNION ALL

    SELECT MAX(version)
    FROM categories
    WHERE user_id = p_user_id OR user_id IS NULL

    UNION ALL

    SELECT MAX(version)
    FROM transaction_inbox
    WHERE user_id = p_user_id
  ) t;

  -- Check if there are changes
  v_has_changes := v_latest_version > p_since_version;

  RETURN jsonb_build_object(
    'has_changes', v_has_changes,
    'latest_server_version', v_latest_version,
    'since_version', p_since_version
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_sync_changes_summary_v2(UUID, INTEGER) TO authenticated;

COMMENT ON FUNCTION get_sync_changes_summary_v2(UUID, INTEGER) IS
'Quick sync check for Delta Sync Pull Engine (~10ms).
Returns has_changes boolean and latest_server_version.
If latest_server_version equals local version, client can skip pull entirely.
This avoids unnecessary data fetching when nothing has changed.';

-- ============================================================================
-- INDEX OPTIMIZATION
-- ============================================================================
-- Ensure version columns are indexed for efficient MAX() queries
-- These indexes should already exist from previous migrations, but we add
-- IF NOT EXISTS for safety.

DO $$
BEGIN
  -- Index for transactions version
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'transactions' AND indexname = 'idx_transactions_user_version'
  ) THEN
    CREATE INDEX idx_transactions_user_version ON transactions(user_id, version);
  END IF;

  -- Index for bank_accounts version
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'bank_accounts' AND indexname = 'idx_bank_accounts_user_version'
  ) THEN
    CREATE INDEX idx_bank_accounts_user_version ON bank_accounts(user_id, version);
  END IF;

  -- Index for categories version
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'categories' AND indexname = 'idx_categories_user_version'
  ) THEN
    CREATE INDEX idx_categories_user_version ON categories(user_id, version);
  END IF;

  -- Index for transaction_inbox version
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'transaction_inbox' AND indexname = 'idx_transaction_inbox_user_version'
  ) THEN
    CREATE INDEX idx_transaction_inbox_user_version ON transaction_inbox(user_id, version);
  END IF;
END;
$$;
