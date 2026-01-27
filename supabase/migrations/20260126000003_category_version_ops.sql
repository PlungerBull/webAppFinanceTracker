-- ============================================================================
-- MIGRATION: Version-Checked Category Operations
-- Purpose: Atomic update and soft-delete with optimistic concurrency control
-- Date: 2026-01-26
-- Architecture: CTO Mandate - Tombstone pattern for distributed sync
-- ============================================================================

-- ============================================================================
-- 1. VERSION-CHECKED UPDATE
-- ============================================================================
CREATE OR REPLACE FUNCTION update_category_with_version(
  p_category_id UUID,
  p_expected_version INTEGER,
  p_name TEXT DEFAULT NULL,
  p_color TEXT DEFAULT NULL,
  p_parent_id UUID DEFAULT NULL,
  p_type TEXT DEFAULT NULL
) RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_current_version INTEGER;
  v_user_id UUID;
  v_rows_updated INTEGER;
  v_is_grouping BOOLEAN;
BEGIN
  -- 1. Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- 2. Check current version and whether this is a grouping
  SELECT version, (parent_id IS NULL) INTO v_current_version, v_is_grouping
  FROM categories
  WHERE id = p_category_id
    AND user_id = v_user_id
    AND deleted_at IS NULL; -- Don't update tombstoned categories

  -- Category not found or access denied
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
      'message', 'Category has been modified by another device'
    );
  END IF;

  -- 4. Perform update (version auto-increments via trigger)
  -- Only update fields that are provided (not NULL)
  -- Note: parentId requires special handling as NULL is a valid value (makes it a grouping)
  UPDATE categories
  SET
    name = COALESCE(p_name, name),
    color = COALESCE(p_color, color),
    -- Only update type if provided (groupings only)
    type = CASE
      WHEN p_type IS NOT NULL AND v_is_grouping THEN p_type::transaction_type
      ELSE type
    END
    -- Note: parent_id changes are handled separately to avoid accidental conversion
  WHERE id = p_category_id
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

ALTER FUNCTION update_category_with_version(UUID, INTEGER, TEXT, TEXT, UUID, TEXT)
OWNER TO postgres;

COMMENT ON FUNCTION update_category_with_version(UUID, INTEGER, TEXT, TEXT, UUID, TEXT) IS
'Version-safe category update for optimistic concurrency control.
Prevents concurrent modifications from overwriting each other.

Parameters:
- p_category_id: Category to update
- p_expected_version: Version client expects (must match current version)
- p_name: New name (optional, NULL preserves existing)
- p_color: New color (optional, NULL preserves existing)
- p_parent_id: Reserved for future use (parent reassignment)
- p_type: New type for groupings only (optional, NULL preserves existing)

Returns JSONB:
- success: true/false
- error: "version_conflict", "not_found", or "concurrent_modification"
- newVersion: Incremented version (success case only)';

-- ============================================================================
-- 2. VERSION-CHECKED SOFT DELETE (Tombstone Pattern)
-- ============================================================================
CREATE OR REPLACE FUNCTION delete_category_with_version(
  p_category_id UUID,
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
  v_category_data JSONB;
  v_has_children BOOLEAN;
  v_has_transactions BOOLEAN;
BEGIN
  -- 1. Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- 2. Check current version and capture category data
  SELECT
    c.version,
    jsonb_build_object(
      'name', c.name,
      'color', c.color,
      'type', c.type,
      'parentId', c.parent_id
    ),
    EXISTS(SELECT 1 FROM categories child WHERE child.parent_id = c.id AND child.deleted_at IS NULL),
    EXISTS(SELECT 1 FROM transactions t WHERE t.category_id = c.id AND t.deleted_at IS NULL)
  INTO v_current_version, v_category_data, v_has_children, v_has_transactions
  FROM categories c
  WHERE c.id = p_category_id
    AND c.user_id = v_user_id
    AND c.deleted_at IS NULL; -- Can only delete active categories

  -- Category not found or already deleted
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'not_found'
    );
  END IF;

  -- 3. Validation: Cannot delete grouping with active children
  IF v_has_children THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'has_children',
      'message', 'Cannot delete a grouping that has subcategories. Delete or move the subcategories first.'
    );
  END IF;

  -- 4. Validation: Cannot delete category with active transactions
  IF v_has_transactions THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'has_transactions',
      'message', 'Cannot delete a category that has transactions. Reassign transactions first.'
    );
  END IF;

  -- 5. Version conflict check
  IF v_current_version != p_expected_version THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'version_conflict',
      'expectedVersion', p_expected_version,
      'currentVersion', v_current_version,
      'currentData', v_category_data,
      'message', 'This category has been modified since you last viewed it'
    );
  END IF;

  -- 6. Perform SOFT DELETE (Tombstone Pattern)
  UPDATE categories
  SET deleted_at = NOW()
  WHERE id = p_category_id
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

ALTER FUNCTION delete_category_with_version(UUID, INTEGER)
OWNER TO postgres;

COMMENT ON FUNCTION delete_category_with_version(UUID, INTEGER) IS
'Version-safe category soft-delete (Tombstone Pattern).
Sets deleted_at timestamp instead of hard-deleting.

Business Rules:
- Cannot delete groupings with active subcategories
- Cannot delete categories with active transactions

CTO Mandate: In a distributed system (Web + iOS), if Web hard-deletes a category,
iOS sync will never receive the "delete" command. Soft deletes enable sync propagation.

Parameters:
- p_category_id: Category to soft-delete
- p_expected_version: Version client expects

Returns JSONB:
- success: true/false
- error: "version_conflict", "not_found", "has_children", "has_transactions", or "concurrent_modification"
- currentData: Current category data (for conflict confirmation UI)';
