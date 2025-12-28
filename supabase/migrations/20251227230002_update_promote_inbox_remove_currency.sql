-- ============================================================================
-- MIGRATION: Update promote_inbox_item to Remove Currency (Trust Trigger)
-- Purpose: Remove explicit currency handling from RPC, let Sacred Ledger trigger enforce
-- Date: 2025-12-27
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
    v_amount_to_use := COALESCE(p_final_amount, v_inbox_record.amount);
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
    -- SACRED LEDGER FIX: Remove currency_original from INSERT
    -- The enforce_sacred_ledger_currency trigger will automatically derive it from p_account_id
    INSERT INTO transactions (
        user_id,
        account_id,
        category_id,
        date,
        description,
        amount_original,
        -- currency_original REMOVED - trigger enforces it from account
        amount_home, -- Placeholder, calculate_amount_home trigger will recalculate
        exchange_rate
    ) VALUES (
        v_inbox_record.user_id,
        p_account_id,
        p_category_id,
        v_date_to_use,
        v_desc_to_use,
        v_amount_to_use,
        -- v_inbox_record.currency REMOVED - no longer used
        v_amount_to_use, -- Placeholder value
        COALESCE(v_inbox_record.exchange_rate, 1.0)
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

-- Update comment to reflect Sacred Ledger integration
COMMENT ON FUNCTION "public"."promote_inbox_item" IS
'HARD-GATE VALIDATION + SACRED LEDGER: Validates all required fields (account_id, category_id, amount, description, date) and relies on enforce_sacred_ledger_currency trigger to automatically set currency from account. Currency is derived from p_account_id, ensuring transactions always match their account currency.';
