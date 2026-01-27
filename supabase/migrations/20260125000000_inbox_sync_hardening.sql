-- Inbox Feature Hardening: Sync Foundation
-- 1. Add versioning and tombstones to transaction_inbox
-- 2. Use global_transaction_version for unified sync pulse
-- 3. Update promote_inbox_item to set deleted_at (Tombstone Pattern)

-- ============================================================================
-- 1. ADD COLUMNS
-- ============================================================================
ALTER TABLE "public"."transaction_inbox"
ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ DEFAULT NULL;

-- ============================================================================
-- 2. CREATE TRIGGERS (Unified Sync Pulse)
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."set_inbox_version"()
RETURNS TRIGGER AS $$
BEGIN
  -- Pull from the SAME global sequence as the ledger for unified syncing
  -- This ensures a single "Sync Pulse" across the entire User Profile
  NEW.version := nextval('global_transaction_version');
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trigger_set_inbox_version" ON "public"."transaction_inbox";
CREATE TRIGGER "trigger_set_inbox_version"
  BEFORE INSERT OR UPDATE ON "public"."transaction_inbox"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."set_inbox_version"();

-- ============================================================================
-- 3. UPDATE VIEW (Active Items Only)
-- ============================================================================
-- Must DROP and recreate because Views don't support ADD COLUMN
DROP VIEW IF EXISTS "public"."transaction_inbox_view";

CREATE VIEW "public"."transaction_inbox_view"
WITH (security_invoker = true)
AS
SELECT
  -- Core inbox fields
  i.id,
  i.user_id,
  i.amount_cents,
  i.description,
  i.date,
  i.source_text,
  i.status,
  i.account_id,
  i.category_id,
  i.exchange_rate,
  i.notes,
  i.created_at,
  i.updated_at,
  -- Sync fields
  i.version,
  i.deleted_at,

  -- Account fields (LEFT JOIN to support NULL account_id for drafts)
  a.name AS account_name,
  a.currency_code AS currency_original,  -- ALIASED (NULL if no account)
  a.color AS account_color,

  -- Category fields (LEFT JOIN to support NULL category_id for drafts)
  c.name AS category_name,
  c.color AS category_color,
  c.type AS category_type
FROM "public"."transaction_inbox" i
LEFT JOIN "public"."bank_accounts" a ON i.account_id = a.id
LEFT JOIN "public"."categories" c ON i.category_id = c.id
WHERE i.deleted_at IS NULL; -- Tombstone filtering: Only show active items

COMMENT ON VIEW "public"."transaction_inbox_view" IS 'Denormalized inbox view with sync fields (version, deleted_at). Filters out soft-deleted items (deleted_at IS NULL). currency_original is ALIASED from bank_accounts.currency_code.';

-- ============================================================================
-- 4. UPDATE RPC (Tombstone Pattern)
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
    -- Note: p_final_amount is in cents, inbox stores amount_cents
    v_amount_to_use := COALESCE(p_final_amount, v_inbox_record.amount_cents);
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
        amount_cents,
        amount_home_cents,  -- Placeholder, trigger will recalculate
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

    -- 4. TOMBSTONE PATTERN: Soft Delete instead of just marking processed
    -- This ensures the sync engine sees the "deletion" event
    UPDATE transaction_inbox
    SET status = 'processed',
        deleted_at = NOW(),
        updated_at = NOW()
    WHERE id = p_inbox_id;

    RETURN json_build_object('success', true, 'transaction_id', v_new_transaction_id);
END;
$$;
