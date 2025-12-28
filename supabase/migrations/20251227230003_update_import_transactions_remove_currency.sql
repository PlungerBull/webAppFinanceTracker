-- ============================================================================
-- MIGRATION: Update import_transactions to Remove Currency (Trust Trigger)
-- Purpose: Remove explicit currency handling from import, let Sacred Ledger trigger enforce
-- Date: 2025-12-27
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

-- Grant permissions
ALTER FUNCTION public.import_transactions(uuid, jsonb, text, text) OWNER TO postgres;
GRANT ALL ON FUNCTION public.import_transactions(uuid, jsonb, text, text) TO anon;
GRANT ALL ON FUNCTION public.import_transactions(uuid, jsonb, text, text) TO authenticated;
GRANT ALL ON FUNCTION public.import_transactions(uuid, jsonb, text, text) TO service_role;

-- Update comment
COMMENT ON FUNCTION public.import_transactions IS
'SACRED LEDGER: Import transactions from CSV with automatic account/category creation. Currency is derived from account_id via trigger, ensuring transactions always match their account currency.';
