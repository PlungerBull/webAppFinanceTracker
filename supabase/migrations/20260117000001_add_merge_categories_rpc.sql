-- Migration: Add merge_categories RPC
-- Purpose: Atomic category merge with version bumping for offline sync
--
-- CTO MANDATE: Merging categories is a Ledger Event.
-- This RPC ensures:
-- 1. All affected transactions have their version bumped (sync detection)
-- 2. The entire operation is atomic (no orphaned transactions)
-- 3. Proper authorization (user owns all categories)
--
-- See: ARCHITECTURE.md Section 8 - Category Merge Protocol

-- =============================================================================
-- MERGE CATEGORIES RPC
-- =============================================================================
-- Merges multiple source categories into a single target category.
-- All transactions from source categories are reassigned to the target.
-- Source categories are then deleted.
--
-- CRITICAL: Bumps version on all affected transactions for offline sync.
--
-- Parameters:
--   p_source_ids: Array of category IDs to merge FROM (will be deleted)
--   p_target_id:  Category ID to merge INTO (will receive all transactions)
--
-- Returns:
--   affected_transaction_count: Number of transactions reassigned
--
-- Errors:
--   P0001 'merge_empty_source': No source categories provided
--   P0001 'merge_target_not_found': Target category doesn't exist
--   P0001 'merge_unauthorized': User doesn't own all categories
--   P0001 'merge_target_in_source': Target category is in source list
-- =============================================================================

CREATE OR REPLACE FUNCTION merge_categories(
    p_source_ids UUID[],
    p_target_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_target_exists BOOLEAN;
    v_unauthorized_count INTEGER;
    v_affected_count INTEGER;
BEGIN
    -- Get current user
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'merge_unauthorized: Not authenticated'
            USING ERRCODE = 'P0001';
    END IF;

    -- Validate: Source array not empty
    IF p_source_ids IS NULL OR array_length(p_source_ids, 1) IS NULL THEN
        RAISE EXCEPTION 'merge_empty_source: No source categories provided'
            USING ERRCODE = 'P0001';
    END IF;

    -- Validate: Target not in source list
    IF p_target_id = ANY(p_source_ids) THEN
        RAISE EXCEPTION 'merge_target_in_source: Target category cannot be in source list'
            USING ERRCODE = 'P0001';
    END IF;

    -- Validate: Target exists and user owns it
    SELECT EXISTS(
        SELECT 1 FROM categories
        WHERE id = p_target_id AND user_id = v_user_id
    ) INTO v_target_exists;

    IF NOT v_target_exists THEN
        RAISE EXCEPTION 'merge_target_not_found: Target category not found or not owned by user'
            USING ERRCODE = 'P0001';
    END IF;

    -- Validate: User owns all source categories
    SELECT COUNT(*) INTO v_unauthorized_count
    FROM unnest(p_source_ids) AS source_id
    WHERE NOT EXISTS (
        SELECT 1 FROM categories
        WHERE id = source_id AND user_id = v_user_id
    );

    IF v_unauthorized_count > 0 THEN
        RAISE EXCEPTION 'merge_unauthorized: User does not own all source categories'
            USING ERRCODE = 'P0001';
    END IF;

    -- ==========================================================================
    -- ATOMIC OPERATION: Update transactions + Delete categories
    -- ==========================================================================

    -- Step 1: Reassign transactions and BUMP VERSION
    -- 🚨 CRITICAL: version bump enables offline sync detection
    UPDATE transactions
    SET
        category_id = p_target_id,
        version = version + 1,
        updated_at = NOW()
    WHERE
        category_id = ANY(p_source_ids)
        AND user_id = v_user_id
        AND deleted_at IS NULL;  -- Respect soft deletes

    GET DIAGNOSTICS v_affected_count = ROW_COUNT;

    -- Step 2: Delete source categories (now orphaned)
    -- Note: This will fail if any source category has children (FK constraint)
    DELETE FROM categories
    WHERE
        id = ANY(p_source_ids)
        AND user_id = v_user_id;

    -- Return result
    RETURN json_build_object(
        'success', true,
        'affected_transaction_count', v_affected_count,
        'merged_category_count', array_length(p_source_ids, 1),
        'target_category_id', p_target_id
    );

EXCEPTION
    WHEN foreign_key_violation THEN
        -- Source category has children - can't delete
        RAISE EXCEPTION 'merge_has_children: Cannot merge categories that have subcategories. Reassign or delete subcategories first.'
            USING ERRCODE = 'P0001';
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION merge_categories(UUID[], UUID) TO authenticated;

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON FUNCTION merge_categories IS
'Atomically merges multiple source categories into a target category.
All transactions from source categories are reassigned to target with version bump.
Source categories are then deleted. Ensures offline sync integrity.
See ARCHITECTURE.md Section 8 - Category Merge Protocol.';
