-- ============================================================================
-- MIGRATION: Fix promote_inbox_item BIGINT cents + version overload
-- Purpose: Add missing function overload with p_final_amount_cents AND p_expected_version
-- Date: 2026-02-03
--
-- ROOT CAUSE: Client sends (p_final_amount_cents, p_expected_version) but no
-- matching DB overload exists. Migration 20260119000002 added cents, migration
-- 20260125000001 added version, but they were never combined.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION "public"."promote_inbox_item"(
    "p_inbox_id" "uuid",
    "p_account_id" "uuid",
    "p_category_id" "uuid",
    "p_final_description" "text" DEFAULT NULL,
    "p_final_date" timestamp with time zone DEFAULT NULL,
    "p_final_amount_cents" BIGINT DEFAULT NULL,    -- BIGINT (client sends this)
    "p_exchange_rate" numeric DEFAULT NULL,
    "p_expected_version" integer DEFAULT NULL       -- Version for OCC (client sends this)
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
    v_user_id uuid;
BEGIN
    -- Get authenticated user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- 1. Fetch the inbox item (with user ownership check)
    SELECT * INTO v_inbox_record
    FROM transaction_inbox
    WHERE id = p_inbox_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inbox item not found or access denied';
    END IF;

    -- ========================================================================
    -- OPTIMISTIC CONCURRENCY CONTROL (Version Check)
    -- CRITICAL: This check MUST happen BEFORE any data is moved
    -- ========================================================================
    IF p_expected_version IS NOT NULL AND v_inbox_record.version != p_expected_version THEN
        RAISE EXCEPTION 'Version conflict: Expected version %, but found %. The item has been modified by another device.',
            p_expected_version, v_inbox_record.version
        USING ERRCODE = 'P0001';
    END IF;

    -- HARD-GATE VALIDATION: Ensure account_id is provided
    IF p_account_id IS NULL THEN
        RAISE EXCEPTION 'Account ID is required for promotion';
    END IF;

    -- HARD-GATE VALIDATION: Ensure category_id is provided
    IF p_category_id IS NULL THEN
        RAISE EXCEPTION 'Category ID is required for promotion';
    END IF;

    -- ========================================================================
    -- OWNERSHIP VALIDATION (Defense-in-Depth)
    -- CRITICAL: These checks happen BEFORE INSERT to prevent partial state
    -- ========================================================================
    PERFORM validate_account_ownership(p_account_id, v_user_id);
    PERFORM validate_category_ownership(p_category_id, v_user_id);

    -- 2. Determine final values (Use override if provided, else use inbox value)
    v_amount_cents_to_use := COALESCE(p_final_amount_cents, v_inbox_record.amount_cents);
    v_desc_to_use := COALESCE(p_final_description, v_inbox_record.description);
    v_date_to_use := COALESCE(p_final_date, v_inbox_record.date);

    -- HARD-GATE VALIDATIONS
    IF v_amount_cents_to_use IS NULL THEN
        RAISE EXCEPTION 'Amount is required for promotion';
    END IF;
    IF v_desc_to_use IS NULL OR trim(v_desc_to_use) = '' THEN
        RAISE EXCEPTION 'Description is required for promotion';
    END IF;
    IF v_date_to_use IS NULL THEN
        RAISE EXCEPTION 'Date is required for promotion';
    END IF;

    -- 3. INSERT into the Main Ledger (using BIGINT cents directly)
    INSERT INTO transactions (
        user_id,
        account_id,
        category_id,
        date,
        description,
        amount_cents,           -- BIGINT column
        amount_home_cents,      -- Trigger will calculate from exchange rate
        exchange_rate,
        notes,
        source_text,
        inbox_id
    ) VALUES (
        v_inbox_record.user_id,
        p_account_id,
        p_category_id,
        v_date_to_use,
        v_desc_to_use,
        v_amount_cents_to_use,
        v_amount_cents_to_use,  -- Placeholder, trigger recalculates
        COALESCE(p_exchange_rate, v_inbox_record.exchange_rate, 1.0),
        v_inbox_record.notes,
        v_inbox_record.source_text,
        p_inbox_id
    ) RETURNING id INTO v_new_transaction_id;

    -- 4. TOMBSTONE PATTERN: Soft Delete (AFTER successful insert)
    UPDATE transaction_inbox
    SET status = 'processed',
        deleted_at = NOW(),
        updated_at = NOW()
    WHERE id = p_inbox_id;

    RETURN json_build_object('success', true, 'transaction_id', v_new_transaction_id);
END;
$$;

COMMENT ON FUNCTION "public"."promote_inbox_item"(
    "uuid", "uuid", "uuid", "text", timestamp with time zone, BIGINT, numeric, integer
) IS '[HARDENED 2026-02-03] Promotes inbox item to ledger with BIGINT cents + version check + ownership validation. Fixes signature mismatch where client sends (p_final_amount_cents, p_expected_version) but no overload existed.';

COMMIT;
