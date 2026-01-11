-- ============================================================================
-- MIGRATION: Version-Checked Single Transaction Update RPC
-- Purpose: Atomic update with optimistic concurrency control
-- Date: 2026-01-11
-- Architecture: Prevents concurrent update conflicts via version checking
-- ============================================================================

CREATE OR REPLACE FUNCTION update_transaction_with_version(
  p_transaction_id UUID,
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
BEGIN
  -- 1. Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- 2. Check current version
  SELECT version INTO v_current_version
  FROM transactions
  WHERE id = p_transaction_id
    AND user_id = v_user_id; -- RLS check

  -- Transaction not found or access denied
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
      'message', 'Transaction has been modified by another user'
    );
  END IF;

  -- 4. Perform update (version auto-increments via trigger)
  -- Only update fields present in p_updates JSONB
  UPDATE transactions
  SET
    description = COALESCE(p_updates->>'description', description),
    amount_original = COALESCE((p_updates->>'amountOriginal')::numeric, amount_original),
    account_id = COALESCE((p_updates->>'accountId')::uuid, account_id),
    category_id = CASE
      WHEN p_updates ? 'categoryId' THEN (p_updates->>'categoryId')::uuid
      ELSE category_id
    END,
    date = COALESCE((p_updates->>'date')::timestamptz, date),
    notes = CASE
      WHEN p_updates ? 'notes' THEN p_updates->>'notes'
      ELSE notes
    END,
    exchange_rate = COALESCE((p_updates->>'exchangeRate')::numeric, exchange_rate),
    updated_at = NOW()
  WHERE id = p_transaction_id
    AND user_id = v_user_id
    AND version = p_expected_version; -- Double-check version in WHERE clause

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  -- 5. Check if update succeeded
  IF v_rows_updated = 0 THEN
    -- Concurrent modification (version changed between SELECT and UPDATE)
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

ALTER FUNCTION update_transaction_with_version(UUID, INTEGER, JSONB)
OWNER TO postgres;

COMMENT ON FUNCTION update_transaction_with_version(UUID, INTEGER, JSONB) IS
'Version-safe transaction update for optimistic concurrency control.
Prevents User A and User B from overwriting each other''s changes.

Parameters:
- p_transaction_id: Transaction to update
- p_expected_version: Version client expects (must match current version)
- p_updates: JSONB with fields to update (only present fields are updated)

Returns JSONB:
- success: true/false
- error: "version_conflict", "not_found", or "concurrent_modification"
- newVersion: Incremented version (success case only)

Example usage:
SELECT update_transaction_with_version(
  ''txn-id'',
  5,
  ''{"description": "Updated", "amountOriginal": 100.50}''::jsonb
);';
