-- ============================================================================
-- MIGRATION: Batch Upsert Inbox for Delta Sync Push Engine
-- Purpose: Push multiple inbox items in a single request with per-item error handling
-- Date: 2026-01-27
--
-- CTO MANDATES:
-- - Push Engine MUST use batching (1 request for N records)
-- - Per-item error granularity (SAVEPOINT per record)
-- - 1 bad record should NOT fail 49 good ones
--
-- Returns: { synced_ids: uuid[], conflict_ids: uuid[], error_map: {id: error} }
-- ============================================================================

CREATE OR REPLACE FUNCTION batch_upsert_inbox(
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
  v_savepoint_name TEXT;
BEGIN
  -- Process each record with individual SAVEPOINT
  FOREACH v_record IN ARRAY p_records
  LOOP
    v_id := (v_record->>'id')::UUID;
    v_expected_version := COALESCE((v_record->>'version')::INTEGER, 1);
    v_deleted_at := CASE
      WHEN v_record->>'deleted_at' IS NOT NULL AND v_record->>'deleted_at' != 'null'
      THEN (v_record->>'deleted_at')::TIMESTAMPTZ
      ELSE NULL
    END;

    -- Create savepoint name (remove dashes for valid identifier)
    v_savepoint_name := 'sp_' || replace(v_id::text, '-', '_');

    BEGIN
      -- SAVEPOINT per record for isolation
      EXECUTE format('SAVEPOINT %I', v_savepoint_name);

      -- Check if record exists and get current version
      SELECT version INTO v_current_version
      FROM transaction_inbox
      WHERE id = v_id AND user_id = p_user_id;

      IF FOUND THEN
        -- Record exists - check version for conflict
        IF v_current_version != v_expected_version THEN
          -- Version conflict
          EXECUTE format('ROLLBACK TO SAVEPOINT %I', v_savepoint_name);
          v_conflict_ids := array_append(v_conflict_ids, v_id);
          CONTINUE;
        END IF;

        -- Get next version from global sequence
        v_new_version := nextval('global_transaction_version');

        -- Update existing record
        UPDATE transaction_inbox SET
          amount_cents = (v_record->>'amount_cents')::BIGINT,
          description = v_record->>'description',
          date = (v_record->>'date')::TIMESTAMPTZ,
          source_text = v_record->>'source_text',
          account_id = (v_record->>'account_id')::UUID,
          category_id = (v_record->>'category_id')::UUID,
          exchange_rate = (v_record->>'exchange_rate')::NUMERIC,
          notes = v_record->>'notes',
          status = COALESCE(v_record->>'status', status),
          version = v_new_version,
          deleted_at = v_deleted_at,
          updated_at = NOW()
        WHERE id = v_id AND user_id = p_user_id;

      ELSE
        -- New record - insert
        v_new_version := nextval('global_transaction_version');

        INSERT INTO transaction_inbox (
          id, user_id, amount_cents, description, date,
          source_text, account_id, category_id, exchange_rate, notes,
          status, version, deleted_at, created_at, updated_at
        ) VALUES (
          v_id,
          p_user_id,
          (v_record->>'amount_cents')::BIGINT,
          v_record->>'description',
          (v_record->>'date')::TIMESTAMPTZ,
          v_record->>'source_text',
          (v_record->>'account_id')::UUID,
          (v_record->>'category_id')::UUID,
          (v_record->>'exchange_rate')::NUMERIC,
          v_record->>'notes',
          COALESCE(v_record->>'status', 'pending'),
          v_new_version,
          v_deleted_at,
          COALESCE((v_record->>'created_at')::TIMESTAMPTZ, NOW()),
          NOW()
        );
      END IF;

      -- Success - release savepoint
      EXECUTE format('RELEASE SAVEPOINT %I', v_savepoint_name);
      v_synced_ids := array_append(v_synced_ids, v_id);

    EXCEPTION
      WHEN unique_violation THEN
        -- Unique constraint conflict
        EXECUTE format('ROLLBACK TO SAVEPOINT %I', v_savepoint_name);
        v_conflict_ids := array_append(v_conflict_ids, v_id);

      WHEN OTHERS THEN
        -- Per-item error
        EXECUTE format('ROLLBACK TO SAVEPOINT %I', v_savepoint_name);
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
GRANT EXECUTE ON FUNCTION batch_upsert_inbox(UUID, JSONB[]) TO authenticated;

COMMENT ON FUNCTION batch_upsert_inbox(UUID, JSONB[]) IS
'Batch upsert for Delta Sync Push Engine.
Processes multiple inbox items in one request with per-item error handling.
Uses SAVEPOINT per record so 1 failure does not fail the entire batch.';
