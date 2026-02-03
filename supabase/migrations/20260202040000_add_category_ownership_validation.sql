-- ============================================================================
-- MIGRATION: Add Category Ownership Validation to All Write RPCs
-- Purpose: Multi-layer defense - verify category belongs to authenticated user
-- Date: 2026-02-02
-- Ticket: SYNC-04 Category FK Audit
--
-- CTO MANDATE: Defense in Depth
-- Even though RLS policies enforce user isolation at the table level,
-- SECURITY DEFINER functions bypass RLS. We must explicitly verify ownership
-- of referenced entities (accounts, categories) before any write operation.
--
-- Gap Analysis:
-- - bulk_update_transactions: Already has category ownership check ✓
-- - promote_inbox_item: MISSING - needs ownership verification
-- - create_transfer: MISSING - needs ownership verification (when not NULL)
-- - update_transaction_with_version: MISSING - needs ownership verification
-- - update_inbox_with_version: MISSING - needs ownership verification
--
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. HELPER FUNCTION: validate_category_ownership
-- ============================================================================
-- Reusable validation function to check category exists and belongs to user.
-- Raises exception if invalid, allowing atomic failure with clear error message.
--
-- Design Decisions:
-- - NULL category_id returns TRUE (allowed in some contexts like transfers)
-- - Respects tombstones (deleted_at IS NULL check)
-- - Uses ERRCODE P0001 for consistent error handling
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_category_ownership(
    p_category_id UUID,
    p_user_id UUID
) RETURNS BOOLEAN
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
AS $$
BEGIN
    -- Category NULL is allowed in some contexts (e.g., transfers, uncategorized inbox)
    -- Caller decides whether to invoke this function for required vs optional category
    IF p_category_id IS NULL THEN
        RETURN TRUE;
    END IF;

    -- Verify category exists AND belongs to the authenticated user
    -- AND is not soft-deleted (tombstone pattern)
    IF NOT EXISTS (
        SELECT 1 FROM categories
        WHERE id = p_category_id
          AND user_id = p_user_id
          AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Category does not exist or does not belong to user'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN TRUE;
END;
$$;

ALTER FUNCTION validate_category_ownership(UUID, UUID) OWNER TO postgres;

COMMENT ON FUNCTION validate_category_ownership(UUID, UUID) IS
'Multi-layer defense: Validates that a category_id belongs to the specified user.
Raises P0001 exception if category is not found, not owned by user, or soft-deleted.
Returns TRUE if validation passes. NULL category_id returns TRUE (allowed in some contexts).
Part of the Defense-in-Depth mandate for SECURITY DEFINER functions.';


-- ============================================================================
-- 2. HELPER FUNCTION: validate_account_ownership
-- ============================================================================
-- Matching helper for account_id validation (DRY principle).
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_account_ownership(
    p_account_id UUID,
    p_user_id UUID
) RETURNS BOOLEAN
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
AS $$
BEGIN
    IF p_account_id IS NULL THEN
        RETURN TRUE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM bank_accounts
        WHERE id = p_account_id
          AND user_id = p_user_id
          AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Account does not exist or does not belong to user'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN TRUE;
END;
$$;

ALTER FUNCTION validate_account_ownership(UUID, UUID) OWNER TO postgres;

COMMENT ON FUNCTION validate_account_ownership(UUID, UUID) IS
'Multi-layer defense: Validates that an account_id belongs to the specified user.
Raises P0001 exception if account is not found, not owned by user, or soft-deleted.
Returns TRUE if validation passes. NULL account_id returns TRUE.
Part of the Defense-in-Depth mandate for SECURITY DEFINER functions.';


-- ============================================================================
-- 3. HARDEN: promote_inbox_item (6-parameter overload)
-- ============================================================================
-- Add ownership verification for both p_account_id and p_category_id
-- CRITICAL: Validation happens BEFORE INSERT to prevent data loss on failure
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."promote_inbox_item"(
    "p_inbox_id" "uuid",
    "p_account_id" "uuid",
    "p_category_id" "uuid",
    "p_final_description" "text" DEFAULT NULL::"text",
    "p_final_date" timestamp with time zone DEFAULT NULL::timestamp with time zone,
    "p_final_amount" numeric DEFAULT NULL::numeric
) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
AS $$
DECLARE
    v_inbox_record record;
    v_new_transaction_id uuid;
    v_amount_to_use numeric;
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
    v_amount_to_use := COALESCE(p_final_amount, v_inbox_record.amount_original);
    v_desc_to_use := COALESCE(p_final_description, v_inbox_record.description);
    v_date_to_use := COALESCE(p_final_date, v_inbox_record.date);

    -- HARD-GATE VALIDATION: Ensure amount is present
    IF v_amount_to_use IS NULL THEN
        RAISE EXCEPTION 'Amount is required for promotion';
    END IF;

    -- HARD-GATE VALIDATION: Ensure description is present
    IF v_desc_to_use IS NULL OR trim(v_desc_to_use) = '' THEN
        RAISE EXCEPTION 'Description is required for promotion';
    END IF;

    -- HARD-GATE VALIDATION: Ensure date is present
    IF v_date_to_use IS NULL THEN
        RAISE EXCEPTION 'Date is required for promotion';
    END IF;

    -- 3. INSERT into the Main Ledger
    INSERT INTO transactions (
        user_id,
        account_id,
        category_id,
        date,
        description,
        amount_original,
        amount_home,
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
        v_amount_to_use,
        v_amount_to_use,
        COALESCE(v_inbox_record.exchange_rate, 1.0),
        v_inbox_record.notes,
        v_inbox_record.source_text,
        p_inbox_id
    ) RETURNING id INTO v_new_transaction_id;

    -- 4. Mark inbox item as processed (AFTER successful insert)
    UPDATE transaction_inbox
    SET status = 'processed', updated_at = NOW()
    WHERE id = p_inbox_id;

    RETURN json_build_object('success', true, 'transaction_id', v_new_transaction_id);
END;
$$;

COMMENT ON FUNCTION "public"."promote_inbox_item"(
    "uuid", "uuid", "uuid", "text", timestamp with time zone, numeric
) IS '[HARDENED 2026-02-02] Promotes inbox item to ledger with ownership validation for account_id and category_id. Defense-in-depth for SECURITY DEFINER bypass.';


-- ============================================================================
-- 4. HARDEN: promote_inbox_item (7-parameter overload with exchange_rate)
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."promote_inbox_item"(
    "p_inbox_id" "uuid",
    "p_account_id" "uuid",
    "p_category_id" "uuid",
    "p_final_description" "text" DEFAULT NULL::"text",
    "p_final_date" timestamp with time zone DEFAULT NULL::timestamp with time zone,
    "p_final_amount" numeric DEFAULT NULL::numeric,
    "p_exchange_rate" numeric DEFAULT NULL::numeric
) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
AS $$
DECLARE
    v_inbox_record record;
    v_new_transaction_id uuid;
    v_amount_to_use numeric;
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
    v_amount_to_use := COALESCE(p_final_amount, v_inbox_record.amount_original);
    v_desc_to_use := COALESCE(p_final_description, v_inbox_record.description);
    v_date_to_use := COALESCE(p_final_date, v_inbox_record.date);

    -- HARD-GATE VALIDATION: Ensure amount is present
    IF v_amount_to_use IS NULL THEN
        RAISE EXCEPTION 'Amount is required for promotion';
    END IF;

    -- HARD-GATE VALIDATION: Ensure description is present
    IF v_desc_to_use IS NULL OR trim(v_desc_to_use) = '' THEN
        RAISE EXCEPTION 'Description is required for promotion';
    END IF;

    -- HARD-GATE VALIDATION: Ensure date is present
    IF v_date_to_use IS NULL THEN
        RAISE EXCEPTION 'Date is required for promotion';
    END IF;

    -- 3. INSERT into the Main Ledger
    INSERT INTO transactions (
        user_id,
        account_id,
        category_id,
        date,
        description,
        amount_original,
        amount_home,
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
        v_amount_to_use,
        v_amount_to_use,
        COALESCE(p_exchange_rate, v_inbox_record.exchange_rate, 1.0),
        v_inbox_record.notes,
        v_inbox_record.source_text,
        p_inbox_id
    ) RETURNING id INTO v_new_transaction_id;

    -- 4. Mark inbox item as processed (AFTER successful insert)
    UPDATE transaction_inbox
    SET status = 'processed', updated_at = NOW()
    WHERE id = p_inbox_id;

    RETURN json_build_object('success', true, 'transaction_id', v_new_transaction_id);
END;
$$;

COMMENT ON FUNCTION "public"."promote_inbox_item"(
    "uuid", "uuid", "uuid", "text", timestamp with time zone, numeric, numeric
) IS '[HARDENED 2026-02-02] Promotes inbox item to ledger with ownership validation for account_id and category_id. Includes exchange_rate override. Defense-in-depth for SECURITY DEFINER bypass.';


-- ============================================================================
-- 5. HARDEN: create_transfer (9-parameter overload without currency)
-- ============================================================================
-- Add category ownership check when p_category_id IS NOT NULL
-- Note: Transfers allow NULL category (uncategorized transfer is valid)
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."create_transfer"(
    "p_user_id" "uuid",
    "p_from_account_id" "uuid",
    "p_to_account_id" "uuid",
    "p_amount" numeric,
    "p_amount_received" numeric,
    "p_exchange_rate" numeric,
    "p_date" timestamp with time zone,
    "p_description" "text",
    "p_category_id" "uuid"
) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
AS $$
DECLARE
    v_transfer_id uuid;
    v_transaction_from_id uuid;
    v_transaction_to_id uuid;
BEGIN
    -- ========================================================================
    -- OWNERSHIP VALIDATION (Defense-in-Depth)
    -- Note: p_user_id is passed explicitly, but we validate against auth.uid()
    -- to prevent privilege escalation attacks
    -- ========================================================================
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    IF p_user_id != auth.uid() THEN
        RAISE EXCEPTION 'User ID mismatch - cannot create transfer for another user';
    END IF;

    -- Validate account ownership (required)
    PERFORM validate_account_ownership(p_from_account_id, p_user_id);
    PERFORM validate_account_ownership(p_to_account_id, p_user_id);

    -- Validate category ownership (optional - NULL is allowed for transfers)
    IF p_category_id IS NOT NULL THEN
        PERFORM validate_category_ownership(p_category_id, p_user_id);
    END IF;

    -- Generate a transfer ID to link the transactions
    v_transfer_id := gen_random_uuid();

    -- Create Outbound Transaction (Source)
    INSERT INTO transactions (
        user_id,
        account_id,
        category_id,
        amount_original,
        description,
        notes,
        date,
        transfer_id,
        exchange_rate
    ) VALUES (
        p_user_id,
        p_from_account_id,
        p_category_id,
        -p_amount,
        p_description,
        'Transfer Out',
        p_date,
        v_transfer_id,
        1.0
    ) RETURNING id INTO v_transaction_from_id;

    -- Create Inbound Transaction (Destination)
    INSERT INTO transactions (
        user_id,
        account_id,
        category_id,
        amount_original,
        description,
        notes,
        date,
        transfer_id,
        exchange_rate
    ) VALUES (
        p_user_id,
        p_to_account_id,
        p_category_id,
        p_amount_received,
        p_description,
        'Transfer In: ' || p_exchange_rate::text,
        p_date,
        v_transfer_id,
        1.0
    ) RETURNING id INTO v_transaction_to_id;

    RETURN json_build_object(
        'transfer_id', v_transfer_id,
        'from_transaction_id', v_transaction_from_id,
        'to_transaction_id', v_transaction_to_id
    );
END;
$$;

COMMENT ON FUNCTION "public"."create_transfer"(
    "uuid", "uuid", "uuid", numeric, numeric, numeric, timestamp with time zone, "text", "uuid"
) IS '[HARDENED 2026-02-02] Creates transfer with ownership validation for accounts and category. Defense-in-depth for SECURITY DEFINER bypass.';


-- ============================================================================
-- 6. HARDEN: create_transfer (11-parameter overload with currency codes)
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."create_transfer"(
    "p_user_id" "uuid",
    "p_from_account_id" "uuid",
    "p_to_account_id" "uuid",
    "p_amount" numeric,
    "p_from_currency" "text",
    "p_to_currency" "text",
    "p_amount_received" numeric,
    "p_exchange_rate" numeric,
    "p_date" timestamp with time zone,
    "p_description" "text",
    "p_category_id" "uuid"
) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
AS $$
DECLARE
    v_transfer_id uuid;
    v_transaction_from_id uuid;
    v_transaction_to_id uuid;
BEGIN
    -- ========================================================================
    -- OWNERSHIP VALIDATION (Defense-in-Depth)
    -- ========================================================================
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    IF p_user_id != auth.uid() THEN
        RAISE EXCEPTION 'User ID mismatch - cannot create transfer for another user';
    END IF;

    -- Validate account ownership (required)
    PERFORM validate_account_ownership(p_from_account_id, p_user_id);
    PERFORM validate_account_ownership(p_to_account_id, p_user_id);

    -- Validate category ownership (optional - NULL is allowed for transfers)
    IF p_category_id IS NOT NULL THEN
        PERFORM validate_category_ownership(p_category_id, p_user_id);
    END IF;

    -- Generate a transfer ID to link the transactions
    v_transfer_id := gen_random_uuid();

    -- Create Outbound Transaction (Source)
    INSERT INTO transactions (
        user_id,
        account_id,
        category_id,
        amount_original,
        currency_original,
        description,
        notes,
        date,
        transfer_id,
        exchange_rate
    ) VALUES (
        p_user_id,
        p_from_account_id,
        p_category_id,
        -p_amount,
        p_from_currency,
        p_description,
        'Transfer Out',
        p_date,
        v_transfer_id,
        1.0
    ) RETURNING id INTO v_transaction_from_id;

    -- Create Inbound Transaction (Destination)
    INSERT INTO transactions (
        user_id,
        account_id,
        category_id,
        amount_original,
        currency_original,
        description,
        notes,
        date,
        transfer_id,
        exchange_rate
    ) VALUES (
        p_user_id,
        p_to_account_id,
        p_category_id,
        p_amount_received,
        p_to_currency,
        p_description,
        'Transfer In: ' || p_exchange_rate::text,
        p_date,
        v_transfer_id,
        1.0
    ) RETURNING id INTO v_transaction_to_id;

    RETURN json_build_object(
        'transfer_id', v_transfer_id,
        'from_transaction_id', v_transaction_from_id,
        'to_transaction_id', v_transaction_to_id
    );
END;
$$;

COMMENT ON FUNCTION "public"."create_transfer"(
    "uuid", "uuid", "uuid", numeric, "text", "text", numeric, numeric, timestamp with time zone, "text", "uuid"
) IS '[HARDENED 2026-02-02] Creates transfer with currency codes and ownership validation. Defense-in-depth for SECURITY DEFINER bypass.';


-- ============================================================================
-- 7. HARDEN: update_transaction_with_version
-- ============================================================================
-- Add ownership validation when categoryId or accountId is in p_updates
-- ============================================================================

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
    v_category_id UUID;
    v_account_id UUID;
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

    -- ========================================================================
    -- OWNERSHIP VALIDATION (Defense-in-Depth)
    -- Validate ownership of referenced entities BEFORE update
    -- ========================================================================

    -- Validate category ownership if categoryId is being updated
    IF p_updates ? 'categoryId' THEN
        v_category_id := (p_updates->>'categoryId')::uuid;
        -- NULL is allowed (uncategorizing a transaction)
        IF v_category_id IS NOT NULL THEN
            PERFORM validate_category_ownership(v_category_id, v_user_id);
        END IF;
    END IF;

    -- Validate account ownership if accountId is being updated
    IF p_updates ? 'accountId' THEN
        v_account_id := (p_updates->>'accountId')::uuid;
        IF v_account_id IS NOT NULL THEN
            PERFORM validate_account_ownership(v_account_id, v_user_id);
        END IF;
    END IF;

    -- Atomic update with version bump
    UPDATE transactions
    SET
        description = COALESCE(p_updates->>'description', description),
        amount_cents = COALESCE((p_updates->>'amountCents')::BIGINT, amount_cents),
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
        version = version + 1,
        updated_at = NOW()
    WHERE id = p_transaction_id
        AND user_id = v_user_id
        AND version = p_expected_version;

    RETURN jsonb_build_object('success', true, 'newVersion', p_expected_version + 1);
END;
$$;

COMMENT ON FUNCTION update_transaction_with_version(UUID, INTEGER, JSONB) IS
'[HARDENED 2026-02-02] Version-checked transaction update with ownership validation for categoryId and accountId. Defense-in-depth for SECURITY DEFINER bypass.';


-- ============================================================================
-- 8. HARDEN: update_inbox_with_version
-- ============================================================================
-- Add ownership validation when category_id or account_id is in p_updates
-- ============================================================================

CREATE OR REPLACE FUNCTION update_inbox_with_version(
    p_inbox_id UUID,
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
    v_rows_updated INTEGER;
    v_new_version INTEGER;
    v_category_id UUID;
    v_account_id UUID;
BEGIN
    -- 1. Get authenticated user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- 2. Check current version
    SELECT version INTO v_current_version
    FROM transaction_inbox
    WHERE id = p_inbox_id
        AND user_id = v_user_id
        AND deleted_at IS NULL;

    -- Item not found or access denied
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
            'message', 'Inbox item has been modified by another device'
        );
    END IF;

    -- ========================================================================
    -- OWNERSHIP VALIDATION (Defense-in-Depth)
    -- Validate ownership of referenced entities BEFORE update
    -- NULL is allowed for inbox items (uncategorized/unassigned draft)
    -- ========================================================================

    -- Validate category ownership if category_id is being updated
    IF p_updates ? 'category_id' THEN
        v_category_id := (p_updates->>'category_id')::uuid;
        IF v_category_id IS NOT NULL THEN
            PERFORM validate_category_ownership(v_category_id, v_user_id);
        END IF;
    END IF;

    -- Validate account ownership if account_id is being updated
    IF p_updates ? 'account_id' THEN
        v_account_id := (p_updates->>'account_id')::uuid;
        IF v_account_id IS NOT NULL THEN
            PERFORM validate_account_ownership(v_account_id, v_user_id);
        END IF;
    END IF;

    -- 4. Perform update (version auto-increments via trigger)
    UPDATE transaction_inbox
    SET
        amount_cents = COALESCE((p_updates->>'amount_cents')::BIGINT, amount_cents),
        description = COALESCE(p_updates->>'description', description),
        date = COALESCE(p_updates->>'date', date),
        account_id = COALESCE((p_updates->>'account_id')::UUID, account_id),
        category_id = COALESCE((p_updates->>'category_id')::UUID, category_id),
        exchange_rate = COALESCE((p_updates->>'exchange_rate')::NUMERIC, exchange_rate),
        notes = COALESCE(p_updates->>'notes', notes)
    WHERE id = p_inbox_id
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

    -- 6. Get new version
    SELECT version INTO v_new_version
    FROM transaction_inbox
    WHERE id = p_inbox_id;

    -- 7. Success
    RETURN jsonb_build_object(
        'success', true,
        'newVersion', v_new_version
    );
END;
$$;

COMMENT ON FUNCTION update_inbox_with_version(UUID, INTEGER, JSONB) IS
'[HARDENED 2026-02-02] Version-safe inbox update with ownership validation for category_id and account_id. Defense-in-depth for SECURITY DEFINER bypass.';


-- ============================================================================
-- AUDIT TRAIL
-- ============================================================================

COMMIT;
