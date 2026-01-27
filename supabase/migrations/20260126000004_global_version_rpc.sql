-- Global Version RPC Functions
-- Provides utilities for sync clients to query version state
--
-- CTO MANDATES:
-- - Version-Based Sync: Uses global_transaction_version sequence
-- - No Backfill Required: Existing records with version=1 are valid
-- - Unified Sync Pulse: All syncable tables share the same sequence

-- ============================================================================
-- 1. GET CURRENT GLOBAL VERSION
-- ============================================================================
-- Returns the current value of the global version sequence.
-- Does NOT increment the sequence (uses last_value, not nextval).
--
-- Used by:
-- - Initial hydration to determine starting point for delta sync
-- - Sync health checks
-- ============================================================================

CREATE OR REPLACE FUNCTION get_current_global_version()
RETURNS INTEGER AS $$
DECLARE
  v_version INTEGER;
BEGIN
  SELECT last_value INTO v_version FROM global_transaction_version;
  RETURN COALESCE(v_version, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_current_global_version TO authenticated;

COMMENT ON FUNCTION get_current_global_version IS
  'Returns the current global version without incrementing. Used for sync initialization.';

-- ============================================================================
-- 2. GET MAX VERSION ACROSS SYNCED TABLES
-- ============================================================================
-- Returns the maximum version across all syncable tables for a user.
-- Useful for determining the true "high water mark" after initial hydration.
--
-- Returns JSON with:
-- - maxVersion: Overall maximum version
-- - byTable: Per-table max versions for debugging
-- ============================================================================

CREATE OR REPLACE FUNCTION get_max_version_for_user(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_txn_max INTEGER;
  v_account_max INTEGER;
  v_category_max INTEGER;
  v_inbox_max INTEGER;
  v_overall_max INTEGER;
BEGIN
  -- Get max version from each synced table
  SELECT COALESCE(MAX(version), 0) INTO v_txn_max
  FROM transactions WHERE user_id = p_user_id;

  SELECT COALESCE(MAX(version), 0) INTO v_account_max
  FROM bank_accounts WHERE user_id = p_user_id;

  SELECT COALESCE(MAX(version), 0) INTO v_category_max
  FROM categories WHERE user_id = p_user_id OR user_id IS NULL;

  SELECT COALESCE(MAX(version), 0) INTO v_inbox_max
  FROM transaction_inbox WHERE user_id = p_user_id;

  -- Calculate overall max
  v_overall_max := GREATEST(v_txn_max, v_account_max, v_category_max, v_inbox_max);

  RETURN jsonb_build_object(
    'maxVersion', v_overall_max,
    'byTable', jsonb_build_object(
      'transactions', v_txn_max,
      'bank_accounts', v_account_max,
      'categories', v_category_max,
      'transaction_inbox', v_inbox_max
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_max_version_for_user TO authenticated;

COMMENT ON FUNCTION get_max_version_for_user IS
  'Returns max version across all synced tables for a user. Used after initial hydration.';

-- ============================================================================
-- 3. GET CHANGES SINCE VERSION (Delta Sync Foundation)
-- ============================================================================
-- Returns counts of changed records since a given version.
-- Useful for checking if sync is needed before fetching data.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_sync_changes_summary(
  p_user_id UUID,
  p_since_version INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_txn_count INTEGER;
  v_account_count INTEGER;
  v_category_count INTEGER;
  v_inbox_count INTEGER;
BEGIN
  -- Count changes since version
  SELECT COUNT(*) INTO v_txn_count
  FROM transactions
  WHERE user_id = p_user_id AND version > p_since_version;

  SELECT COUNT(*) INTO v_account_count
  FROM bank_accounts
  WHERE user_id = p_user_id AND version > p_since_version;

  SELECT COUNT(*) INTO v_category_count
  FROM categories
  WHERE (user_id = p_user_id OR user_id IS NULL) AND version > p_since_version;

  SELECT COUNT(*) INTO v_inbox_count
  FROM transaction_inbox
  WHERE user_id = p_user_id AND version > p_since_version;

  RETURN jsonb_build_object(
    'sinceVersion', p_since_version,
    'hasChanges', (v_txn_count + v_account_count + v_category_count + v_inbox_count) > 0,
    'counts', jsonb_build_object(
      'transactions', v_txn_count,
      'bank_accounts', v_account_count,
      'categories', v_category_count,
      'transaction_inbox', v_inbox_count
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_sync_changes_summary TO authenticated;

COMMENT ON FUNCTION get_sync_changes_summary IS
  'Returns count of changes since a version. Use before delta sync to check if needed.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run these to verify the functions work:
--
-- SELECT get_current_global_version();
-- SELECT get_max_version_for_user('your-user-id');
-- SELECT get_sync_changes_summary('your-user-id', 0);
-- ============================================================================
