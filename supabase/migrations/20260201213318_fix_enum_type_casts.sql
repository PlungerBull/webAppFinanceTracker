-- ============================================================================
-- MIGRATION: Fix ENUM type casts in batch_upsert RPCs
-- Purpose: Cast text to ENUM types for accounts.type and categories.type
-- Date: 2026-02-01
--
-- ROOT CAUSE:
-- PostgreSQL JSONB ->> operator returns TEXT, but the columns use ENUM types:
-- - bank_accounts.type uses account_type ENUM
-- - categories.type uses transaction_type ENUM
-- PostgreSQL cannot implicitly cast TEXT to ENUM.
--
-- FIX:
-- Add explicit ::account_type and ::transaction_type casts.
-- Also add NULLIF guards for UUID fields to handle empty strings.
-- ============================================================================

-- =============================================================================
-- 1. batch_upsert_accounts - Fix account_type ENUM cast
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
          group_id = COALESCE(NULLIF(v_record->>'group_id', '')::UUID, group_id),
          name = COALESCE(v_record->>'name', name),
          type = COALESCE((v_record->>'type')::account_type, type),
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
          NULLIF(v_record->>'group_id', '')::UUID,
          COALESCE(v_record->>'name', 'Untitled Account'),
          COALESCE((v_record->>'type')::account_type, 'checking'),
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
-- 2. batch_upsert_categories - Fix transaction_type ENUM cast
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
          type = COALESCE((v_record->>'type')::transaction_type, type),
          color = COALESCE(v_record->>'color', color),
          parent_id = NULLIF(v_record->>'parent_id', '')::UUID,
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
          COALESCE((v_record->>'type')::transaction_type, 'expense'),
          COALESCE(v_record->>'color', '#808080'),
          NULLIF(v_record->>'parent_id', '')::UUID,
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
