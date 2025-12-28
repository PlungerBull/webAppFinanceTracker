-- ============================================================================
-- MIGRATION: Update promote_inbox_item - Add Notes and Traceability
-- Purpose: Transfer notes and source_text, store inbox_id for audit trail
-- Date: 2025-12-28
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."promote_inbox_item"(
    "p_inbox_id" "uuid",
    "p_account_id" "uuid",
    "p_category_id" "uuid",
    "p_final_description" "text" DEFAULT NULL::"text",
    "p_final_date" timestamp with time zone DEFAULT NULL::timestamp with time zone,
    "p_final_amount" numeric DEFAULT NULL::numeric
) RETURNS json
    LANGUAGE "plpgsql"
    SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_inbox_record record;
    v_new_transaction_id uuid;
    v_amount_to_use numeric;
    v_desc_to_use text;
    v_date_to_use timestamptz;
BEGIN
    -- 1. Fetch the inbox item
    SELECT * INTO v_inbox_record FROM transaction_inbox WHERE id = p_inbox_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inbox item not found';
    END IF;

    -- HARD-GATE VALIDATION: Ensure account_id is provided
    IF p_account_id IS NULL THEN
        RAISE EXCEPTION 'Account ID is required for promotion';
    END IF;

    -- HARD-GATE VALIDATION: Ensure category_id is provided
    IF p_category_id IS NULL THEN
        RAISE EXCEPTION 'Category ID is required for promotion';
    END IF;

    -- 2. Determine final values (Use override if provided, else use inbox value)
    -- CRITICAL: Use renamed columns (amount_original, currency_original)
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
    -- FULL MIRROR: Transfer notes and source_text directly (no appending)
    -- BIRTH CERTIFICATE: Store inbox_id for permanent audit trail
    -- SACRED LEDGER: currency_original auto-derived from account via trigger
    INSERT INTO transactions (
        user_id,
        account_id,
        category_id,
        date,
        description,
        amount_original,
        amount_home,        -- Placeholder, calculate_amount_home trigger will recalculate
        exchange_rate,
        notes,              -- NEW: Direct transfer from inbox
        source_text,        -- NEW: Raw context mirroring
        inbox_id            -- NEW: Birth certificate
    ) VALUES (
        v_inbox_record.user_id,
        p_account_id,
        p_category_id,
        v_date_to_use,
        v_desc_to_use,
        v_amount_to_use,
        v_amount_to_use,    -- Placeholder value
        COALESCE(v_inbox_record.exchange_rate, 1.0),
        v_inbox_record.notes,           -- Direct copy (may be null)
        v_inbox_record.source_text,     -- Direct copy (may be null)
        p_inbox_id                      -- Traceability link
    ) RETURNING id INTO v_new_transaction_id;

    -- 4. Mark inbox item as processed (instead of deleting for audit trail)
    UPDATE transaction_inbox
    SET status = 'processed', updated_at = NOW()
    WHERE id = p_inbox_id;

    RETURN json_build_object('success', true, 'transaction_id', v_new_transaction_id);
END;
$$;

-- Ensure function owner is correct
ALTER FUNCTION "public"."promote_inbox_item"(
    "p_inbox_id" "uuid",
    "p_account_id" "uuid",
    "p_category_id" "uuid",
    "p_final_description" "text",
    "p_final_date" timestamp with time zone,
    "p_final_amount" numeric
) OWNER TO "postgres";

-- Update comment to reflect Full Mirror architecture
COMMENT ON FUNCTION "public"."promote_inbox_item" IS
'FULL MIRROR + HARD-GATE VALIDATION + SACRED LEDGER: Validates all required fields (account_id, category_id, amount, description, date) and transfers notes and source_text directly from inbox to ledger. Stores inbox_id as birth certificate for permanent audit trail. Currency is automatically derived from p_account_id via enforce_sacred_ledger_currency trigger.';
