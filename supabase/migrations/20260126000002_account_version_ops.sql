-- ============================================================================
-- MIGRATION: Version-Checked Account Operations
-- Purpose: Atomic update and soft-delete with optimistic concurrency control
-- Date: 2026-01-26
-- Architecture: CTO Mandate - Tombstone pattern for distributed sync
-- ============================================================================

-- ============================================================================
-- 1. VERSION-CHECKED UPDATE
-- ============================================================================
CREATE OR REPLACE FUNCTION update_account_with_version(
  p_account_id UUID,
  p_expected_version INTEGER,
  p_name TEXT DEFAULT NULL,
  p_color TEXT DEFAULT NULL,
  p_is_visible BOOLEAN DEFAULT NULL
) RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_current_version INTEGER;
  v_user_id UUID;
  v_rows_updated INTEGER;
BEGIN
  -- 1. Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- 2. Check current version
  SELECT version INTO v_current_version
  FROM bank_accounts
  WHERE id = p_account_id
    AND user_id = v_user_id
    AND deleted_at IS NULL; -- Don't update tombstoned accounts

  -- Account not found or access denied
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'not_found'
    );
  END IF;

  -- 3. Version conflict check
  IF v_current_version != p_expected_version THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'version_conflict',
      'expectedVersion', p_expected_version,
      'currentVersion', v_current_version,
      'message', 'Account has been modified by another device'
    );
  END IF;

  -- 4. Perform update (version auto-increments via trigger)
  -- Only update fields that are provided (not NULL)
  UPDATE bank_accounts
  SET
    name = COALESCE(p_name, name),
    color = COALESCE(p_color, color),
    is_visible = COALESCE(p_is_visible, is_visible)
  WHERE id = p_account_id
    AND user_id = v_user_id
    AND version = p_expected_version
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  -- 5. Check if update succeeded
  IF v_rows_updated = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'concurrent_modification'
    );
  END IF;

  -- 6. Success
  RETURN jsonb_build_object(
    'success', true,
    'newVersion', p_expected_version + 1
  );
END;
$$;

ALTER FUNCTION update_account_with_version(UUID, INTEGER, TEXT, TEXT, BOOLEAN)
OWNER TO postgres;

COMMENT ON FUNCTION update_account_with_version(UUID, INTEGER, TEXT, TEXT, BOOLEAN) IS
'Version-safe account update for optimistic concurrency control.
Prevents concurrent modifications from overwriting each other.

Parameters:
- p_account_id: Account to update
- p_expected_version: Version client expects (must match current version)
- p_name: New name (optional, NULL preserves existing)
- p_color: New color (optional, NULL preserves existing)
- p_is_visible: New visibility (optional, NULL preserves existing)

Returns JSONB:
- success: true/false
- error: "version_conflict", "not_found", or "concurrent_modification"
- newVersion: Incremented version (success case only)';

-- ============================================================================
-- 2. VERSION-CHECKED SOFT DELETE (Tombstone Pattern)
-- ============================================================================
CREATE OR REPLACE FUNCTION delete_account_with_version(
  p_account_id UUID,
  p_expected_version INTEGER
) RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_current_version INTEGER;
  v_user_id UUID;
  v_rows_updated INTEGER;
  v_account_data JSONB;
BEGIN
  -- 1. Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- 2. Check current version and capture account data
  SELECT version, jsonb_build_object(
    'name', name,
    'currencyCode', currency_code,
    'type', type,
    'color', color
  )
  INTO v_current_version, v_account_data
  FROM bank_accounts
  WHERE id = p_account_id
    AND user_id = v_user_id
    AND deleted_at IS NULL; -- Can only delete active accounts

  -- Account not found or already deleted
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'not_found'
    );
  END IF;

  -- 3. Version conflict check
  IF v_current_version != p_expected_version THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'version_conflict',
      'expectedVersion', p_expected_version,
      'currentVersion', v_current_version,
      'currentData', v_account_data,
      'message', 'This account has been modified since you last viewed it'
    );
  END IF;

  -- 4. Perform SOFT DELETE (Tombstone Pattern)
  -- CTO Mandate: Never hard-delete. Tombstones are required for distributed sync.
  UPDATE bank_accounts
  SET deleted_at = NOW()
  WHERE id = p_account_id
    AND user_id = v_user_id
    AND version = p_expected_version
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  -- 5. Check if soft delete succeeded
  IF v_rows_updated = 0 THEN
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

ALTER FUNCTION delete_account_with_version(UUID, INTEGER)
OWNER TO postgres;

COMMENT ON FUNCTION delete_account_with_version(UUID, INTEGER) IS
'Version-safe account soft-delete (Tombstone Pattern).
Sets deleted_at timestamp instead of hard-deleting.

CTO Mandate: In a distributed system (Web + iOS), if Web hard-deletes an account,
iOS sync will never receive the "delete" command. The account becomes a "ghost"
visible on iOS forever. Soft deletes enable the sync engine to propagate deletions.

Parameters:
- p_account_id: Account to soft-delete
- p_expected_version: Version client expects

Returns JSONB:
- success: true/false
- error: "version_conflict", "not_found", or "concurrent_modification"
- currentData: Current account data (for conflict confirmation UI)';
