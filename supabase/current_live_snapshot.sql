


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."account_type" AS ENUM (
    'checking',
    'savings',
    'credit_card',
    'investment',
    'loan',
    'cash',
    'other'
);


ALTER TYPE "public"."account_type" OWNER TO "postgres";


CREATE TYPE "public"."transaction_import_input" AS (
	"Date" "text",
	"Amount" numeric,
	"Description" "text",
	"Category" "text",
	"Account" "text",
	"Currency" "text",
	"Exchange Rate" numeric,
	"Notes" "text"
);


ALTER TYPE "public"."transaction_import_input" OWNER TO "postgres";


CREATE TYPE "public"."transaction_type" AS ENUM (
    'expense',
    'income',
    'transfer',
    'opening_balance',
    'adjustment'
);


ALTER TYPE "public"."transaction_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_amount_home"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Default exchange_rate to 1 if missing to prevent math errors
  NEW.amount_home := NEW.amount_original * COALESCE(NEW.exchange_rate, 1);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_amount_home"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_amount_home"() IS 'Calculates amount_home as amount_original * exchange_rate. Currency is implicitly determined by account_id (via JOIN to bank_accounts.currency_code).';



CREATE OR REPLACE FUNCTION "public"."cascade_color_to_children"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Only proceed if the color actually changed
    IF NEW.color IS DISTINCT FROM OLD.color THEN
        -- Update all direct children to have the new color
        UPDATE categories
        SET color = NEW.color
        WHERE parent_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."cascade_color_to_children"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_transaction_category_hierarchy"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    cat_parent_id UUID;
BEGIN
    IF NEW.category_id IS NOT NULL THEN
        SELECT parent_id INTO cat_parent_id FROM categories WHERE id = NEW.category_id;
        
        IF cat_parent_id IS NULL THEN
            RAISE EXCEPTION 'Transactions can only be assigned to subcategories (categories where parent_id IS NOT NULL)';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_transaction_category_hierarchy"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_orphaned_categories"() RETURNS TABLE("category_id" "uuid", "category_name" "text", "was_orphaned" boolean)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    orphan_record RECORD;
    unassigned_id UUID;
    affected_count INTEGER := 0;
BEGIN
    -- Find all orphaned categories (subcategories with no valid parent)
    FOR orphan_record IN 
        SELECT c.id, c.name, c.user_id
        FROM categories c
        WHERE c.parent_id IS NOT NULL 
          AND NOT EXISTS (SELECT 1 FROM categories p WHERE p.id = c.parent_id)
    LOOP
        -- Find or create "Un-assigned" for this user
        SELECT id INTO unassigned_id 
        FROM categories 
        WHERE name = 'Un-assigned' 
          AND parent_id IS NULL 
          AND user_id = orphan_record.user_id;
        
        -- If Un-assigned doesn't exist for this user, create it
        IF unassigned_id IS NULL THEN
            INSERT INTO categories (name, color, user_id, created_at, updated_at, parent_id)
            VALUES ('Un-assigned', '#6B7280', orphan_record.user_id, NOW(), NOW(), NULL)
            RETURNING id INTO unassigned_id;
        END IF;
        
        -- Reassign orphan to Un-assigned
        UPDATE categories 
        SET parent_id = unassigned_id 
        WHERE id = orphan_record.id;
        
        -- Return info about what was fixed
        category_id := orphan_record.id;
        category_name := orphan_record.name;
        was_orphaned := TRUE;
        affected_count := affected_count + 1;
        
        RETURN NEXT;
    END LOOP;
    
    -- Log result
    RAISE NOTICE 'Cleanup complete. Fixed % orphaned categories.', affected_count;
    
    RETURN;
END;
$$;


ALTER FUNCTION "public"."cleanup_orphaned_categories"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clear_user_data"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_authenticated_user_id uuid;
BEGIN
  -- === HARD-GATE: Identity Verification ===
  -- Get the currently authenticated user from session
  v_authenticated_user_id := auth.uid();

  -- Security check: Verify requesting user matches authenticated session
  -- This prevents unauthorized data wipes even if endpoint is exposed
  IF v_authenticated_user_id IS NULL OR v_authenticated_user_id != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: User can only clear their own data';
  END IF;

  -- === SEQUENTIAL DEPENDENCY PURGE ===
  -- Order is critical to avoid FK constraint violations and maximize performance

  -- 1. The Scratchpad (Inbox): Delete all pending transaction inbox items
  --    Must go first: has FK refs to categories and accounts (no CASCADE)
  DELETE FROM transaction_inbox WHERE user_id = p_user_id;

  -- 2. The Foundation (Bank Accounts): CASCADE Performance Optimization
  --    Deleting accounts auto-deletes ALL transactions via CASCADE
  --    Balance update triggers become no-ops (account already gone)
  --    This is the "Sacred Ledger" optimization - one delete, thousands free
  DELETE FROM bank_accounts WHERE user_id = p_user_id;

  -- 3. Hierarchical Structure Cleanup: Untie the category knot
  --    categories_parent_id_fkey uses ON DELETE RESTRICT
  --    Must delete children before parents to avoid constraint violation
  DELETE FROM categories WHERE user_id = p_user_id AND parent_id IS NOT NULL;
  DELETE FROM categories WHERE user_id = p_user_id AND parent_id IS NULL;

  -- === PRESERVATION OF USER ENVIRONMENT ===
  -- user_settings table is NEVER touched here
  -- Theme, main_currency, start_of_week remain intact
  -- User returns to "Fresh Start" with their familiar environment

END;
$$;


