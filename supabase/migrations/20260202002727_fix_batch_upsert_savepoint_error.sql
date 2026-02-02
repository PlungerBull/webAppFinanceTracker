-- ============================================================================
-- MIGRATION: Fix PushEngine RPC Error 0A000
-- Purpose: Remove dynamic EXECUTE SAVEPOINT commands that fail via PostgREST
-- Date: 2026-02-02
--
-- ROOT CAUSE:
-- PostgreSQL via PostgREST does not support EXECUTE of transaction commands.
-- The previous implementation used:
--   EXECUTE format('SAVEPOINT %I', v_savepoint_name);
--   EXECUTE format('ROLLBACK TO SAVEPOINT %I', v_savepoint_name);
--   EXECUTE format('RELEASE SAVEPOINT %I', v_savepoint_name);
--
-- FIX:
-- Remove all dynamic SAVEPOINT commands. The BEGIN...EXCEPTION...END blocks
-- already provide per-item isolation - an exception in one iteration doesn't
-- fail the whole function.
-- ============================================================================

-- =============================================================================
-- 1. batch_upsert_accounts
-- =============================================================================
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
BEGIN
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
      SELECT version INTO v_current_version
      FROM bank_accounts
      WHERE id = v_id AND user_id = p_user_id;

      IF FOUND THEN
        IF v_current_version != v_expected_version THEN
          v_conflict_ids := array_append(v_conflict_ids, v_id);
          CONTINUE;
        END IF;

        v_new_version := nextval('global_transaction_version');

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

      v_synced_ids := array_append(v_synced_ids, v_id);

    EXCEPTION
      WHEN unique_violation THEN
        v_conflict_ids := array_append(v_conflict_ids, v_id);
      WHEN OTHERS THEN
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

-- =============================================================================
-- 2. batch_upsert_categories
-- =============================================================================
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
      SELECT version INTO v_current_version
      FROM categories
      WHERE id = v_id AND (user_id = p_user_id OR user_id IS NULL);

      IF FOUND THEN
        IF v_current_version != v_expected_version THEN
          v_conflict_ids := array_append(v_conflict_ids, v_id);
          CONTINUE;
        END IF;

        v_new_version := nextval('global_transaction_version');

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

      v_synced_ids := array_append(v_synced_ids, v_id);

    EXCEPTION
      WHEN unique_violation THEN
        v_conflict_ids := array_append(v_conflict_ids, v_id);
      WHEN OTHERS THEN
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

-- =============================================================================
-- 3. batch_upsert_transactions
-- =============================================================================
CREATE OR REPLACE FUNCTION batch_upsert_transactions(
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
      SELECT version INTO v_current_version
      FROM transactions
      WHERE id = v_id AND user_id = p_user_id;

      IF FOUND THEN
        IF v_current_version != v_expected_version THEN
          v_conflict_ids := array_append(v_conflict_ids, v_id);
          CONTINUE;
        END IF;

        v_new_version := nextval('global_transaction_version');

        UPDATE transactions SET
          account_id = COALESCE((v_record->>'account_id')::UUID, account_id),
          category_id = (v_record->>'category_id')::UUID,
          amount_cents = COALESCE((v_record->>'amount_cents')::BIGINT, amount_cents),
          amount_home_cents = COALESCE((v_record->>'amount_home_cents')::BIGINT, amount_home_cents),
          exchange_rate = COALESCE((v_record->>'exchange_rate')::NUMERIC, exchange_rate),
          date = COALESCE((v_record->>'date')::TIMESTAMPTZ, date),
          description = v_record->>'description',
          notes = v_record->>'notes',
          source_text = v_record->>'source_text',
          transfer_id = (v_record->>'transfer_id')::UUID,
          inbox_id = (v_record->>'inbox_id')::UUID,
          cleared = COALESCE((v_record->>'cleared')::BOOLEAN, cleared),
          reconciliation_id = (v_record->>'reconciliation_id')::UUID,
          version = v_new_version,
          deleted_at = v_deleted_at,
          updated_at = NOW()
        WHERE id = v_id AND user_id = p_user_id;
      ELSE
        v_new_version := nextval('global_transaction_version');

        INSERT INTO transactions (
          id, user_id, account_id, category_id,
          amount_cents, amount_home_cents, exchange_rate,
          date, description, notes, source_text,
          transfer_id, inbox_id, cleared, reconciliation_id,
          version, deleted_at, created_at, updated_at
        ) VALUES (
          v_id,
          p_user_id,
          (v_record->>'account_id')::UUID,
          (v_record->>'category_id')::UUID,
          COALESCE((v_record->>'amount_cents')::BIGINT, 0),
          COALESCE((v_record->>'amount_home_cents')::BIGINT, 0),
          COALESCE((v_record->>'exchange_rate')::NUMERIC, 1),
          COALESCE((v_record->>'date')::TIMESTAMPTZ, NOW()),
          v_record->>'description',
          v_record->>'notes',
          v_record->>'source_text',
          (v_record->>'transfer_id')::UUID,
          (v_record->>'inbox_id')::UUID,
          COALESCE((v_record->>'cleared')::BOOLEAN, FALSE),
          (v_record->>'reconciliation_id')::UUID,
          v_new_version,
          v_deleted_at,
          COALESCE((v_record->>'created_at')::TIMESTAMPTZ, NOW()),
          NOW()
        );
      END IF;

      v_synced_ids := array_append(v_synced_ids, v_id);

    EXCEPTION
      WHEN unique_violation THEN
        v_conflict_ids := array_append(v_conflict_ids, v_id);
      WHEN OTHERS THEN
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

-- =============================================================================
-- 4. batch_upsert_inbox
-- =============================================================================
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
BEGIN
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
      SELECT version INTO v_current_version
      FROM transaction_inbox
      WHERE id = v_id AND user_id = p_user_id;

      IF FOUND THEN
        IF v_current_version != v_expected_version THEN
          v_conflict_ids := array_append(v_conflict_ids, v_id);
          CONTINUE;
        END IF;

        v_new_version := nextval('global_transaction_version');

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

      v_synced_ids := array_append(v_synced_ids, v_id);

    EXCEPTION
      WHEN unique_violation THEN
        v_conflict_ids := array_append(v_conflict_ids, v_id);
      WHEN OTHERS THEN
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
