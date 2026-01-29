-- ============================================================================
-- MIGRATION: Version-Checked Reconciliation Operations
-- Purpose: Atomic soft-delete with optimistic concurrency control
-- Date: 2026-01-29
-- Architecture: CTO Mandate - Tombstone pattern for distributed sync
-- ============================================================================

-- ============================================================================
-- VERSION-CHECKED SOFT DELETE (Tombstone Pattern)
-- ============================================================================
CREATE OR REPLACE FUNCTION delete_reconciliation_with_version(
  p_reconciliation_id UUID,
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
  v_reconciliation_data JSONB;
  v_status reconciliation_status;
  v_has_linked_transactions BOOLEAN;
BEGIN
  -- 1. Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- 2. Check current version and capture reconciliation data
  SELECT
    r.version,
    r.status,
    jsonb_build_object(
      'name', r.name,
      'accountId', r.account_id,
      'status', r.status,
      'beginningBalance', r.beginning_balance,
      'endingBalance', r.ending_balance
    ),
    EXISTS(SELECT 1 FROM transactions t WHERE t.reconciliation_id = r.id AND t.deleted_at IS NULL)
  INTO v_current_version, v_status, v_reconciliation_data, v_has_linked_transactions
  FROM reconciliations r
  WHERE r.id = p_reconciliation_id
    AND r.user_id = v_user_id
    AND r.deleted_at IS NULL; -- Can only delete active reconciliations

  -- Reconciliation not found or already deleted
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'not_found'
    );
  END IF;

  -- 3. Validation: Cannot delete completed reconciliation
  -- Business rule: Completed reconciliations are immutable contracts of truth
  IF v_status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'reconciliation_completed',
      'message', 'Cannot delete a completed reconciliation. Change status to draft first.'
    );
  END IF;

  -- 4. Version conflict check
  IF v_current_version != p_expected_version THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'version_conflict',
      'expectedVersion', p_expected_version,
      'currentVersion', v_current_version,
      'currentData', v_reconciliation_data,
      'message', 'This reconciliation has been modified since you last viewed it'
    );
  END IF;

  -- 5. Unlink all transactions before soft delete (set reconciliation_id to NULL)
  -- This is safe because we already checked status is 'draft'
  -- The cleared flag is automatically managed by the auto-clearing trigger
  IF v_has_linked_transactions THEN
    UPDATE transactions
    SET reconciliation_id = NULL
    WHERE reconciliation_id = p_reconciliation_id
      AND deleted_at IS NULL;
  END IF;

  -- 6. Perform SOFT DELETE (Tombstone Pattern)
  -- CTO Mandate: Never hard-delete. Tombstones are required for distributed sync.
  UPDATE reconciliations
  SET deleted_at = NOW()
  WHERE id = p_reconciliation_id
    AND user_id = v_user_id
    AND version = p_expected_version
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  -- 7. Check if soft delete succeeded
  IF v_rows_updated = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'concurrent_modification'
    );
  END IF;

  -- 8. Success
  RETURN jsonb_build_object(
    'success', true
  );
END;
$$;

ALTER FUNCTION delete_reconciliation_with_version(UUID, INTEGER)
OWNER TO postgres;

COMMENT ON FUNCTION delete_reconciliation_with_version(UUID, INTEGER) IS
'Version-safe reconciliation soft-delete (Tombstone Pattern).
Sets deleted_at timestamp instead of hard-deleting.
Automatically unlinks all transactions (sets reconciliation_id to NULL).

Business Rules:
- Cannot delete completed reconciliations (must change to draft first)
- Linked transactions are automatically unlinked (via FK SET NULL behavior)
- The cleared flag on transactions is auto-managed by its trigger

CTO Mandate: In a distributed system (Web + iOS), if Web hard-deletes a reconciliation,
iOS sync will never receive the "delete" command. Soft deletes enable sync propagation.

Parameters:
- p_reconciliation_id: Reconciliation to soft-delete
- p_expected_version: Version client expects

Returns JSONB:
- success: true/false
- error: "version_conflict", "not_found", "reconciliation_completed", or "concurrent_modification"
- currentData: Current reconciliation data (for conflict confirmation UI)';