ALTER FUNCTION "public"."clear_user_data"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_account"("p_account_name" "text", "p_account_color" "text", "p_currency_code" "text", "p_starting_balance" numeric DEFAULT 0, "p_account_type" "public"."account_type" DEFAULT 'checking'::"public"."account_type") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_account_id uuid;
  v_user_id uuid;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();

  -- Create bank account with specified currency
  INSERT INTO bank_accounts (user_id, name, color, currency_code, type)
  VALUES (v_user_id, p_account_name, p_account_color, p_currency_code, p_account_type)
  RETURNING id INTO v_account_id;

  -- Create opening balance transaction (if non-zero)
  IF p_starting_balance <> 0 THEN
    INSERT INTO transactions (
      user_id,
      account_id,
      category_id,     -- NULL (structural marker for opening balance)
      transfer_id,     -- NULL (not a transfer)
      -- REMOVED: currency_original - now derived from account_id via JOIN
      amount_original,
      amount_home,     -- Trigger will recalculate (amount_original * exchange_rate)
      exchange_rate,
      date,
      description
    ) VALUES (
      v_user_id,
      v_account_id,
      NULL,            -- Opening balance has no category
      NULL,            -- Opening balance has no transfer
      p_starting_balance,
      p_starting_balance,  -- Placeholder value, trigger will update
      1.0,             -- Opening balances use 1:1 rate (same currency as account)
      CURRENT_DATE,
      'Opening Balance'
    );
  END IF;

  -- Return account metadata
  RETURN jsonb_build_object(
    'id', v_account_id,
    'name', p_account_name,
    'color', p_account_color,
    'currency_code', p_currency_code,
    'type', p_account_type
  );
END;
$$;


ALTER FUNCTION "public"."create_account"("p_account_name" "text", "p_account_color" "text", "p_currency_code" "text", "p_starting_balance" numeric, "p_account_type" "public"."account_type") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_account"("p_account_name" "text", "p_account_color" "text", "p_currency_code" "text", "p_starting_balance" numeric, "p_account_type" "public"."account_type") IS 'Creates account with optional opening balance. Currency is set on the account; opening balance transaction inherits currency via account_id.';



CREATE OR REPLACE FUNCTION "public"."create_account_group"("p_user_id" "uuid", "p_name" "text", "p_color" "text", "p_type" "public"."account_type", "p_currencies" "text"[]) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
    v_group_id uuid;
    v_currency text;
BEGIN
    v_group_id := gen_random_uuid();
    FOREACH v_currency IN ARRAY p_currencies
    LOOP
        INSERT INTO bank_accounts (
            user_id, group_id, name, color, type, currency_code, is_visible
        ) VALUES (
            p_user_id, v_group_id, p_name || ' (' || v_currency || ')', p_color, p_type, v_currency, true
        );
    END LOOP;
    RETURN json_build_object('group_id', v_group_id, 'status', 'success');
END;
$$;


ALTER FUNCTION "public"."create_account_group"("p_user_id" "uuid", "p_name" "text", "p_color" "text", "p_type" "public"."account_type", "p_currencies" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_transfer"("p_user_id" "uuid", "p_from_account_id" "uuid", "p_to_account_id" "uuid", "p_amount_cents" bigint, "p_amount_received_cents" bigint, "p_exchange_rate" numeric, "p_date" timestamp with time zone, "p_description" "text", "p_category_id" "uuid" DEFAULT NULL) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_transfer_id uuid;
  v_transaction_from_id uuid;
  v_transaction_to_id uuid;
BEGIN
  -- Generate a transfer ID to link the transactions
  v_transfer_id := gen_random_uuid();

  -- Create Outbound Transaction (Source)
  -- SACRED LEDGER: Currency derived from account via trigger
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
    -p_amount_cents,  -- Negative for outgoing, INTEGER cents
    p_description,
    'Transfer Out',
    p_date,
    v_transfer_id,
    1.0
  ) RETURNING id INTO v_transaction_from_id;

  -- Create Inbound Transaction (Destination)
  -- SACRED LEDGER: Currency derived from account via trigger
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
    p_amount_received_cents,  -- Positive for incoming, INTEGER cents
    p_description,
    'Transfer In: ' || p_exchange_rate::TEXT,
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


