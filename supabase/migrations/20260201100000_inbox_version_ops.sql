-- ============================================================================
-- MIGRATION: Version-Checked Inbox Operations
-- Purpose: Atomic update and soft-delete with optimistic concurrency control
-- Date: 2026-02-01
-- Architecture: CTO Mandate - Tombstone pattern for distributed sync
-- SYNC-01: Hardening the Sync Schema
-- ============================================================================

-- ============================================================================
-- 1. VERSION-CHECKED UPDATE
-- ============================================================================
CREATE OR REPLACE FUNCTION update_inbox_with_version(
  p_inbox_id UUID,
  p_expected_version INTEGER,
  p_updates JSONB
) RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_current_version INTEGER;
  v_user_id UUID;
  v_rows_updated INTEGER;
  v_new_version INTEGER;
BEGIN
  -- 1. Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- 2. Check current version
  SELECT version INTO v_current_version
  FROM transaction_inbox
  WHERE id = p_inbox_id
    AND user_id = v_user_id
    AND deleted_at IS NULL; -- Don't update tombstoned items

  -- Item not found or access denied
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
      'message', 'Inbox item has been modified by another device'
    );
  END IF;

  -- 4. Perform update (version auto-increments via trigger)
  -- Only update fields that are provided in JSONB (not NULL keys)
  UPDATE transaction_inbox
  SET
    amount_cents = COALESCE((p_updates->>'amount_cents')::BIGINT, amount_cents),
    description = COALESCE(p_updates->>'description', description),
    date = COALESCE(p_updates->>'date', date),
    account_id = COALESCE((p_updates->>'account_id')::UUID, account_id),
    category_id = COALESCE((p_updates->>'category_id')::UUID, category_id),
    exchange_rate = COALESCE((p_updates->>'exchange_rate')::NUMERIC, exchange_rate),
    notes = COALESCE(p_updates->>'notes', notes)
  WHERE id = p_inbox_id
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

  -- 6. Get new version
  SELECT version INTO v_new_version
  FROM transaction_inbox
  WHERE id = p_inbox_id;

  -- 7. Success
  RETURN jsonb_build_object(
    'success', true,
    'newVersion', v_new_version
  );
END;
$$;

ALTER FUNCTION update_inbox_with_version(UUID, INTEGER, JSONB)
OWNER TO postgres;

COMMENT ON FUNCTION update_inbox_with_version(UUID, INTEGER, JSONB) IS
'Version-safe inbox item update for optimistic concurrency control.
Prevents concurrent modifications from overwriting each other.

Parameters:
- p_inbox_id: Inbox item to update
- p_expected_version: Version client expects (must match current version)
- p_updates: JSONB object with fields to update:
  - amount_cents: BIGINT (optional)
  - description: TEXT (optional)
  - date: TEXT (optional)
  - account_id: UUID (optional)
  - category_id: UUID (optional)
  - exchange_rate: NUMERIC (optional)
  - notes: TEXT (optional)

Returns JSONB:
- success: true/false
- error: "version_conflict", "not_found", or "concurrent_modification"
- newVersion: Incremented version (success case only)';

-- ============================================================================
-- 2. VERSION-CHECKED DISMISS (Soft Delete / Tombstone Pattern)
-- ============================================================================
CREATE OR REPLACE FUNCTION dismiss_inbox_with_version(
  p_inbox_id UUID,
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
  v_item_data JSONB;
BEGIN
  -- 1. Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- 2. Check current version and capture item data for conflict UI
  SELECT version, jsonb_build_object(
    'description', description,
    'amountCents', amount_cents,
    'date', date
  )
  INTO v_current_version, v_item_data
  FROM transaction_inbox
  WHERE id = p_inbox_id
    AND user_id = v_user_id
    AND deleted_at IS NULL; -- Can only dismiss active items

  -- Item not found or already deleted
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
      'currentData', v_item_data,
      'message', 'This inbox item has been modified since you last viewed it'
    );
  END IF;

  -- 4. Perform SOFT DELETE (Tombstone Pattern)
  -- CTO Mandate: Never hard-delete. Tombstones are required for distributed sync.
  UPDATE transaction_inbox
  SET
    status = 'ignored',
    deleted_at = NOW()
  WHERE id = p_inbox_id
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

ALTER FUNCTION dismiss_inbox_with_version(UUID, INTEGER)
OWNER TO postgres;

COMMENT ON FUNCTION dismiss_inbox_with_version(UUID, INTEGER) IS
'Version-safe inbox item dismiss (Tombstone Pattern).
Sets deleted_at timestamp and status to "ignored" instead of hard-deleting.

CTO Mandate: In a distributed system (Web + iOS), if Web hard-deletes an item,
iOS sync will never receive the "delete" command. The item becomes a "ghost"
visible on iOS forever. Soft deletes enable the sync engine to propagate deletions.

Parameters:
- p_inbox_id: Inbox item to dismiss
- p_expected_version: Version client expects

Returns JSONB:
- success: true/false
- error: "version_conflict", "not_found", or "concurrent_modification"
- currentData: Current item data (for conflict confirmation UI)';
