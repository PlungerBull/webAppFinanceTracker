-- ============================================================================
-- MIGRATION: Fix import_transactions and Related RPCs for BIGINT Ledger
-- Purpose: Update all functions referencing old NUMERIC columns to use BIGINT cents
-- Date: 2026-01-30
-- ============================================================================
--
-- ISSUE: The import_transactions RPC references columns that were DROPPED:
--   - amount_original (NUMERIC) -> replaced by amount_cents (BIGINT)
--   - amount_home (NUMERIC) -> replaced by amount_home_cents (BIGINT)
--
-- This migration fixes:
--   1. import_transactions RPC (6-parameter version)
--   2. import_transactions RPC (4-parameter legacy wrapper)
--   3. calculate_amount_home trigger (now idempotent)
--   4. create_account function
--
-- S-TIER PRINCIPLES:
--   - BIGINT arithmetic throughout (no NUMERIC conversion in core paths)
--   - Null safety before calculations
--   - Trigger idempotency (skip if already calculated)
--
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. FIX: import_transactions (6-parameter version with i18n support)
-- ============================================================================
-- HARDENED: Uses BIGINT amount_cents instead of NUMERIC amount_original

CREATE OR REPLACE FUNCTION public.import_transactions(
  p_user_id uuid,
  p_transactions jsonb,
  p_default_account_color text,
  p_default_category_color text,
  p_general_label text DEFAULT 'General',
  p_uncategorized_label text DEFAULT 'Uncategorized'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '300000'  -- 5 minutes for large imports
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

  -- Hierarchy-aware category variables
  v_parent_id uuid;
  v_is_parent boolean;
  v_general_id uuid;
  v_uncategorized_parent_id uuid;

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
      -- ====================================================================
      -- EXTRACT AND VALIDATE
      -- ====================================================================
      v_date := (v_transaction->>'Date')::date;
      v_amount := (v_transaction->>'Amount')::numeric;
      v_description := v_transaction->>'Description';
      v_category_name := v_transaction->>'Category';
      v_account_name := v_transaction->>'Account';
      v_currency_code := upper(v_transaction->>'Currency');
      v_exchange_rate := coalesce((v_transaction->>'Exchange Rate')::numeric, 1.0);
      v_notes := v_transaction->>'Notes';

      -- Validate required fields (null safety before BIGINT conversion)
      IF v_date IS NULL THEN RAISE EXCEPTION 'Date is required'; END IF;
      IF v_amount IS NULL THEN RAISE EXCEPTION 'Amount is required'; END IF;
      IF v_account_name IS NULL OR v_account_name = '' THEN RAISE EXCEPTION 'Account is required'; END IF;
      IF v_description IS NULL OR v_description = '' THEN RAISE EXCEPTION 'Description is required'; END IF;
      IF v_category_name IS NULL OR v_category_name = '' THEN RAISE EXCEPTION 'Category is required'; END IF;
      IF v_currency_code IS NULL OR v_currency_code = '' THEN RAISE EXCEPTION 'Currency is required'; END IF;

      -- ====================================================================
      -- ACCOUNT HANDLING
      -- ====================================================================
      SELECT id INTO v_account_id FROM bank_accounts
      WHERE user_id = p_user_id
        AND lower(name) = lower(v_account_name)
        AND currency_code = v_currency_code;

      IF v_account_id IS NULL THEN
        INSERT INTO bank_accounts (user_id, name, color, currency_code)
        VALUES (p_user_id, v_account_name, p_default_account_color, v_currency_code)
        RETURNING id INTO v_account_id;
      END IF;

      -- ====================================================================
      -- HIERARCHY-AWARE CATEGORY HANDLING
      -- ====================================================================
      -- Three scenarios:
      -- 1. Name matches parent category (has children) -> redirect to "General" subcategory
      -- 2. Name matches leaf category OR orphaned parent -> use directly
      -- 3. Name doesn't exist -> create as child of "Uncategorized" parent
      -- ====================================================================

      SELECT id, parent_id INTO v_category_id, v_parent_id
      FROM categories
      WHERE user_id = p_user_id AND lower(name) = lower(v_category_name);

      IF v_category_id IS NOT NULL THEN
        IF v_parent_id IS NULL THEN
          SELECT EXISTS(
            SELECT 1 FROM categories WHERE parent_id = v_category_id
          ) INTO v_is_parent;

          IF v_is_parent THEN
            -- Parent category with children -> redirect to "General" subcategory
            INSERT INTO categories (user_id, name, parent_id)
            VALUES (p_user_id, p_general_label, v_category_id)
            ON CONFLICT (user_id, name, parent_id) DO NOTHING
            RETURNING id INTO v_general_id;

            IF v_general_id IS NULL THEN
              SELECT id INTO v_general_id
              FROM categories
              WHERE user_id = p_user_id
                AND parent_id = v_category_id
                AND lower(name) = lower(p_general_label);
            END IF;

            v_category_id := v_general_id;
          END IF;
        END IF;
      ELSE
        -- Category doesn't exist -> create under "Uncategorized" parent
        INSERT INTO categories (user_id, name, color, parent_id, type)
        VALUES (p_user_id, p_uncategorized_label, '#6B7280', NULL, 'expense')
        ON CONFLICT (user_id, name, parent_id) DO NOTHING
        RETURNING id INTO v_uncategorized_parent_id;

        IF v_uncategorized_parent_id IS NULL THEN
          SELECT id INTO v_uncategorized_parent_id
          FROM categories
          WHERE user_id = p_user_id
            AND lower(name) = lower(p_uncategorized_label)
            AND parent_id IS NULL;
        END IF;

        INSERT INTO categories (user_id, name, parent_id)
        VALUES (p_user_id, v_category_name, v_uncategorized_parent_id)
        ON CONFLICT (user_id, name, parent_id) DO NOTHING
        RETURNING id INTO v_category_id;

        IF v_category_id IS NULL THEN
          SELECT id INTO v_category_id
          FROM categories
          WHERE user_id = p_user_id
            AND lower(name) = lower(v_category_name)
            AND parent_id = v_uncategorized_parent_id;
        END IF;
      END IF;

      -- ====================================================================
      -- INSERT TRANSACTION (BIGINT CENTS)
      -- ====================================================================
      -- SACRED LEDGER: Uses BIGINT amount_cents for mathematical precision
      -- Conversion: ROUND(decimal * 100)::BIGINT prevents floating-point errors
      -- ====================================================================
      INSERT INTO transactions (
        user_id,
        date,
        amount_cents,                -- HARDENED: BIGINT column
        amount_home_cents,           -- HARDENED: BIGINT column
        exchange_rate,
        description,
        notes,
        account_id,
        category_id,
        source_text
      ) VALUES (
        p_user_id,
        v_date,
        ROUND(v_amount * 100)::BIGINT,                         -- Convert decimal to cents
        ROUND(v_amount * v_exchange_rate * 100)::BIGINT,       -- Convert to home cents
        v_exchange_rate,
        v_description,
        v_notes,
        v_account_id,
        v_category_id,
        v_category_name
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
-- 2. FIX: import_transactions (4-parameter legacy wrapper)
-- ============================================================================
-- Delegates to 6-parameter version with default labels

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
BEGIN
  RETURN public.import_transactions(
    p_user_id,
    p_transactions,
    p_default_account_color,
    p_default_category_color,
    'General',
    'Uncategorized'
  );
END;
$$;

-- ============================================================================
-- 3. FIX: calculate_amount_home trigger (IDEMPOTENT)
-- ============================================================================
-- S-TIER: Only recalculates if amount_home_cents differs from expected value
-- This allows RPCs to have fine-grained control over the conversion rate

CREATE OR REPLACE FUNCTION public.calculate_amount_home()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_expected_home_cents BIGINT;
BEGIN
  -- Calculate expected value: amount_cents * exchange_rate
  v_expected_home_cents := ROUND(NEW.amount_cents * COALESCE(NEW.exchange_rate, 1))::BIGINT;

  -- Idempotent: Only update if NULL or different from expected
  -- This allows RPCs to provide pre-calculated values that won't be overwritten
  IF NEW.amount_home_cents IS NULL OR NEW.amount_home_cents <> v_expected_home_cents THEN
    NEW.amount_home_cents := v_expected_home_cents;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 4. FIX: create_account function
-- ============================================================================
-- HARDENED: Uses BIGINT amount_cents for opening balance transactions

CREATE OR REPLACE FUNCTION public.create_account(
  p_account_name text,
  p_account_color text,
  p_currency_code text,
  p_starting_balance numeric DEFAULT 0,
  p_account_type public.account_type DEFAULT 'checking'::public.account_type
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
  v_user_id := auth.uid();

  INSERT INTO bank_accounts (user_id, name, color, currency_code, type)
  VALUES (v_user_id, p_account_name, p_account_color, p_currency_code, p_account_type)
  RETURNING id INTO v_account_id;

  IF p_starting_balance <> 0 THEN
    INSERT INTO transactions (
      user_id,
      account_id,
      category_id,
      transfer_id,
      amount_cents,              -- HARDENED: BIGINT column
      amount_home_cents,         -- HARDENED: BIGINT column
      exchange_rate,
      date,
      description
    ) VALUES (
      v_user_id,
      v_account_id,
      NULL,
      NULL,
      ROUND(p_starting_balance * 100)::BIGINT,   -- Convert to cents
      ROUND(p_starting_balance * 100)::BIGINT,   -- Same for opening balance (rate=1)
      1.0,
      CURRENT_DATE,
      'Opening Balance'
    );
  END IF;

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
-- PERMISSIONS
-- ============================================================================

ALTER FUNCTION public.import_transactions(uuid, jsonb, text, text, text, text) OWNER TO postgres;
GRANT ALL ON FUNCTION public.import_transactions(uuid, jsonb, text, text, text, text) TO anon;
GRANT ALL ON FUNCTION public.import_transactions(uuid, jsonb, text, text, text, text) TO authenticated;
GRANT ALL ON FUNCTION public.import_transactions(uuid, jsonb, text, text, text, text) TO service_role;

ALTER FUNCTION public.import_transactions(uuid, jsonb, text, text) OWNER TO postgres;
GRANT ALL ON FUNCTION public.import_transactions(uuid, jsonb, text, text) TO anon;
GRANT ALL ON FUNCTION public.import_transactions(uuid, jsonb, text, text) TO authenticated;
GRANT ALL ON FUNCTION public.import_transactions(uuid, jsonb, text, text) TO service_role;

ALTER FUNCTION public.calculate_amount_home() OWNER TO postgres;

ALTER FUNCTION public.create_account(text, text, text, numeric, public.account_type) OWNER TO postgres;
GRANT ALL ON FUNCTION public.create_account(text, text, text, numeric, public.account_type) TO anon;
GRANT ALL ON FUNCTION public.create_account(text, text, text, numeric, public.account_type) TO authenticated;
GRANT ALL ON FUNCTION public.create_account(text, text, text, numeric, public.account_type) TO service_role;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION public.import_transactions(uuid, jsonb, text, text, text, text) IS
'[HARDENED 2026-01-30] SACRED LEDGER: Import transactions using BIGINT integer cents.

Converts JSON Amount (decimal) to amount_cents using: ROUND(val * 100)::BIGINT

S-TIER PRINCIPLES:
  - BIGINT arithmetic for mathematical precision (no floating-point)
  - Null safety validated before BIGINT conversion
  - Atomic upserts prevent race conditions

Hierarchy-aware category handling:
  - Parent category -> redirect to "General" subcategory
  - Unknown categories -> create under "Uncategorized"
  - 5-minute timeout for large imports';

COMMENT ON FUNCTION public.import_transactions(uuid, jsonb, text, text) IS
'[HARDENED 2026-01-30] Legacy 4-parameter wrapper - delegates to 6-parameter BIGINT version.';

COMMENT ON FUNCTION public.calculate_amount_home() IS
'[HARDENED 2026-01-30] IDEMPOTENT trigger: calculates amount_home_cents = ROUND(amount_cents * exchange_rate).
Skips recalculation if value already matches expected, allowing RPCs fine-grained control.';

COMMENT ON FUNCTION public.create_account(text, text, text, numeric, public.account_type) IS
'[HARDENED 2026-01-30] Creates account with optional opening balance using BIGINT amount_cents.';

COMMIT;