ALTER FUNCTION "public"."create_transfer"("p_user_id" "uuid", "p_from_account_id" "uuid", "p_to_account_id" "uuid", "p_amount_cents" bigint, "p_amount_received_cents" bigint, "p_exchange_rate" numeric, "p_date" timestamp with time zone, "p_description" "text", "p_category_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_transfer"("p_user_id" "uuid", "p_from_account_id" "uuid", "p_to_account_id" "uuid", "p_amount_cents" bigint, "p_amount_received_cents" bigint, "p_exchange_rate" numeric, "p_date" timestamp with time zone, "p_description" "text", "p_category_id" "uuid") IS 'S-TIER: Creates a transfer between two accounts using INTEGER CENTS (ADR 001 compliant). Currency is automatically derived from each account via trigger.';


CREATE OR REPLACE FUNCTION "public"."delete_transfer"("p_user_id" "uuid", "p_transfer_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM transactions
  WHERE user_id = p_user_id AND transfer_id = p_transfer_id;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  IF v_deleted_count != 2 THEN
    RAISE EXCEPTION 'Transfer not found or incomplete';
  END IF;
END;
$$;


ALTER FUNCTION "public"."delete_transfer"("p_user_id" "uuid", "p_transfer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_monthly_spending_by_category"("p_months_back" integer DEFAULT 6, "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS TABLE("category_id" "uuid", "category_name" "text", "category_color" "text", "month_key" "text", "total_amount" numeric)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH monthly_data AS (
    SELECT 
      t.category_id,
      TO_CHAR(t.date, 'YYYY-MM') as month_key,
      SUM(t.amount_home) as amount
    FROM transactions t
    WHERE 
      t.user_id = auth.uid() -- Strictly enforce current user
      AND t.date >= (CURRENT_DATE - (p_months_back || ' months')::INTERVAL)
    GROUP BY 
      t.category_id, 
      TO_CHAR(t.date, 'YYYY-MM')
  )
  SELECT 
    c.id as category_id,
    c.name as category_name,
    c.color as category_color,
    md.month_key,
    ABS(md.amount) as total_amount
  FROM monthly_data md
  JOIN categories c ON md.category_id = c.id
  ORDER BY md.month_key DESC, total_amount DESC;
END;
$$;


ALTER FUNCTION "public"."get_monthly_spending_by_category"("p_months_back" integer, "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_monthly_spending_by_category"("p_user_id" "uuid", "p_months_back" integer DEFAULT 6) RETURNS TABLE("category_id" "uuid", "category_name" "text", "category_icon" "text", "month_key" "text", "total_amount" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(t.category_id, '00000000-0000-0000-0000-000000000000'::UUID) as category_id,
    COALESCE(c.name, 'Uncategorized') as category_name,
    COALESCE(c.icon, '❓') as category_icon,
    TO_CHAR(DATE_TRUNC('month', t.date), 'YYYY-MM') as month_key,
    SUM(t.amount_home) as total_amount
  FROM transactions t
  LEFT JOIN categories c ON c.id = t.category_id
  WHERE t.user_id = p_user_id
    AND t.date >= DATE_TRUNC('month', NOW() - (p_months_back || ' months')::INTERVAL)
  GROUP BY 
    COALESCE(t.category_id, '00000000-0000-0000-0000-000000000000'::UUID),
    COALESCE(c.name, 'Uncategorized'),
    COALESCE(c.icon, '❓'),
    month_key
  HAVING SUM(t.amount_home) != 0
  ORDER BY category_name, month_key;
END;
$$;


ALTER FUNCTION "public"."get_monthly_spending_by_category"("p_user_id" "uuid", "p_months_back" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."import_transactions"("p_user_id" "uuid", "p_transactions" "jsonb", "p_default_account_color" "text", "p_default_category_color" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_transaction jsonb;
  v_date date;
  v_amount numeric;
  v_description text;
  v_category_name text;
  v_account_name text;
  v_currency_code text;
  v_exchange_rate numeric;
  v_notes text;

  v_account_id uuid;
  v_category_id uuid;

  v_success_count integer := 0;
  v_error_count integer := 0;
  v_errors text[] := array[]::text[];
  v_row_index integer := 0;
BEGIN
  -- Iterate through each transaction in the JSON array
  FOR v_transaction IN SELECT * FROM jsonb_array_elements(p_transactions)
  LOOP
    v_row_index := v_row_index + 1;

    BEGIN
      -- Extract values
      v_date := (v_transaction->>'Date')::date;
      v_amount := (v_transaction->>'Amount')::numeric;
      v_description := v_transaction->>'Description';
      v_category_name := v_transaction->>'Category';
      v_account_name := v_transaction->>'Account';
      v_currency_code := upper(v_transaction->>'Currency');
      v_exchange_rate := coalesce((v_transaction->>'Exchange Rate')::numeric, 1.0);
      v_notes := v_transaction->>'Notes';

      -- Validate required fields
      IF v_date IS NULL THEN RAISE EXCEPTION 'Date is required'; END IF;
      IF v_amount IS NULL THEN RAISE EXCEPTION 'Amount is required'; END IF;
      IF v_account_name IS NULL OR v_account_name = '' THEN RAISE EXCEPTION 'Account is required'; END IF;
      IF v_description IS NULL OR v_description = '' THEN RAISE EXCEPTION 'Description is required'; END IF;
      IF v_category_name IS NULL OR v_category_name = '' THEN RAISE EXCEPTION 'Category is required'; END IF;
      IF v_currency_code IS NULL OR v_currency_code = '' THEN RAISE EXCEPTION 'Currency is required'; END IF;

      -- Account Lookup by Name + Currency
      -- This ensures we match the correct account when multiple accounts share the same name
      SELECT id INTO v_account_id FROM bank_accounts
      WHERE user_id = p_user_id
        AND lower(name) = lower(v_account_name)
        AND currency_code = v_currency_code;

      IF v_account_id IS NULL THEN
        -- Create account if it doesn't exist (with currency_code)
        INSERT INTO bank_accounts (user_id, name, color, currency_code)
        VALUES (p_user_id, v_account_name, p_default_account_color, v_currency_code)
        RETURNING id INTO v_account_id;
      END IF;

      -- Handle Category
      SELECT id INTO v_category_id FROM categories
      WHERE user_id = p_user_id AND lower(name) = lower(v_category_name);

      IF v_category_id IS NULL THEN
        INSERT INTO categories (user_id, name, color, is_default)
        VALUES (p_user_id, v_category_name, p_default_category_color, false)
        RETURNING id INTO v_category_id;
      END IF;

      -- Insert Transaction
      -- SACRED LEDGER FIX: Remove currency_original from INSERT
      -- The enforce_sacred_ledger_currency trigger will automatically derive it from v_account_id
      INSERT INTO transactions (
        user_id,
        date,
        amount_original,
        amount_home, -- Placeholder, calculate_amount_home trigger will recalculate
        -- currency_original REMOVED - trigger enforces it from account
        exchange_rate,
        description,
        notes,
        account_id,
        category_id
      ) VALUES (
        p_user_id,
        v_date,
        v_amount,
        v_amount * v_exchange_rate, -- Placeholder value
        -- v_currency_code REMOVED - no longer used
        v_exchange_rate,
        v_description,
        v_notes,
        v_account_id,
        v_category_id
      );

      v_success_count := v_success_count + 1;

    EXCEPTION WHEN OTHERS THEN
      v_error_count := v_error_count + 1;
      v_errors := array_append(v_errors, 'Row ' || v_row_index || ': ' || SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', v_success_count,
    'failed', v_error_count,
    'errors', v_errors
  );
END;
$$;


ALTER FUNCTION "public"."import_transactions"("p_user_id" "uuid", "p_transactions" "jsonb", "p_default_account_color" "text", "p_default_category_color" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."import_transactions"("p_user_id" "uuid", "p_transactions" "jsonb", "p_default_account_color" "text", "p_default_category_color" "text") IS 'SACRED LEDGER: Import transactions from CSV with automatic account/category creation. Currency is derived from account_id via trigger, ensuring transactions always match their account currency.';



CREATE OR REPLACE FUNCTION "public"."promote_inbox_item"("p_inbox_id" "uuid", "p_account_id" "uuid", "p_category_id" "uuid", "p_final_description" "text" DEFAULT NULL::"text", "p_final_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_final_amount" numeric DEFAULT NULL::numeric) RETURNS json
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


ALTER FUNCTION "public"."promote_inbox_item"("p_inbox_id" "uuid", "p_account_id" "uuid", "p_category_id" "uuid", "p_final_description" "text", "p_final_date" timestamp with time zone, "p_final_amount" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."promote_inbox_item"("p_inbox_id" "uuid", "p_account_id" "uuid", "p_category_id" "uuid", "p_final_description" "text", "p_final_date" timestamp with time zone, "p_final_amount" numeric) IS 'FULL MIRROR + HARD-GATE VALIDATION + SACRED LEDGER: Validates all required fields (account_id, category_id, amount, description, date) and transfers notes and source_text directly from inbox to ledger. Stores inbox_id as birth certificate for permanent audit trail. Currency is automatically derived from p_account_id via enforce_sacred_ledger_currency trigger.';



CREATE OR REPLACE FUNCTION "public"."promote_inbox_item"("p_inbox_id" "uuid", "p_account_id" "uuid", "p_category_id" "uuid", "p_final_description" "text" DEFAULT NULL::"text", "p_final_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_final_amount" numeric DEFAULT NULL::numeric, "p_exchange_rate" numeric DEFAULT NULL::numeric) RETURNS json
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
    -- EXPLICIT STATE COMMITMENT: Exchange rate priority: UI parameter > inbox record > 1.0
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
        COALESCE(p_exchange_rate, v_inbox_record.exchange_rate, 1.0),
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


ALTER FUNCTION "public"."promote_inbox_item"("p_inbox_id" "uuid", "p_account_id" "uuid", "p_category_id" "uuid", "p_final_description" "text", "p_final_date" timestamp with time zone, "p_final_amount" numeric, "p_exchange_rate" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."promote_inbox_item"("p_inbox_id" "uuid", "p_account_id" "uuid", "p_category_id" "uuid", "p_final_description" "text", "p_final_date" timestamp with time zone, "p_final_amount" numeric, "p_exchange_rate" numeric) IS 'FULL MIRROR + HARD-GATE VALIDATION + SACRED LEDGER + EXPLICIT STATE COMMITMENT: Validates all required fields (account_id, category_id, amount, description, date) and transfers notes, source_text, and exchange_rate directly from UI state to ledger. Stores inbox_id as birth certificate for permanent audit trail. Currency is automatically derived from p_account_id via enforce_sacred_ledger_currency trigger. Exchange rate priority: explicit p_exchange_rate parameter (UI source of truth) > inbox record (fallback) > 1.0 (same-currency default).';



CREATE OR REPLACE FUNCTION "public"."reconcile_account_balance"("p_account_id" "uuid", "p_new_balance" numeric, "p_date" timestamp with time zone DEFAULT "now"()) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_current_balance numeric;
    v_delta numeric;
    v_txn_id uuid;
    v_account_currency text;
    v_user_id uuid;
BEGIN
    -- 1. Get current state
    SELECT current_balance, currency_code, user_id 
    INTO v_current_balance, v_account_currency, v_user_id
    FROM bank_accounts 
    WHERE id = p_account_id;

    -- 2. Calculate the difference
    v_delta := p_new_balance - v_current_balance;

    -- 3. If no change, do nothing
    IF v_delta = 0 THEN
        RETURN NULL;
    END IF;

    -- 4. Create the Adjustment Transaction
    INSERT INTO transactions (
        user_id,
        account_id,
        date,
        description,
        amount_original,
        currency_original,
        amount_home,
        category_id -- NULL, or a specific "Adjustment" system category
    ) VALUES (
        v_user_id,
        p_account_id,
        p_date,
        'Manual Balance Reconciliation',
        v_delta,
        v_account_currency,
        v_delta,
        NULL -- No category implies Transfer/Adjustment in many systems
    ) RETURNING id INTO v_txn_id;

    RETURN v_txn_id;
END;
$$;


ALTER FUNCTION "public"."reconcile_account_balance"("p_account_id" "uuid", "p_new_balance" numeric, "p_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replace_account_currency"("p_account_id" "uuid", "p_old_currency_code" character varying, "p_new_currency_code" character varying) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Verify user owns this account (security check)
  IF NOT EXISTS (
    SELECT 1 FROM bank_accounts
    WHERE id = p_account_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Account not found or access denied';
  END IF;

  -- Update account's currency_code
  -- All transactions automatically reflect new currency via JOIN (normalized architecture)
  UPDATE bank_accounts
  SET currency_code = p_new_currency_code
  WHERE id = p_account_id
    AND currency_code = p_old_currency_code;

  -- REMOVED: Transaction update logic
  -- Previously updated transactions.currency_original, which is now deleted
  -- Currency is now automatically derived from account via JOIN
  -- All transactions instantly reflect new currency without explicit UPDATE
END;
$$;


ALTER FUNCTION "public"."replace_account_currency"("p_account_id" "uuid", "p_old_currency_code" character varying, "p_new_currency_code" character varying) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."replace_account_currency"("p_account_id" "uuid", "p_old_currency_code" character varying, "p_new_currency_code" character varying) IS 'Updates account currency. All transactions automatically reflect new currency via account_id join (normalized architecture).';



CREATE OR REPLACE FUNCTION "public"."sync_category_type_hierarchy"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Scenario A: Parent type changed - cascade to all children
    -- Only triggers if: (1) It's an UPDATE, (2) type actually changed, (3) it's a parent (no parent_id)
    IF TG_OP = 'UPDATE'
       AND NEW.type != OLD.type
       AND NEW.parent_id IS NULL THEN

        UPDATE categories
        SET type = NEW.type,
            updated_at = NOW()
        WHERE parent_id = NEW.id
          AND user_id = NEW.user_id;

        RAISE NOTICE 'Cascaded type change from parent % to % children', NEW.id, NEW.type;
    END IF;

    -- Scenario B: New child inserted - inherit parent's type
    -- Only triggers if: (1) It's an INSERT, (2) it has a parent_id
    IF TG_OP = 'INSERT'
       AND NEW.parent_id IS NOT NULL THEN

        NEW.type := (SELECT type FROM categories WHERE id = NEW.parent_id);

        RAISE NOTICE 'Child % inherited type % from parent %', NEW.id, NEW.type, NEW.parent_id;
    END IF;

    -- Scenario C: Child moved to different parent - adopt new parent's type
    -- Only triggers if: (1) It's an UPDATE, (2) it has a parent_id, (3) parent_id changed or newly assigned
    IF TG_OP = 'UPDATE'
       AND NEW.parent_id IS NOT NULL
       AND (OLD.parent_id IS NULL OR NEW.parent_id != OLD.parent_id) THEN

        NEW.type := (SELECT type FROM categories WHERE id = NEW.parent_id);

        RAISE NOTICE 'Child % adopted type % from new parent %', NEW.id, NEW.type, NEW.parent_id;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_category_type_hierarchy"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_child_category_color"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- If this is a child category (has a parent_id)
    IF NEW.parent_id IS NOT NULL THEN
        -- Get the parent's color and assign it to this category
        SELECT color INTO NEW.color
        FROM categories
        WHERE id = NEW.parent_id;
        
        -- Safety check: if parent doesn't have a color, use default gray
        IF NEW.color IS NULL OR NEW.color = '' THEN
            NEW.color := '#808080';
        END IF;
    END IF;
    
    -- If this is a top-level category without a color, assign default gray
    IF NEW.parent_id IS NULL AND (NEW.color IS NULL OR NEW.color = '') THEN
        NEW.color := '#808080';
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_child_category_color"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_account_balance_ledger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Handle DELETES (Subtract old amount in account's native currency)
    IF (TG_OP = 'DELETE') THEN
        UPDATE bank_accounts
        SET current_balance = current_balance - OLD.amount_original  -- FIXED: was amount_home
        WHERE id = OLD.account_id;
        RETURN OLD;

    -- Handle INSERTS (Add new amount in account's native currency)
    ELSIF (TG_OP = 'INSERT') THEN
        UPDATE bank_accounts
        SET current_balance = current_balance + NEW.amount_original  -- FIXED: was amount_home
        WHERE id = NEW.account_id;
        RETURN NEW;

    -- Handle UPDATES (Subtract old, Add new in account's native currency)
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Only update if the amount or account changed
        IF (OLD.amount_original <> NEW.amount_original) OR (OLD.account_id <> NEW.account_id) THEN  -- FIXED: was amount_home
            -- Revert old impact
            UPDATE bank_accounts
            SET current_balance = current_balance - OLD.amount_original  -- FIXED: was amount_home
            WHERE id = OLD.account_id;

            -- Apply new impact
            UPDATE bank_accounts
            SET current_balance = current_balance + NEW.amount_original  -- FIXED: was amount_home
            WHERE id = NEW.account_id;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_account_balance_ledger"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_account_balance_ledger"() IS 'Maintains bank_accounts.current_balance as ledger of transactions in ACCOUNT NATIVE CURRENCY. Uses amount_original (not amount_home) to ensure balances reflect actual account currency amounts. Part of Zero Redundancy architecture where One Account = One Currency.';



CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_category_hierarchy_func"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    parent_category RECORD;
    transaction_count INTEGER;
BEGIN
    -- Check 1: Self-Parenting Prevention
    IF NEW.parent_id = NEW.id THEN
        RAISE EXCEPTION 'A category cannot be its own parent';
    END IF;

    -- Check 2: Parent Must Exist
    -- (Handled by FK constraint, but we can add explicit check if parent_id is not null)
    IF NEW.parent_id IS NOT NULL THEN
        PERFORM 1 FROM categories WHERE id = NEW.parent_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Parent category does not exist';
        END IF;
    END IF;

    -- Check 3: Two-Level Hierarchy Enforcement
    IF NEW.parent_id IS NOT NULL THEN
        SELECT * INTO parent_category FROM categories WHERE id = NEW.parent_id;
        IF parent_category.parent_id IS NOT NULL THEN
            RAISE EXCEPTION 'Cannot create subcategory under another subcategory. Maximum 2 levels allowed.';
        END IF;
    END IF;

    -- Check 4: Promotion Prevention (Subcategory -> Parent)
    -- Only check on UPDATE operations when changing from subcategory to parent
    IF TG_OP = 'UPDATE' AND OLD.parent_id IS NOT NULL AND NEW.parent_id IS NULL THEN
        -- Check if it has transactions
        SELECT COUNT(*) INTO transaction_count FROM transactions WHERE category_id = NEW.id;
        IF transaction_count > 0 THEN
            RAISE EXCEPTION 'Cannot convert to parent category while it has transactions';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_category_hierarchy_func"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."account_balance_currency_fix_backup" (
    "account_id" "uuid",
    "user_id" "uuid",
    "account_name" "text",
    "account_currency" "text",
    "old_balance" numeric,
    "calculated_balance" numeric,
    "discrepancy" numeric,
    "transaction_count" bigint,
    "backed_up_at" timestamp with time zone
);


ALTER TABLE "public"."account_balance_currency_fix_backup" OWNER TO "postgres";


COMMENT ON TABLE "public"."account_balance_currency_fix_backup" IS 'Backup of account balances before currency bug fix (2025-12-29). Contains old_balance (incorrect), calculated_balance (correct), and discrepancy. Safe to drop 30 days after migration success.';



CREATE TABLE IF NOT EXISTS "public"."bank_accounts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "color" "text" DEFAULT '#3b82f6'::"text" NOT NULL,
    "is_visible" boolean DEFAULT true NOT NULL,
    "currency_code" "text" DEFAULT 'USD'::"text" NOT NULL,
    "group_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "public"."account_type" DEFAULT 'checking'::"public"."account_type" NOT NULL,
    "current_balance" numeric DEFAULT 0 NOT NULL,
    CONSTRAINT "valid_color_format" CHECK (("color" ~ '^#[0-9A-Fa-f]{6}$'::"text"))
);


ALTER TABLE "public"."bank_accounts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."bank_accounts"."color" IS 'Hex color code for visual identification of the account (e.g., #3b82f6)';



CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "color" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parent_id" "uuid",
    "type" "public"."transaction_type" DEFAULT 'expense'::"public"."transaction_type" NOT NULL
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text",
    "amount_original" numeric(20,4) NOT NULL,
    "exchange_rate" numeric(15,6) DEFAULT 1.0 NOT NULL,
    "amount_home" numeric(20,4) DEFAULT 0 NOT NULL,
    "transfer_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text",
    "source_text" "text",
    "inbox_id" "uuid"
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


COMMENT ON TABLE "public"."transactions" IS 'Normalized transactions table. Currency is ALWAYS derived from bank_accounts.currency_code via account_id. Type is determined implicitly: transfer (transfer_id NOT NULL), opening balance (category_id NULL and transfer_id NULL), or standard (category_id NOT NULL).';



COMMENT ON COLUMN "public"."transactions"."amount_home" IS 'SYSTEM-MANAGED FIELD: Automatically calculated by calculate_amount_home trigger as (amount_original * exchange_rate). The DEFAULT value (0) is ALWAYS overwritten before INSERT completes. Frontend should NOT send this field - it will be ignored.';



COMMENT ON COLUMN "public"."transactions"."notes" IS 'Optional notes or memo for the transaction';



COMMENT ON COLUMN "public"."transactions"."source_text" IS 'Raw source context (OCR, bank import data, etc.) transferred from inbox. Separate from user notes field.';



COMMENT ON COLUMN "public"."transactions"."inbox_id" IS 'Tracks which inbox item this transaction was promoted from. Null for transactions created directly in the ledger.';



CREATE OR REPLACE VIEW "public"."categories_with_counts" WITH ("security_invoker"='true') AS
 SELECT "c"."id",
    "c"."name",
    "c"."type",
    "c"."parent_id",
    "count"("t"."id") AS "transaction_count"
   FROM ("public"."categories" "c"
     LEFT JOIN "public"."transactions" "t" ON (("c"."id" = "t"."category_id")))
  GROUP BY "c"."id", "c"."name", "c"."type", "c"."parent_id";


ALTER VIEW "public"."categories_with_counts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."global_currencies" (
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "symbol" "text" NOT NULL,
    "flag" "text"
);


ALTER TABLE "public"."global_currencies" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."parent_categories_with_counts" WITH ("security_invoker"='true') AS
 SELECT "p"."id",
    "p"."name",
    "p"."color",
    "p"."type",
    "p"."user_id",
    "p"."created_at",
    "p"."updated_at",
    "p"."parent_id",
    COALESCE("sum"("t_count"."transaction_count"), (0)::numeric) AS "transaction_count"
   FROM (("public"."categories" "p"
     LEFT JOIN "public"."categories" "c" ON (("c"."parent_id" = "p"."id")))
     LEFT JOIN ( SELECT "transactions"."category_id",
            "count"(*) AS "transaction_count"
           FROM "public"."transactions"
          GROUP BY "transactions"."category_id") "t_count" ON (("c"."id" = "t_count"."category_id")))
  WHERE ("p"."parent_id" IS NULL)
  GROUP BY "p"."id", "p"."name", "p"."color", "p"."type", "p"."user_id", "p"."created_at", "p"."updated_at", "p"."parent_id";


ALTER VIEW "public"."parent_categories_with_counts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transaction_inbox" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount_original" numeric,
    "description" "text",
    "date" timestamp with time zone DEFAULT "now"(),
    "source_text" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "account_id" "uuid",
    "category_id" "uuid",
    "exchange_rate" numeric DEFAULT 1.0,
    "notes" "text"
);


ALTER TABLE "public"."transaction_inbox" OWNER TO "postgres";


COMMENT ON TABLE "public"."transaction_inbox" IS 'Normalized inbox table (scratchpad for unprocessed transactions). Currency is derived from bank_accounts.currency_code via account_id (NULL if no account selected). Status values: pending, processed.';



COMMENT ON COLUMN "public"."transaction_inbox"."amount_original" IS 'Transaction amount - nullable to support partial drafts in scratchpad mode';



COMMENT ON COLUMN "public"."transaction_inbox"."description" IS 'Transaction description - nullable to support partial drafts in scratchpad mode';



COMMENT ON COLUMN "public"."transaction_inbox"."notes" IS 'Optional notes or memo for the inbox item. Transferred to transaction.notes during promotion.';



CREATE OR REPLACE VIEW "public"."transaction_inbox_view" WITH ("security_invoker"='true') AS
 SELECT "i"."id",
    "i"."user_id",
    "i"."amount_original",
    "i"."description",
    "i"."date",
    "i"."source_text",
    "i"."status",
    "i"."account_id",
    "i"."category_id",
    "i"."exchange_rate",
    "i"."notes",
    "i"."created_at",
    "i"."updated_at",
    "a"."name" AS "account_name",
    "a"."currency_code" AS "currency_original",
    "a"."color" AS "account_color",
    "c"."name" AS "category_name",
    "c"."color" AS "category_color",
    "c"."type" AS "category_type"
   FROM (("public"."transaction_inbox" "i"
     LEFT JOIN "public"."bank_accounts" "a" ON (("i"."account_id" = "a"."id")))
     LEFT JOIN "public"."categories" "c" ON (("i"."category_id" = "c"."id")));


ALTER VIEW "public"."transaction_inbox_view" OWNER TO "postgres";


COMMENT ON VIEW "public"."transaction_inbox_view" IS 'Denormalized inbox view with account/category details. currency_original is ALIASED from bank_accounts.currency_code (NULL if no account assigned). Normalized architecture - no redundant storage.';



CREATE OR REPLACE VIEW "public"."transactions_view" WITH ("security_invoker"='true') AS
 SELECT "t"."id",
    "t"."user_id",
    "t"."account_id",
    "t"."category_id",
    "t"."description",
    "t"."amount_original",
    "t"."amount_home",
    "t"."exchange_rate",
    "t"."date",
    "t"."notes",
    "t"."source_text",
    "t"."inbox_id",
    "t"."transfer_id",
    "t"."created_at",
    "t"."updated_at",
    "a"."name" AS "account_name",
    "a"."currency_code" AS "currency_original",
    "a"."currency_code" AS "account_currency",
    "a"."color" AS "account_color",
    "c"."name" AS "category_name",
    "c"."color" AS "category_color",
    "c"."type" AS "category_type"
   FROM (("public"."transactions" "t"
     LEFT JOIN "public"."bank_accounts" "a" ON (("t"."account_id" = "a"."id")))
     LEFT JOIN "public"."categories" "c" ON (("t"."category_id" = "c"."id")));


ALTER VIEW "public"."transactions_view" OWNER TO "postgres";


COMMENT ON VIEW "public"."transactions_view" IS 'Denormalized view with account/category details. currency_original is ALIASED from bank_accounts.currency_code (normalized architecture - no redundant storage).';



CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "user_id" "uuid" NOT NULL,
    "theme" "text" DEFAULT 'system'::"text",
    "start_of_week" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "main_currency" "text" DEFAULT 'USD'::"text",
    CONSTRAINT "user_settings_start_of_week_check" CHECK ((("start_of_week" >= 0) AND ("start_of_week" <= 6))),
    CONSTRAINT "user_settings_theme_check" CHECK (("theme" = ANY (ARRAY['light'::"text", 'dark'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."user_settings" OWNER TO "postgres";


ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."global_currencies"
    ADD CONSTRAINT "global_currencies_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."transaction_inbox"
    ADD CONSTRAINT "transaction_inbox_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "unique_user_account_currency" UNIQUE ("user_id", "name", "currency_code");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id");



CREATE INDEX "idx_accounts_group_id" ON "public"."bank_accounts" USING "btree" ("group_id");



CREATE INDEX "idx_backup_account_id" ON "public"."account_balance_currency_fix_backup" USING "btree" ("account_id");



CREATE INDEX "idx_bank_accounts_user_id" ON "public"."bank_accounts" USING "btree" ("user_id");



CREATE INDEX "idx_categories_parent_id" ON "public"."categories" USING "btree" ("parent_id");



CREATE INDEX "idx_categories_user_id" ON "public"."categories" USING "btree" ("user_id");



CREATE INDEX "idx_inbox_ready" ON "public"."transaction_inbox" USING "btree" ("user_id") WHERE (("account_id" IS NOT NULL) AND ("category_id" IS NOT NULL));



CREATE INDEX "idx_inbox_user_status" ON "public"."transaction_inbox" USING "btree" ("user_id", "status");



CREATE INDEX "idx_transactions_account_id" ON "public"."transactions" USING "btree" ("account_id");



CREATE INDEX "idx_transactions_category" ON "public"."transactions" USING "btree" ("category_id");



CREATE INDEX "idx_transactions_category_id" ON "public"."transactions" USING "btree" ("category_id");



CREATE INDEX "idx_transactions_date" ON "public"."transactions" USING "btree" ("date");



CREATE INDEX "idx_transactions_inbox_id" ON "public"."transactions" USING "btree" ("inbox_id") WHERE ("inbox_id" IS NOT NULL);



CREATE INDEX "idx_transactions_transfer_id" ON "public"."transactions" USING "btree" ("transfer_id");



CREATE INDEX "idx_transactions_user_date" ON "public"."transactions" USING "btree" ("user_id", "date" DESC);



CREATE INDEX "idx_transactions_user_id" ON "public"."transactions" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "before_transaction_insert_or_update" BEFORE INSERT OR UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_amount_home"();



CREATE OR REPLACE TRIGGER "set_amount_home" BEFORE INSERT OR UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_amount_home"();



CREATE OR REPLACE TRIGGER "trg_check_transactions_only_subcategories" BEFORE INSERT OR UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."check_transaction_category_hierarchy"();



CREATE OR REPLACE TRIGGER "trg_sync_category_type_hierarchy" BEFORE INSERT OR UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."sync_category_type_hierarchy"();



CREATE OR REPLACE TRIGGER "trg_update_account_balance" AFTER INSERT OR DELETE OR UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_account_balance_ledger"();



CREATE OR REPLACE TRIGGER "trg_validate_category_hierarchy" BEFORE INSERT OR UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."validate_category_hierarchy_func"();



CREATE OR REPLACE TRIGGER "trigger_cascade_color_to_children" AFTER UPDATE OF "color" ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."cascade_color_to_children"();



CREATE OR REPLACE TRIGGER "trigger_sync_child_category_color" BEFORE INSERT OR UPDATE OF "parent_id" ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."sync_child_category_color"();



CREATE OR REPLACE TRIGGER "update_bank_accounts_updated_at" BEFORE UPDATE ON "public"."bank_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_categories_updated_at" BEFORE UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_transactions_updated_at" BEFORE UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_settings_updated_at" BEFORE UPDATE ON "public"."user_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "public"."global_currencies"("code");



ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "fk_transactions_inbox" FOREIGN KEY ("inbox_id") REFERENCES "public"."transaction_inbox"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transaction_inbox"
    ADD CONSTRAINT "transaction_inbox_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."bank_accounts"("id");



ALTER TABLE ONLY "public"."transaction_inbox"
    ADD CONSTRAINT "transaction_inbox_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."transaction_inbox"
    ADD CONSTRAINT "transaction_inbox_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_main_currency_fkey" FOREIGN KEY ("main_currency") REFERENCES "public"."global_currencies"("code");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Public read access" ON "public"."global_currencies" FOR SELECT USING (true);



CREATE POLICY "Users can delete their own bank accounts" ON "public"."bank_accounts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own categories" ON "public"."categories" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own transactions" ON "public"."transactions" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own bank accounts" ON "public"."bank_accounts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own categories" ON "public"."categories" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own settings" ON "public"."user_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own transactions" ON "public"."transactions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can only access their own inbox items" ON "public"."transaction_inbox" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own bank accounts" ON "public"."bank_accounts" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own categories" ON "public"."categories" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own settings" ON "public"."user_settings" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own transactions" ON "public"."transactions" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own bank accounts" ON "public"."bank_accounts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own categories" ON "public"."categories" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own settings" ON "public"."user_settings" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own transactions" ON "public"."transactions" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."bank_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."global_currencies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transaction_inbox" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_amount_home"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_amount_home"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_amount_home"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cascade_color_to_children"() TO "anon";
GRANT ALL ON FUNCTION "public"."cascade_color_to_children"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cascade_color_to_children"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_transaction_category_hierarchy"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_transaction_category_hierarchy"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_transaction_category_hierarchy"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_orphaned_categories"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_orphaned_categories"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_orphaned_categories"() TO "service_role";



GRANT ALL ON FUNCTION "public"."clear_user_data"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."clear_user_data"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."clear_user_data"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_account"("p_account_name" "text", "p_account_color" "text", "p_currency_code" "text", "p_starting_balance" numeric, "p_account_type" "public"."account_type") TO "anon";
GRANT ALL ON FUNCTION "public"."create_account"("p_account_name" "text", "p_account_color" "text", "p_currency_code" "text", "p_starting_balance" numeric, "p_account_type" "public"."account_type") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_account"("p_account_name" "text", "p_account_color" "text", "p_currency_code" "text", "p_starting_balance" numeric, "p_account_type" "public"."account_type") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_account_group"("p_user_id" "uuid", "p_name" "text", "p_color" "text", "p_type" "public"."account_type", "p_currencies" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."create_account_group"("p_user_id" "uuid", "p_name" "text", "p_color" "text", "p_type" "public"."account_type", "p_currencies" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_account_group"("p_user_id" "uuid", "p_name" "text", "p_color" "text", "p_type" "public"."account_type", "p_currencies" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_transfer"("p_user_id" "uuid", "p_from_account_id" "uuid", "p_to_account_id" "uuid", "p_amount_cents" bigint, "p_amount_received_cents" bigint, "p_exchange_rate" numeric, "p_date" timestamp with time zone, "p_description" "text", "p_category_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_transfer"("p_user_id" "uuid", "p_from_account_id" "uuid", "p_to_account_id" "uuid", "p_amount_cents" bigint, "p_amount_received_cents" bigint, "p_exchange_rate" numeric, "p_date" timestamp with time zone, "p_description" "text", "p_category_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_transfer"("p_user_id" "uuid", "p_from_account_id" "uuid", "p_to_account_id" "uuid", "p_amount_cents" bigint, "p_amount_received_cents" bigint, "p_exchange_rate" numeric, "p_date" timestamp with time zone, "p_description" "text", "p_category_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_transfer"("p_user_id" "uuid", "p_transfer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_transfer"("p_user_id" "uuid", "p_transfer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_transfer"("p_user_id" "uuid", "p_transfer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_monthly_spending_by_category"("p_months_back" integer, "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_spending_by_category"("p_months_back" integer, "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_spending_by_category"("p_months_back" integer, "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_monthly_spending_by_category"("p_user_id" "uuid", "p_months_back" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_spending_by_category"("p_user_id" "uuid", "p_months_back" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_spending_by_category"("p_user_id" "uuid", "p_months_back" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."import_transactions"("p_user_id" "uuid", "p_transactions" "jsonb", "p_default_account_color" "text", "p_default_category_color" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."import_transactions"("p_user_id" "uuid", "p_transactions" "jsonb", "p_default_account_color" "text", "p_default_category_color" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."import_transactions"("p_user_id" "uuid", "p_transactions" "jsonb", "p_default_account_color" "text", "p_default_category_color" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."promote_inbox_item"("p_inbox_id" "uuid", "p_account_id" "uuid", "p_category_id" "uuid", "p_final_description" "text", "p_final_date" timestamp with time zone, "p_final_amount" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."promote_inbox_item"("p_inbox_id" "uuid", "p_account_id" "uuid", "p_category_id" "uuid", "p_final_description" "text", "p_final_date" timestamp with time zone, "p_final_amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."promote_inbox_item"("p_inbox_id" "uuid", "p_account_id" "uuid", "p_category_id" "uuid", "p_final_description" "text", "p_final_date" timestamp with time zone, "p_final_amount" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."promote_inbox_item"("p_inbox_id" "uuid", "p_account_id" "uuid", "p_category_id" "uuid", "p_final_description" "text", "p_final_date" timestamp with time zone, "p_final_amount" numeric, "p_exchange_rate" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."promote_inbox_item"("p_inbox_id" "uuid", "p_account_id" "uuid", "p_category_id" "uuid", "p_final_description" "text", "p_final_date" timestamp with time zone, "p_final_amount" numeric, "p_exchange_rate" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."promote_inbox_item"("p_inbox_id" "uuid", "p_account_id" "uuid", "p_category_id" "uuid", "p_final_description" "text", "p_final_date" timestamp with time zone, "p_final_amount" numeric, "p_exchange_rate" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."reconcile_account_balance"("p_account_id" "uuid", "p_new_balance" numeric, "p_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."reconcile_account_balance"("p_account_id" "uuid", "p_new_balance" numeric, "p_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reconcile_account_balance"("p_account_id" "uuid", "p_new_balance" numeric, "p_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."replace_account_currency"("p_account_id" "uuid", "p_old_currency_code" character varying, "p_new_currency_code" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."replace_account_currency"("p_account_id" "uuid", "p_old_currency_code" character varying, "p_new_currency_code" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."replace_account_currency"("p_account_id" "uuid", "p_old_currency_code" character varying, "p_new_currency_code" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_category_type_hierarchy"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_category_type_hierarchy"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_category_type_hierarchy"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_child_category_color"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_child_category_color"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_child_category_color"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_account_balance_ledger"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_account_balance_ledger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_account_balance_ledger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_category_hierarchy_func"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_category_hierarchy_func"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_category_hierarchy_func"() TO "service_role";



GRANT ALL ON TABLE "public"."account_balance_currency_fix_backup" TO "anon";
GRANT ALL ON TABLE "public"."account_balance_currency_fix_backup" TO "authenticated";
GRANT ALL ON TABLE "public"."account_balance_currency_fix_backup" TO "service_role";



GRANT ALL ON TABLE "public"."bank_accounts" TO "anon";
GRANT ALL ON TABLE "public"."bank_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."bank_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON TABLE "public"."categories_with_counts" TO "anon";
GRANT ALL ON TABLE "public"."categories_with_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."categories_with_counts" TO "service_role";



GRANT ALL ON TABLE "public"."global_currencies" TO "anon";
GRANT ALL ON TABLE "public"."global_currencies" TO "authenticated";
GRANT ALL ON TABLE "public"."global_currencies" TO "service_role";



GRANT ALL ON TABLE "public"."parent_categories_with_counts" TO "anon";
GRANT ALL ON TABLE "public"."parent_categories_with_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."parent_categories_with_counts" TO "service_role";



GRANT ALL ON TABLE "public"."transaction_inbox" TO "anon";
GRANT ALL ON TABLE "public"."transaction_inbox" TO "authenticated";
GRANT ALL ON TABLE "public"."transaction_inbox" TO "service_role";



GRANT ALL ON TABLE "public"."transaction_inbox_view" TO "anon";
GRANT ALL ON TABLE "public"."transaction_inbox_view" TO "authenticated";
GRANT ALL ON TABLE "public"."transaction_inbox_view" TO "service_role";



GRANT ALL ON TABLE "public"."transactions_view" TO "anon";
GRANT ALL ON TABLE "public"."transactions_view" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions_view" TO "service_role";



GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







