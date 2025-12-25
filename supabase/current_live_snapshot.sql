


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




ALTER SCHEMA "public" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






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
begin
  -- Delete all transactions for the user
  delete from transactions where user_id = p_user_id;
  
  -- Delete all categories for the user
  delete from categories where user_id = p_user_id;
  
  -- Delete account currencies (child of bank_accounts)
  delete from account_currencies 
  where account_id in (select id from bank_accounts where user_id = p_user_id);

  -- Delete all bank accounts for the user
  delete from bank_accounts where user_id = p_user_id;
  
  -- Delete all currencies for the user
  delete from currencies where user_id = p_user_id;
end;
$$;


ALTER FUNCTION "public"."clear_user_data"("p_user_id" "uuid") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."create_account_with_currencies"("p_account_name" "text", "p_account_color" "text", "p_currencies" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_account_id uuid;
  v_currency jsonb;
  v_user_id uuid;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- A. Create the Bank Account
  INSERT INTO bank_accounts (user_id, name, color)
  VALUES (v_user_id, p_account_name, p_account_color)
  RETURNING id INTO v_account_id;

  -- B. Loop through currencies
  FOR v_currency IN SELECT * FROM jsonb_array_elements(p_currencies)
  LOOP
    -- 1. Link currency to account (No starting_balance column anymore)
    INSERT INTO account_currencies (account_id, currency_code)
    VALUES (v_account_id, v_currency->>'code');

    -- 2. Handle Opening Balance (Event Sourcing: Create a Transaction)
    IF (v_currency->>'starting_balance')::numeric IS NOT NULL AND (v_currency->>'starting_balance')::numeric <> 0 THEN
      INSERT INTO transactions (
        user_id,
        account_id,
        category_id,       -- NULL (It's a structural system event)
        currency_original,
        amount_original,
        amount_home,       -- Default 1:1, trigger will adjust if needed
        exchange_rate,
        date,
        description,
        type               -- The new 'opening_balance' flag
      )
      VALUES (
        v_user_id,
        v_account_id,
        NULL,
        v_currency->>'code',
        (v_currency->>'starting_balance')::numeric,
        (v_currency->>'starting_balance')::numeric, 
        1.0,
        CURRENT_DATE,
        'Opening Balance',
        'opening_balance'
      );
    END IF;
  END LOOP;

  -- Return the new account data
  RETURN jsonb_build_object(
    'id', v_account_id,
    'name', p_account_name,
    'color', p_account_color
  );
END;
$$;


ALTER FUNCTION "public"."create_account_with_currencies"("p_account_name" "text", "p_account_color" "text", "p_currencies" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_transfer"("p_user_id" "uuid", "p_from_account_id" "uuid", "p_to_account_id" "uuid", "p_amount" numeric, "p_from_currency" "text", "p_to_currency" "text", "p_amount_received" numeric, "p_exchange_rate" numeric, "p_date" timestamp with time zone, "p_description" "text", "p_category_id" "uuid") RETURNS json
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
    -p_amount, -- Negative for leaving
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
    p_amount_received, -- Positive for entering
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


ALTER FUNCTION "public"."create_transfer"("p_user_id" "uuid", "p_from_account_id" "uuid", "p_to_account_id" "uuid", "p_amount" numeric, "p_from_currency" "text", "p_to_currency" "text", "p_amount_received" numeric, "p_exchange_rate" numeric, "p_date" timestamp with time zone, "p_description" "text", "p_category_id" "uuid") OWNER TO "postgres";


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
declare
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
begin
  -- Iterate through each transaction in the JSON array
  for v_transaction in select * from jsonb_array_elements(p_transactions)
  loop
    v_row_index := v_row_index + 1;
    
    begin
      -- Extract values
      v_date := (v_transaction->>'Date')::date;
      v_amount := (v_transaction->>'Amount')::numeric;
      v_description := v_transaction->>'Description';
      v_category_name := v_transaction->>'Category';
      v_account_name := v_transaction->>'Account';
      v_currency_code := upper(v_transaction->>'Currency'); -- No fallback, required
      v_exchange_rate := coalesce((v_transaction->>'Exchange Rate')::numeric, 1.0);
      v_notes := v_transaction->>'Notes';

      -- Validate required fields
      if v_date is null then raise exception 'Date is required'; end if;
      if v_amount is null then raise exception 'Amount is required'; end if;
      if v_account_name is null or v_account_name = '' then raise exception 'Account is required'; end if;
      if v_description is null or v_description = '' then raise exception 'Description is required'; end if;
      if v_category_name is null or v_category_name = '' then raise exception 'Category is required'; end if;
      if v_currency_code is null or v_currency_code = '' then raise exception 'Currency is required'; end if;

      -- 1. Handle Account
      select id into v_account_id from bank_accounts 
      where user_id = p_user_id and lower(name) = lower(v_account_name);
      
      if v_account_id is null then
        insert into bank_accounts (user_id, name, color)
        values (p_user_id, v_account_name, p_default_account_color)
        returning id into v_account_id;
      end if;

      -- 1b. Handle Account Currency (Crucial Update)
      -- Ensure the account has this currency associated with it
      insert into account_currencies (account_id, currency_code, starting_balance)
      values (v_account_id, v_currency_code, 0)
      on conflict (account_id, currency_code) do nothing;

      -- 2. Handle Category
      select id into v_category_id from categories
      where user_id = p_user_id and lower(name) = lower(v_category_name);
      
      if v_category_id is null then
        insert into categories (user_id, name, color, is_default)
        values (p_user_id, v_category_name, p_default_category_color, false)
        returning id into v_category_id;
      end if;

      -- 3. Handle Currency (Ensure it exists in currencies table)
      if not exists (select 1 from currencies where user_id = p_user_id and code = v_currency_code) then
        insert into currencies (user_id, code, is_main)
        values (p_user_id, v_currency_code, false)
        on conflict (user_id, code) do nothing;
      end if;

      -- 4. Insert Transaction
      insert into transactions (
        user_id,
        date,
        amount_original,
        amount_home,
        currency_original,
        exchange_rate,
        description,
        notes,
        account_id,
        category_id
      ) values (
        p_user_id,
        v_date,
        v_amount,
        v_amount * v_exchange_rate, -- Simplified home amount calc
        v_currency_code,
        v_exchange_rate,
        v_description,
        v_notes,
        v_account_id,
        v_category_id
      );

      v_success_count := v_success_count + 1;

    exception when others then
      v_error_count := v_error_count + 1;
      v_errors := array_append(v_errors, 'Row ' || v_row_index || ': ' || SQLERRM);
    end;
  end loop;

  return jsonb_build_object(
    'success', v_success_count,
    'failed', v_error_count,
    'errors', v_errors
  );
end;
$$;


ALTER FUNCTION "public"."import_transactions"("p_user_id" "uuid", "p_transactions" "jsonb", "p_default_account_color" "text", "p_default_category_color" "text") OWNER TO "postgres";


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

    -- 2. Determine final values (Use override if provided, else use inbox value)
    v_amount_to_use := COALESCE(p_final_amount, v_inbox_record.amount);
    v_desc_to_use := COALESCE(p_final_description, v_inbox_record.description);
    v_date_to_use := COALESCE(p_final_date, v_inbox_record.date);

    -- 3. INSERT into the Main Ledger (This triggers the Balance Update automatically)
    INSERT INTO transactions (
        user_id,
        account_id,
        category_id,
        date,
        description,
        amount_original,
        currency_original,
        amount_home, -- Triggers usually calculate this, but we insert raw for now
        exchange_rate
    ) VALUES (
        v_inbox_record.user_id,
        p_account_id,
        p_category_id,
        v_date_to_use,
        v_desc_to_use,
        v_amount_to_use,
        v_inbox_record.currency,
        v_amount_to_use, -- Assuming 1:1 for now, or you trigger 'calculate_amount_home'
        1.0
    ) RETURNING id INTO v_new_transaction_id;

    -- 4. DELETE from Inbox
    DELETE FROM transaction_inbox WHERE id = p_inbox_id;

    RETURN json_build_object('success', true, 'transaction_id', v_new_transaction_id);
END;
$$;


ALTER FUNCTION "public"."promote_inbox_item"("p_inbox_id" "uuid", "p_account_id" "uuid", "p_category_id" "uuid", "p_final_description" "text", "p_final_date" timestamp with time zone, "p_final_amount" numeric) OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."replace_account_currency"("p_account_id" "uuid", "p_old_currency_code" character varying, "p_new_currency_code" character varying, "p_new_starting_balance" numeric) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Verify the user owns this account (RLS will also enforce this)
  IF NOT EXISTS (
    SELECT 1 FROM bank_accounts 
    WHERE id = p_account_id 
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Account not found or access denied';
  END IF;

  -- Update account_currencies
  UPDATE account_currencies
  SET 
    currency_code = p_new_currency_code,
    starting_balance = p_new_starting_balance
  WHERE account_id = p_account_id 
    AND currency_code = p_old_currency_code;

  -- Update all transactions with matching currency
  UPDATE transactions
  SET currency_original = p_new_currency_code
  WHERE account_id = p_account_id 
    AND currency_original = p_old_currency_code;
END;
$$;


ALTER FUNCTION "public"."replace_account_currency"("p_account_id" "uuid", "p_old_currency_code" character varying, "p_new_currency_code" character varying, "p_new_starting_balance" numeric) OWNER TO "postgres";


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
    -- Handle DELETES (Subtract old amount)
    IF (TG_OP = 'DELETE') THEN
        UPDATE bank_accounts
        SET current_balance = current_balance - OLD.amount_home
        WHERE id = OLD.account_id;
        RETURN OLD;
    
    -- Handle INSERTS (Add new amount)
    ELSIF (TG_OP = 'INSERT') THEN
        UPDATE bank_accounts
        SET current_balance = current_balance + NEW.amount_home
        WHERE id = NEW.account_id;
        RETURN NEW;

    -- Handle UPDATES (Subtract old, Add new)
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Only update if the amount or account changed
        IF (OLD.amount_home <> NEW.amount_home) OR (OLD.account_id <> NEW.account_id) THEN
            -- Revert old impact
            UPDATE bank_accounts
            SET current_balance = current_balance - OLD.amount_home
            WHERE id = OLD.account_id;
            
            -- Apply new impact
            UPDATE bank_accounts
            SET current_balance = current_balance + NEW.amount_home
            WHERE id = NEW.account_id;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_account_balance_ledger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_account_currencies_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_account_currencies_updated_at"() OWNER TO "postgres";


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



CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text",
    "amount_original" numeric(20,4) NOT NULL,
    "currency_original" "text" NOT NULL,
    "exchange_rate" numeric(15,6) DEFAULT 1.0 NOT NULL,
    "amount_home" numeric(20,4) NOT NULL,
    "transfer_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text"
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


COMMENT ON TABLE "public"."transactions" IS 'Transactions table. Type is determined implicitly: transfer (transfer_id NOT NULL), opening balance (category_id NULL and transfer_id NULL), or standard (category_id NOT NULL with type from category).';



COMMENT ON COLUMN "public"."transactions"."notes" IS 'Optional notes or memo for the transaction';



CREATE OR REPLACE VIEW "public"."account_balances" WITH ("security_invoker"='true') AS
 SELECT "a"."id" AS "account_id",
    "a"."group_id",
    "a"."name",
    "a"."currency_code",
    "a"."type",
    COALESCE("sum"("t"."amount_original"), (0)::numeric) AS "current_balance"
   FROM ("public"."bank_accounts" "a"
     LEFT JOIN "public"."transactions" "t" ON (("a"."id" = "t"."account_id")))
  GROUP BY "a"."id", "a"."group_id", "a"."name", "a"."currency_code", "a"."type";


ALTER VIEW "public"."account_balances" OWNER TO "postgres";


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
    "amount" numeric NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "description" "text" NOT NULL,
    "date" timestamp with time zone DEFAULT "now"(),
    "source_text" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "account_id" "uuid",
    "category_id" "uuid",
    "exchange_rate" numeric DEFAULT 1.0
);


ALTER TABLE "public"."transaction_inbox" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."transactions_view" WITH ("security_invoker"='true') AS
 SELECT "t"."id",
    "t"."date",
    "t"."description",
    "t"."amount_original",
    "t"."amount_home",
    "t"."currency_original",
    "c"."name" AS "category_name",
    "c"."type" AS "category_type",
    "a"."name" AS "account_name",
    "a"."currency_code" AS "account_currency"
   FROM (("public"."transactions" "t"
     LEFT JOIN "public"."categories" "c" ON (("t"."category_id" = "c"."id")))
     LEFT JOIN "public"."bank_accounts" "a" ON (("t"."account_id" = "a"."id")));


ALTER VIEW "public"."transactions_view" OWNER TO "postgres";


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



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id");



CREATE INDEX "idx_accounts_group_id" ON "public"."bank_accounts" USING "btree" ("group_id");



CREATE INDEX "idx_bank_accounts_user_id" ON "public"."bank_accounts" USING "btree" ("user_id");



CREATE INDEX "idx_categories_parent_id" ON "public"."categories" USING "btree" ("parent_id");



CREATE INDEX "idx_categories_user_id" ON "public"."categories" USING "btree" ("user_id");



CREATE INDEX "idx_inbox_ready" ON "public"."transaction_inbox" USING "btree" ("user_id") WHERE (("account_id" IS NOT NULL) AND ("category_id" IS NOT NULL));



CREATE INDEX "idx_inbox_user_status" ON "public"."transaction_inbox" USING "btree" ("user_id", "status");



CREATE INDEX "idx_transactions_account_id" ON "public"."transactions" USING "btree" ("account_id");



CREATE INDEX "idx_transactions_category" ON "public"."transactions" USING "btree" ("category_id");



CREATE INDEX "idx_transactions_category_id" ON "public"."transactions" USING "btree" ("category_id");



CREATE INDEX "idx_transactions_date" ON "public"."transactions" USING "btree" ("date");



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
    ADD CONSTRAINT "fk_transactions_currency" FOREIGN KEY ("currency_original") REFERENCES "public"."global_currencies"("code");



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




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT ALL ON SCHEMA "public" TO PUBLIC;
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



GRANT ALL ON FUNCTION "public"."create_account_group"("p_user_id" "uuid", "p_name" "text", "p_color" "text", "p_type" "public"."account_type", "p_currencies" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."create_account_group"("p_user_id" "uuid", "p_name" "text", "p_color" "text", "p_type" "public"."account_type", "p_currencies" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_account_group"("p_user_id" "uuid", "p_name" "text", "p_color" "text", "p_type" "public"."account_type", "p_currencies" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_account_with_currencies"("p_account_name" "text", "p_account_color" "text", "p_currencies" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_account_with_currencies"("p_account_name" "text", "p_account_color" "text", "p_currencies" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_account_with_currencies"("p_account_name" "text", "p_account_color" "text", "p_currencies" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_transfer"("p_user_id" "uuid", "p_from_account_id" "uuid", "p_to_account_id" "uuid", "p_amount" numeric, "p_from_currency" "text", "p_to_currency" "text", "p_amount_received" numeric, "p_exchange_rate" numeric, "p_date" timestamp with time zone, "p_description" "text", "p_category_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_transfer"("p_user_id" "uuid", "p_from_account_id" "uuid", "p_to_account_id" "uuid", "p_amount" numeric, "p_from_currency" "text", "p_to_currency" "text", "p_amount_received" numeric, "p_exchange_rate" numeric, "p_date" timestamp with time zone, "p_description" "text", "p_category_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_transfer"("p_user_id" "uuid", "p_from_account_id" "uuid", "p_to_account_id" "uuid", "p_amount" numeric, "p_from_currency" "text", "p_to_currency" "text", "p_amount_received" numeric, "p_exchange_rate" numeric, "p_date" timestamp with time zone, "p_description" "text", "p_category_id" "uuid") TO "service_role";



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



GRANT ALL ON FUNCTION "public"."reconcile_account_balance"("p_account_id" "uuid", "p_new_balance" numeric, "p_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."reconcile_account_balance"("p_account_id" "uuid", "p_new_balance" numeric, "p_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reconcile_account_balance"("p_account_id" "uuid", "p_new_balance" numeric, "p_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."replace_account_currency"("p_account_id" "uuid", "p_old_currency_code" character varying, "p_new_currency_code" character varying, "p_new_starting_balance" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."replace_account_currency"("p_account_id" "uuid", "p_old_currency_code" character varying, "p_new_currency_code" character varying, "p_new_starting_balance" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."replace_account_currency"("p_account_id" "uuid", "p_old_currency_code" character varying, "p_new_currency_code" character varying, "p_new_starting_balance" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_category_type_hierarchy"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_category_type_hierarchy"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_category_type_hierarchy"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_child_category_color"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_child_category_color"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_child_category_color"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_account_balance_ledger"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_account_balance_ledger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_account_balance_ledger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_account_currencies_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_account_currencies_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_account_currencies_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_category_hierarchy_func"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_category_hierarchy_func"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_category_hierarchy_func"() TO "service_role";


















GRANT ALL ON TABLE "public"."bank_accounts" TO "anon";
GRANT ALL ON TABLE "public"."bank_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."bank_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON TABLE "public"."account_balances" TO "anon";
GRANT ALL ON TABLE "public"."account_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."account_balances" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



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




























