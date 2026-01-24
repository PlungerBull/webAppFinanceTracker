-- Inbox Feature Hardening: Version Checked Promotion
-- Updates promote_inbox_item RPC to accept expected_version for optimistic concurrency control.

CREATE OR REPLACE FUNCTION "public"."promote_inbox_item"(
  "p_inbox_id" "uuid",
  "p_account_id" "uuid",
  "p_category_id" "uuid",
  "p_final_description" "text" DEFAULT NULL::"text",
  "p_final_date" timestamp with time zone DEFAULT NULL::timestamp with time zone,
  "p_final_amount" numeric DEFAULT NULL::numeric,
  "p_exchange_rate" numeric DEFAULT NULL::numeric,
  "p_expected_version" integer DEFAULT NULL::integer -- NEW: Optimistic Concurrency Control
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
BEGIN
    -- 1. Fetch the inbox item
    SELECT * INTO v_inbox_record FROM transaction_inbox WHERE id = p_inbox_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inbox item not found';
    END IF;

    -- OPTIMISTIC CONCURRENCY CONTROL
    -- If expected version is provided, strictly enforce it
    IF p_expected_version IS NOT NULL AND v_inbox_record.version != p_expected_version THEN
         RAISE EXCEPTION 'Version conflict: Expected version %, but found %. The item has been modified by another device.', p_expected_version, v_inbox_record.version
         USING ERRCODE = 'P0001'; -- Custom error code for version conflict
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
    v_amount_to_use := COALESCE(p_final_amount, v_inbox_record.amount_original);
    v_desc_to_use := COALESCE(p_final_description, v_inbox_record.description);
    v_date_to_use := COALESCE(p_final_date, v_inbox_record.date);

    -- HARD-GATE VALIDATIONS
    IF v_amount_to_use IS NULL THEN
        RAISE EXCEPTION 'Amount is required for promotion';
    END IF;
    IF v_desc_to_use IS NULL OR trim(v_desc_to_use) = '' THEN
        RAISE EXCEPTION 'Description is required for promotion';
    END IF;
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
        amount_home,        -- Placeholder, trigger will recalculate
        exchange_rate,
        notes,              -- Direct transfer
        source_text,        -- Direct transfer
        inbox_id            -- Link to birth certificate
    ) VALUES (
        v_inbox_record.user_id,
        p_account_id,
        p_category_id,
        v_date_to_use,
        v_desc_to_use,
        v_amount_to_use,
        v_amount_to_use,    -- Placeholder
        COALESCE(p_exchange_rate, v_inbox_record.exchange_rate, 1.0),
        v_inbox_record.notes,
        v_inbox_record.source_text,
        p_inbox_id
    ) RETURNING id INTO v_new_transaction_id;

    -- 4. TOMBSTONE PATTERN: Soft Delete
    UPDATE transaction_inbox
    SET status = 'processed',
        deleted_at = NOW(),
        updated_at = NOW()
    WHERE id = p_inbox_id;

    RETURN json_build_object('success', true, 'transaction_id', v_new_transaction_id);
END;
$$;

COMMENT ON FUNCTION "public"."promote_inbox_item"("p_inbox_id" "uuid", "p_account_id" "uuid", "p_category_id" "uuid", "p_final_description" "text", "p_final_date" timestamp with time zone, "p_final_amount" numeric, "p_exchange_rate" numeric, "p_expected_version" integer) IS 'Promote RPC with Version Check. If p_expected_version is provided, fails if DB version differs.';
