-- ============================================================================
-- MIGRATION: Batch Upsert Categories for Delta Sync Push Engine
-- Purpose: Push multiple categories in a single request with per-item error handling
-- Date: 2026-01-27
--
-- CTO MANDATES:
-- - Push Engine MUST use batching (1 request for N records)
-- - Per-item error granularity (exception handling per record)
-- - 1 bad record should NOT fail 49 good ones
--
-- FIX: Removed dynamic EXECUTE SAVEPOINT commands that caused PostgreSQL 0A000 error
-- via PostgREST. BEGIN...EXCEPTION...END blocks provide per-item isolation.
--
-- Returns: { synced_ids: uuid[], conflict_ids: uuid[], error_map: {id: error} }
-- ============================================================================

CREATE OR REPLACE FUNCTION batch_upsert_categories(
  p_user_id UUID,
  p_records JSONB[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_synced_ids UUID[] := ARRAY[]::UUID[];
  v_conflict_ids UUID[] := ARRAY[]::UUID[];
  v_error_map JSONB := '{}'::JSONB;
  v_record JSONB;
  v_id UUID;
  v_expected_version INTEGER;
  v_current_version INTEGER;
  v_new_version INTEGER;
  v_deleted_at TIMESTAMPTZ;
BEGIN
  -- Process each record with individual exception handling
  FOREACH v_record IN ARRAY p_records
  LOOP
    v_id := (v_record->>'id')::UUID;
    v_expected_version := COALESCE((v_record->>'version')::INTEGER, 1);
    v_deleted_at := CASE
      WHEN v_record->>'deleted_at' IS NOT NULL AND v_record->>'deleted_at' != 'null'
      THEN (v_record->>'deleted_at')::TIMESTAMPTZ
      ELSE NULL
    END;

    BEGIN
      -- Check if record exists and get current version
      -- Categories can be user-owned or global (user_id IS NULL)
      SELECT version INTO v_current_version
      FROM categories
      WHERE id = v_id AND (user_id = p_user_id OR user_id IS NULL);

      IF FOUND THEN
        -- Record exists - check version for conflict
        IF v_current_version != v_expected_version THEN
          -- Version conflict
          v_conflict_ids := array_append(v_conflict_ids, v_id);
          CONTINUE;
        END IF;

        -- Get next version from global sequence
        v_new_version := nextval('global_transaction_version');

        -- Update existing record
        UPDATE categories SET
          name = COALESCE(v_record->>'name', name),
          type = COALESCE(v_record->>'type', type),
          color = COALESCE(v_record->>'color', color),
          parent_id = (v_record->>'parent_id')::UUID,
          version = v_new_version,
          deleted_at = v_deleted_at,
          updated_at = NOW()
        WHERE id = v_id AND (user_id = p_user_id OR user_id IS NULL);

      ELSE
        -- New record - insert
        v_new_version := nextval('global_transaction_version');

        INSERT INTO categories (
          id, user_id, name, type, color, parent_id,
          version, deleted_at, created_at, updated_at
        ) VALUES (
          v_id,
          p_user_id,
          COALESCE(v_record->>'name', 'Untitled Category'),
          COALESCE(v_record->>'type', 'expense'),
          COALESCE(v_record->>'color', '#808080'),
          (v_record->>'parent_id')::UUID,
          v_new_version,
          v_deleted_at,
          COALESCE((v_record->>'created_at')::TIMESTAMPTZ, NOW()),
          NOW()
        );
      END IF;

      -- Success
      v_synced_ids := array_append(v_synced_ids, v_id);

    EXCEPTION
      WHEN unique_violation THEN
        -- Unique constraint conflict
        v_conflict_ids := array_append(v_conflict_ids, v_id);

      WHEN OTHERS THEN
        -- Per-item error
        v_error_map := v_error_map || jsonb_build_object(v_id::text, SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'synced_ids', to_jsonb(v_synced_ids),
    'conflict_ids', to_jsonb(v_conflict_ids),
    'error_map', v_error_map
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION batch_upsert_categories(UUID, JSONB[]) TO authenticated;

COMMENT ON FUNCTION batch_upsert_categories(UUID, JSONB[]) IS
'Batch upsert for Delta Sync Push Engine.
Processes multiple categories in one request with per-item error handling.
Uses BEGIN...EXCEPTION...END per record so 1 failure does not fail the entire batch.';
