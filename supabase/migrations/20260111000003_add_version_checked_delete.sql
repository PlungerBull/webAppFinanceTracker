-- ============================================================================
-- MIGRATION: Version-Checked Transaction Delete RPC
-- Purpose: Prevent accidental deletion of modified transactions
-- Date: 2026-01-11
-- Architecture: CTO Refinement #3 - Strict versioning on delete
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_transaction_with_version(
  p_transaction_id UUID,
  p_expected_version INTEGER
) RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_current_version INTEGER;
  v_user_id UUID;
  v_rows_deleted INTEGER;
  v_transaction_data JSONB;
BEGIN
  -- 1. Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- 2. Check current version and capture transaction data for confirmation
  SELECT version, jsonb_build_object(
    'description', description,
    'amountOriginal', amount_original,
    'date', date,
    'accountId', account_id,
    'categoryId', category_id
  )
  INTO v_current_version, v_transaction_data
  FROM transactions
  WHERE id = p_transaction_id
    AND user_id = v_user_id;

  -- Transaction not found or access denied
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'not_found'
    );
  END IF;

  -- 3. Version conflict check
  -- If version changed, someone else modified it - confirm before deleting
  IF v_current_version != p_expected_version THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'version_conflict',
      'expectedVersion', p_expected_version,
      'currentVersion', v_current_version,
      'currentData', v_transaction_data,
      'message', 'This transaction has been modified since you last viewed it'
    );
  END IF;

  -- 4. Perform delete with version guard
  DELETE FROM transactions
  WHERE id = p_transaction_id
    AND user_id = v_user_id
    AND version = p_expected_version; -- Ensure we're deleting the expected version

  GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;

  -- 5. Check if delete succeeded
  IF v_rows_deleted = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'concurrent_modification'
    );
  END IF;

  -- 6. Success
  RETURN jsonb_build_object(
    'success', true
  );
END;
$$;

ALTER FUNCTION delete_transaction_with_version(UUID, INTEGER)
OWNER TO postgres;

COMMENT ON FUNCTION delete_transaction_with_version(UUID, INTEGER) IS
'Version-safe transaction delete. Prevents accidental deletion of modified transactions.

Scenario:
- User A edits transaction (version 1 → 2)
- User B tries to delete (knows version 1)
- RPC returns version_conflict with current data
- User B sees toast: "This transaction has been modified. Are you sure?"
- User B confirms → Frontend fetches fresh version → Deletes version 2

Parameters:
- p_transaction_id: Transaction to delete
- p_expected_version: Version client expects

Returns JSONB:
- success: true/false
- error: "version_conflict", "not_found", or "concurrent_modification"
- currentData: Current transaction data (for conflict confirmation UI)
- message: User-friendly error message';
