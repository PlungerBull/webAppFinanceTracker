-- ============================================================================
-- MIGRATION: Total Ledger Hardening for BIGINT
-- Purpose: Standardize core RPCs to use BIGINT amount_cents and metadata JSONB
-- Date: 2026-01-19
-- Architecture: Eliminates Logic Leaks between Tables and Functions
-- ============================================================================
--
-- CTO AUDIT FINDINGS:
-- The schema migration (20260119000000) successfully changed tables to BIGINT,
-- but three critical RPC functions still referenced the old NUMERIC columns.
-- This migration atomically hardens ALL ledger RPCs to prevent runtime failures.
--
-- FUNCTIONS HARDENED:
-- 1. update_transaction_with_version - UI transaction edits
-- 2. promote_inbox_item - Bank import promotion flow
-- 3. create_transfer - Internal transfer creation
--
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. HARDEN: update_transaction_with_version
-- ============================================================================
-- FIXED: amount_original -> amount_cents, numeric -> BIGINT
-- FIXED: JSONB key 'amountOriginal' -> 'amountCents'
-- CRITICAL: This function is called on EVERY transaction edit from the UI

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
BEGIN
  -- Authenticate user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Get current version with RLS check
  SELECT version INTO v_current_version
  FROM transactions
  WHERE id = p_transaction_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  -- Version conflict check (optimistic locking)
  IF v_current_version != p_expected_version THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'version_conflict',
      'currentVersion', v_current_version
    );
  END IF;

  -- Atomic update with version bump
  UPDATE transactions
  SET
    description = COALESCE(p_updates->>'description', description),
    amount_cents = COALESCE((p_updates->>'amountCents')::BIGINT, amount_cents), -- FIXED: BIGINT Cast
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
    version = version + 1,  -- Increment version for offline sync
    updated_at = NOW()
  WHERE id = p_transaction_id
    AND user_id = v_user_id
    AND version = p_expected_version;

  RETURN jsonb_build_object('success', true, 'newVersion', p_expected_version + 1);
END;
$$;

COMMENT ON FUNCTION update_transaction_with_version(UUID, INTEGER, JSONB) IS
  'Version-checked transaction update using BIGINT amount_cents. Used by UI edit flow with optimistic locking.';

-- ============================================================================
-- 2. HARDEN: promote_inbox_item
-- ============================================================================
-- FIXED: p_final_amount numeric -> p_final_amount_cents BIGINT
-- FIXED: INSERT uses amount_cents, amount_home_cents (not amount_original, amount_home)
-- FIXED: Metadata JSONB preservation for audit trail
-- CRITICAL: This function is called on EVERY bank import promotion

-- Drop ALL old NUMERIC signature variations (PostgreSQL keeps multiple overloads)
DROP FUNCTION IF EXISTS "public"."promote_inbox_item"("uuid", "uuid", "uuid", "text", timestamp with time zone, numeric);
DROP FUNCTION IF EXISTS "public"."promote_inbox_item"("uuid", "uuid", "uuid", "text", timestamp with time zone, numeric, numeric);

-- Create new BIGINT signature
CREATE OR REPLACE FUNCTION "public"."promote_inbox_item"(
    "p_inbox_id" "uuid",
    "p_account_id" "uuid",
    "p_category_id" "uuid",
    "p_final_description" "text" DEFAULT NULL,
    "p_final_date" timestamp with time zone DEFAULT NULL,
    "p_final_amount_cents" BIGINT DEFAULT NULL, -- FIXED: BIGINT Parameter
    "p_exchange_rate" numeric DEFAULT NULL
) RETURNS json
    LANGUAGE "plpgsql"
    SECURITY DEFINER
    SET "search_path" TO 'public'
AS $$
DECLARE
    v_inbox_record record;
    v_new_transaction_id uuid;
    v_amount_cents_to_use BIGINT;
    v_desc_to_use text;
    v_date_to_use timestamptz;
