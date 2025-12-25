-- ============================================================================
-- MIGRATION: Fix Broken SQL Functions (Remove account_currencies/currencies refs)
--
-- Purpose: Remove references to deleted account_currencies and currencies tables
-- Architecture: Migrated to "flat" schema (one currency per account row, grouped by group_id)
-- Date: 2025-12-25
-- ============================================================================

-- ============================================================================
-- 1. DROP ORPHANED TRIGGER FUNCTION
-- ============================================================================

DROP FUNCTION IF EXISTS public.update_account_currencies_updated_at();

-- ============================================================================
-- 2. FIX clear_user_data - Remove deleted table references
-- ============================================================================

CREATE OR REPLACE FUNCTION public.clear_user_data(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Delete all transactions for the user
  DELETE FROM transactions WHERE user_id = p_user_id;

  -- Delete all categories for the user
  DELETE FROM categories WHERE user_id = p_user_id;

  -- Delete all bank accounts for the user
  -- (No need to delete account_currencies or currencies - tables don't exist)
  DELETE FROM bank_accounts WHERE user_id = p_user_id;
END;
$$;

-- ============================================================================
-- 3. FIX replace_account_currency - Update account row instead of junction table
-- ============================================================================

CREATE OR REPLACE FUNCTION public.replace_account_currency(
  p_account_id uuid,
  p_old_currency_code varchar,
  p_new_currency_code varchar
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
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

  -- Update the account's currency_code
  UPDATE bank_accounts
  SET currency_code = p_new_currency_code
  WHERE id = p_account_id
    AND currency_code = p_old_currency_code;

  -- Update all transactions with matching currency
  UPDATE transactions
  SET currency_original = p_new_currency_code
  WHERE account_id = p_account_id
    AND currency_original = p_old_currency_code;
END;
$$;

-- ============================================================================
-- 4. FIX import_transactions - Add currency_code to account creation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.import_transactions(
  p_user_id uuid,
  p_transactions jsonb,
  p_default_account_color text,
  p_default_category_color text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

      -- 1. Handle Account - Create with currency_code if doesn't exist
      SELECT id INTO v_account_id FROM bank_accounts
      WHERE user_id = p_user_id AND lower(name) = lower(v_account_name);

      IF v_account_id IS NULL THEN
        -- FIXED: Added currency_code to account creation
        INSERT INTO bank_accounts (user_id, name, color, currency_code)
        VALUES (p_user_id, v_account_name, p_default_account_color, v_currency_code)
        RETURNING id INTO v_account_id;
      END IF;

      -- REMOVED: Lines that inserted into account_currencies table
      -- REMOVED: Lines that inserted into currencies table

      -- 2. Handle Category
      SELECT id INTO v_category_id FROM categories
      WHERE user_id = p_user_id AND lower(name) = lower(v_category_name);

      IF v_category_id IS NULL THEN
        INSERT INTO categories (user_id, name, color, is_default)
        VALUES (p_user_id, v_category_name, p_default_category_color, false)
        RETURNING id INTO v_category_id;
      END IF;

      -- 3. Insert Transaction
      INSERT INTO transactions (
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
      ) VALUES (
        p_user_id,
        v_date,
        v_amount,
        v_amount * v_exchange_rate,
        v_currency_code,
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

-- ============================================================================
-- 5. RENAME AND REPLACE create_account_with_currencies → create_account
-- ============================================================================

-- First, drop the old function if it exists
DROP FUNCTION IF EXISTS public.create_account_with_currencies(text, text, jsonb);

-- Create new simplified version
CREATE OR REPLACE FUNCTION public.create_account(
  p_account_name text,
  p_account_color text,
  p_currency_code text,
  p_starting_balance numeric DEFAULT 0,
  p_account_type account_type DEFAULT 'checking'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_account_id uuid;
  v_user_id uuid;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();

  -- Create the Bank Account with currency
  INSERT INTO bank_accounts (user_id, name, color, currency_code, type)
  VALUES (v_user_id, p_account_name, p_account_color, p_currency_code, p_account_type)
  RETURNING id INTO v_account_id;

  -- Handle Opening Balance (if non-zero)
  -- Opening balances have category_id = NULL and transfer_id = NULL
  IF p_starting_balance <> 0 THEN
    INSERT INTO transactions (
      user_id,
      account_id,
      category_id,       -- NULL indicates structural event (opening balance)
      transfer_id,       -- NULL (not a transfer)
      currency_original,
      amount_original,
      amount_home,
      exchange_rate,
      date,
      description
    ) VALUES (
      v_user_id,
      v_account_id,
      NULL,              -- Opening balance has no category
      NULL,              -- Opening balance has no transfer
      p_currency_code,
      p_starting_balance,
      p_starting_balance,
      1.0,
      CURRENT_DATE,
      'Opening Balance'
    );
  END IF;

  -- Return the new account data
  RETURN jsonb_build_object(
    'id', v_account_id,
    'name', p_account_name,
    'color', p_account_color,
    'currency_code', p_currency_code,
    'type', p_account_type
  );
END;
$$;

-- ============================================================================
-- GRANT PERMISSIONS (match existing pattern)
-- ============================================================================

ALTER FUNCTION public.clear_user_data(uuid) OWNER TO postgres;
GRANT ALL ON FUNCTION public.clear_user_data(uuid) TO anon;
GRANT ALL ON FUNCTION public.clear_user_data(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.clear_user_data(uuid) TO service_role;

ALTER FUNCTION public.replace_account_currency(uuid, varchar, varchar) OWNER TO postgres;
GRANT ALL ON FUNCTION public.replace_account_currency(uuid, varchar, varchar) TO anon;
GRANT ALL ON FUNCTION public.replace_account_currency(uuid, varchar, varchar) TO authenticated;
GRANT ALL ON FUNCTION public.replace_account_currency(uuid, varchar, varchar) TO service_role;

ALTER FUNCTION public.import_transactions(uuid, jsonb, text, text) OWNER TO postgres;
GRANT ALL ON FUNCTION public.import_transactions(uuid, jsonb, text, text) TO anon;
GRANT ALL ON FUNCTION public.import_transactions(uuid, jsonb, text, text) TO authenticated;
GRANT ALL ON FUNCTION public.import_transactions(uuid, jsonb, text, text) TO service_role;

ALTER FUNCTION public.create_account(text, text, text, numeric, account_type) OWNER TO postgres;
GRANT ALL ON FUNCTION public.create_account(text, text, text, numeric, account_type) TO anon;
GRANT ALL ON FUNCTION public.create_account(text, text, text, numeric, account_type) TO authenticated;
GRANT ALL ON FUNCTION public.create_account(text, text, text, numeric, account_type) TO service_role;
