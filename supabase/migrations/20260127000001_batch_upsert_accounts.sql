-- ============================================================================
-- MIGRATION: Batch Upsert Accounts for Delta Sync Push Engine
-- Purpose: Push multiple accounts in a single request with per-item error handling
-- Date: 2026-01-27
--
-- CTO MANDATES:
-- - Push Engine MUST use batching (1 request for N records)
-- - Per-item error granularity (SAVEPOINT per record)
-- - 1 bad record should NOT fail 49 good ones
--
-- Returns: { synced_ids: uuid[], conflict_ids: uuid[], error_map: {id: error} }
-- ============================================================================

CREATE OR REPLACE FUNCTION batch_upsert_accounts(
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
      FROM bank_accounts
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
        UPDATE bank_accounts SET
          group_id = COALESCE((v_record->>'group_id')::UUID, group_id),
          name = COALESCE(v_record->>'name', name),
          type = COALESCE(v_record->>'type', type),
          currency_code = COALESCE(v_record->>'currency_code', currency_code),
          color = COALESCE(v_record->>'color', color),
          is_visible = COALESCE((v_record->>'is_visible')::BOOLEAN, is_visible),
          current_balance_cents = COALESCE((v_record->>'current_balance_cents')::BIGINT, current_balance_cents),
          version = v_new_version,
          deleted_at = v_deleted_at,
          updated_at = NOW()
        WHERE id = v_id AND user_id = p_user_id;

      ELSE
        -- New record - insert
        v_new_version := nextval('global_transaction_version');

        INSERT INTO bank_accounts (
          id, user_id, group_id, name, type,
          currency_code, color, is_visible, current_balance_cents,
          version, deleted_at, created_at, updated_at
        ) VALUES (
          v_id,
          p_user_id,
          (v_record->>'group_id')::UUID,
          COALESCE(v_record->>'name', 'Untitled Account'),
          COALESCE(v_record->>'type', 'checking'),
          COALESCE(v_record->>'currency_code', 'USD'),
          COALESCE(v_record->>'color', '#808080'),
          COALESCE((v_record->>'is_visible')::BOOLEAN, TRUE),
          COALESCE((v_record->>'current_balance_cents')::BIGINT, 0),
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
        -- Unique constraint conflict (e.g., duplicate account name)
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
GRANT EXECUTE ON FUNCTION batch_upsert_accounts(UUID, JSONB[]) TO authenticated;

COMMENT ON FUNCTION batch_upsert_accounts(UUID, JSONB[]) IS
'Batch upsert for Delta Sync Push Engine.
Processes multiple accounts in one request with per-item error handling.
Uses SAVEPOINT per record so 1 failure does not fail the entire batch.';