BEGIN
    -- ========================================================================
    -- Double-Click Protection: Row-level lock + status check
    -- ========================================================================
    SELECT * INTO v_inbox_record
    FROM transaction_inbox
    WHERE id = p_inbox_id
      AND status = 'pending'  -- Only promote pending items
    FOR UPDATE;  -- Lock row to prevent concurrent promotion

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Inbox item not found or already promoted';
    END IF;

    -- ========================================================================
    -- Hard-Gate Validations
    -- ========================================================================
    IF p_account_id IS NULL THEN
      RAISE EXCEPTION 'Account ID is required for promotion';
    END IF;

    IF p_category_id IS NULL THEN
      RAISE EXCEPTION 'Category ID is required for promotion';
    END IF;

    -- ========================================================================
    -- Determine Final Values (COALESCE pattern)
    -- ========================================================================
    v_amount_cents_to_use := COALESCE(p_final_amount_cents, v_inbox_record.amount_cents);
    v_desc_to_use := COALESCE(p_final_description, v_inbox_record.description);
    v_date_to_use := COALESCE(p_final_date, v_inbox_record.date);

    -- Validate required fields
    IF v_amount_cents_to_use IS NULL THEN
      RAISE EXCEPTION 'Amount is required for promotion';
    END IF;

    IF v_desc_to_use IS NULL OR trim(v_desc_to_use) = '' THEN
      RAISE EXCEPTION 'Description is required for promotion';
    END IF;

    IF v_date_to_use IS NULL THEN
      RAISE EXCEPTION 'Date is required for promotion';
    END IF;

    -- ========================================================================
    -- Atomic Insert with Metadata Traceability
    -- ========================================================================
    INSERT INTO transactions (
        user_id,
        account_id,
        category_id,
        date,
        description,
        amount_cents,        -- FIXED: BIGINT (not amount_original)
        amount_home_cents,   -- FIXED: BIGINT (trigger will recalculate)
        exchange_rate,
        notes,               -- Direct mirror from inbox
        source_text,         -- Raw context preservation
        inbox_id,            -- Birth certificate for audit trail
        metadata             -- FIXED: Traceability JSONB (bank strings preserved)
    ) VALUES (
        v_inbox_record.user_id,
        p_account_id,
        p_category_id,
        v_date_to_use,
        v_desc_to_use,
        v_amount_cents_to_use,                                      -- INTEGER CENTS
        v_amount_cents_to_use,                                      -- Placeholder (trigger recalculates)
        COALESCE(p_exchange_rate, v_inbox_record.exchange_rate, 1.0),
        v_inbox_record.notes,
        v_inbox_record.source_text,
        p_inbox_id,
        COALESCE(v_inbox_record.metadata, '{}'::jsonb)             -- FIXED: Preserve bank metadata
    ) RETURNING id INTO v_new_transaction_id;

    -- ========================================================================
    -- Mark Inbox Item as Promoted (bump version for sync detection)
    -- ========================================================================
    UPDATE transaction_inbox
    SET
        status = 'promoted',
        version = version + 1,
        updated_at = NOW()
    WHERE id = p_inbox_id;

    RETURN json_build_object('success', true, 'transaction_id', v_new_transaction_id);
END;
$$;

COMMENT ON FUNCTION "public"."promote_inbox_item"(
    "uuid", "uuid", "uuid", "text", timestamp with time zone, BIGINT, numeric
) IS 'Atomically promotes inbox item to ledger using BIGINT integer cents. Includes double-click protection (FOR UPDATE + status check), metadata preservation, and version bumping for offline sync.';

-- ============================================================================
-- 3. HARDEN: create_transfer
-- ============================================================================
-- FIXED: p_amount numeric -> p_amount_cents BIGINT
-- FIXED: p_amount_received numeric -> p_amount_received_cents BIGINT
-- FIXED: INSERT uses amount_cents (not amount_original)
-- CRITICAL: This function is called on EVERY internal transfer creation

-- Drop old NUMERIC signatures (multiple variations may exist)

-- Drop 9-parameter version (without currency)
DROP FUNCTION IF EXISTS "public"."create_transfer"("uuid", "uuid", "uuid", numeric, numeric, numeric, timestamp with time zone, "text", "uuid");

-- Drop 11-parameter version (with p_from_currency and p_to_currency from remote schema)
DROP FUNCTION IF EXISTS "public"."create_transfer"("uuid", "uuid", "uuid", numeric, "text", "text", numeric, numeric, timestamp with time zone, "text", "uuid");

-- Create new BIGINT signature
CREATE OR REPLACE FUNCTION "public"."create_transfer"(
  "p_user_id" "uuid",
  "p_from_account_id" "uuid",
  "p_to_account_id" "uuid",
  "p_amount_cents" BIGINT,           -- FIXED: BIGINT (outbound amount)
  "p_amount_received_cents" BIGINT,  -- FIXED: BIGINT (inbound amount)
  "p_exchange_rate" numeric,
  "p_date" timestamp with time zone,
  "p_description" "text",
  "p_category_id" "uuid" DEFAULT NULL  -- CTO Fix: Allow NULL for transfers without category
) RETURNS json
    LANGUAGE "plpgsql"
    SECURITY DEFINER
    SET "search_path" TO 'public'
AS $$
DECLARE
  v_transfer_id uuid := gen_random_uuid();
  v_from_transaction_id uuid;
  v_to_transaction_id uuid;
BEGIN
  -- ========================================================================
  -- Create Outbound Transaction (negative amount)
  -- ========================================================================
  INSERT INTO transactions (
    user_id,
    account_id,
    category_id,
    amount_cents,      -- FIXED: BIGINT (negative for outbound)
    description,
    date,
    transfer_id
  )
  VALUES (
    p_user_id,
    p_from_account_id,
    p_category_id,
    -p_amount_cents,   -- FIXED: BIGINT negated
    p_description,
    p_date,
    v_transfer_id
  )
  RETURNING id INTO v_from_transaction_id;

  -- ========================================================================
  -- Create Inbound Transaction (positive amount)
  -- ========================================================================
  INSERT INTO transactions (
    user_id,
    account_id,
    category_id,
    amount_cents,              -- FIXED: BIGINT (positive for inbound)
    description,
    date,
    transfer_id,
    exchange_rate
  )
  VALUES (
    p_user_id,
    p_to_account_id,
    p_category_id,
    p_amount_received_cents,   -- FIXED: BIGINT
    p_description,
    p_date,
    v_transfer_id,
    p_exchange_rate
  )
  RETURNING id INTO v_to_transaction_id;

  RETURN json_build_object(
    'success', true,
    'transfer_id', v_transfer_id,
    'from_transaction_id', v_from_transaction_id,
    'to_transaction_id', v_to_transaction_id
  );
END;
$$;

COMMENT ON FUNCTION "public"."create_transfer"(
  "uuid", "uuid", "uuid", BIGINT, BIGINT, numeric, timestamp with time zone, "text", "uuid"
) IS 'Creates atomic transfer with two BIGINT amount_cents transactions. Handles cross-currency transfers via exchange_rate parameter.';

-- ============================================================================
-- Audit Trail: Document the hardening
-- ============================================================================
COMMENT ON FUNCTION update_transaction_with_version(UUID, INTEGER, JSONB) IS
  '[HARDENED 2026-01-19] Version-checked update using BIGINT amount_cents - eliminates NUMERIC logic leak';

COMMENT ON FUNCTION "public"."promote_inbox_item"(
  "uuid", "uuid", "uuid", "text", timestamp with time zone, BIGINT, numeric
) IS
  '[HARDENED 2026-01-19] Atomic promotion with BIGINT amount_cents and metadata preservation';

COMMENT ON FUNCTION "public"."create_transfer"(
  "uuid", "uuid", "uuid", BIGINT, BIGINT, numeric, timestamp with time zone, "text", "uuid"
) IS
  '[HARDENED 2026-01-19] Atomic transfer creation using BIGINT amount_cents for both sides';

COMMIT;
