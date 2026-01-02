-- ============================================================================
-- MIGRATION: Fix Parent Category Trap in import_transactions
-- Purpose: Add hierarchy-aware category resolution to prevent trigger violations
-- Date: 2026-01-01
-- ============================================================================
-- This migration implements the "Invisible Grouping" pattern for data imports:
-- 1. Parent category matches → redirect to "{Parent} > General" subcategory
-- 2. New categories → create under "Uncategorized" parent
-- 3. Leaf/orphaned matches → use directly
--
-- Key fixes:
-- - Remove non-existent is_default column references
-- - Use atomic upserts (INSERT ... ON CONFLICT) for concurrency safety
-- - Omit color/type in subcategory INSERTs (let triggers inherit from parent)
-- - Store original category name in source_text for audit trail
-- ============================================================================

-- Drop the old function signature to avoid conflicts
DROP FUNCTION IF EXISTS public.import_transactions(uuid, jsonb, text, text);

CREATE OR REPLACE FUNCTION public.import_transactions(
  p_user_id uuid,
  p_transactions jsonb,
  p_default_account_color text,
  p_default_category_color text,
  p_general_label text DEFAULT 'General',           -- NEW: i18n support
  p_uncategorized_label text DEFAULT 'Uncategorized' -- NEW: i18n support
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

  -- NEW: Hierarchy-aware category variables
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

      -- Validate required fields
      IF v_date IS NULL THEN RAISE EXCEPTION 'Date is required'; END IF;
      IF v_amount IS NULL THEN RAISE EXCEPTION 'Amount is required'; END IF;
      IF v_account_name IS NULL OR v_account_name = '' THEN RAISE EXCEPTION 'Account is required'; END IF;
      IF v_description IS NULL OR v_description = '' THEN RAISE EXCEPTION 'Description is required'; END IF;
      IF v_category_name IS NULL OR v_category_name = '' THEN RAISE EXCEPTION 'Category is required'; END IF;
      IF v_currency_code IS NULL OR v_currency_code = '' THEN RAISE EXCEPTION 'Currency is required'; END IF;

      -- ====================================================================
      -- ACCOUNT HANDLING (unchanged from previous version)
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

      -- Step 1: Lookup category by name and check if it has children
      SELECT id, parent_id INTO v_category_id, v_parent_id
      FROM categories
      WHERE user_id = p_user_id AND lower(name) = lower(v_category_name);

      IF v_category_id IS NOT NULL THEN
        -- Category exists - check if it's a parent with children
        IF v_parent_id IS NULL THEN
          -- Top-level category - check for children
          SELECT EXISTS(
            SELECT 1 FROM categories WHERE parent_id = v_category_id
          ) INTO v_is_parent;

          IF v_is_parent THEN
            -- ============================================================
            -- SCENARIO 1: Parent category with children
            -- Redirect to "General" (or p_general_label) subcategory
            -- ============================================================

            -- Atomic upsert: handle concurrent imports creating same subcategory
            INSERT INTO categories (user_id, name, parent_id)
            VALUES (p_user_id, p_general_label, v_category_id)
            ON CONFLICT (user_id, name, parent_id) DO NOTHING
            RETURNING id INTO v_general_id;

            -- If conflict occurred, re-query to get existing ID
            IF v_general_id IS NULL THEN
              SELECT id INTO v_general_id
              FROM categories
              WHERE user_id = p_user_id
                AND parent_id = v_category_id
                AND lower(name) = lower(p_general_label);
            END IF;

            -- Use the General subcategory for transaction
            v_category_id := v_general_id;

            -- Note: color and type are inherited from parent via triggers:
            -- - sync_child_category_color
            -- - sync_category_type_hierarchy
          END IF;
          -- ELSE: Orphaned parent (no children) - use directly as leaf
        END IF;
        -- ELSE: Regular leaf category (has parent_id) - use directly

      ELSE
        -- ================================================================
        -- SCENARIO 2: Category doesn't exist
        -- Create under "Uncategorized" parent
        -- ================================================================

        -- Find or create "Uncategorized" parent category for this user
        -- Atomic upsert for parent creation (OK to specify color/type for parents)
        INSERT INTO categories (user_id, name, color, parent_id, type)
        VALUES (p_user_id, p_uncategorized_label, '#6B7280', NULL, 'expense')
        ON CONFLICT (user_id, name, parent_id) DO NOTHING
        RETURNING id INTO v_uncategorized_parent_id;

        -- If conflict occurred, re-query
        IF v_uncategorized_parent_id IS NULL THEN
          SELECT id INTO v_uncategorized_parent_id
          FROM categories
          WHERE user_id = p_user_id
            AND lower(name) = lower(p_uncategorized_label)
            AND parent_id IS NULL;
        END IF;

        -- Create new category as child of Uncategorized
        -- CRITICAL: OMIT color and type - let triggers inherit from parent
        INSERT INTO categories (user_id, name, parent_id)
        VALUES (p_user_id, v_category_name, v_uncategorized_parent_id)
        ON CONFLICT (user_id, name, parent_id) DO NOTHING
        RETURNING id INTO v_category_id;

        -- If conflict occurred, re-query
        IF v_category_id IS NULL THEN
          SELECT id INTO v_category_id
          FROM categories
          WHERE user_id = p_user_id
            AND lower(name) = lower(v_category_name)
            AND parent_id = v_uncategorized_parent_id;
        END IF;
      END IF;

      -- ====================================================================
      -- INSERT TRANSACTION
      -- ====================================================================
      -- SACRED LEDGER: currency_original removed - derived from account_id via trigger
      -- AUDIT TRAIL: source_text stores original category name from import
      INSERT INTO transactions (
        user_id,
        date,
        amount_original,
        amount_home,           -- Placeholder, calculate_amount_home trigger recalculates
        exchange_rate,
        description,
        notes,
        account_id,
        category_id,
        source_text            -- NEW: Store original category for audit trail
      ) VALUES (
        p_user_id,
        v_date,
        v_amount,
        v_amount * v_exchange_rate,  -- Placeholder
        v_exchange_rate,
        v_description,
        v_notes,
        v_account_id,
        v_category_id,            -- Now guaranteed to be a valid leaf category
        v_category_name           -- Original category from import file
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
-- PERMISSIONS (maintain existing access pattern)
-- ============================================================================
ALTER FUNCTION public.import_transactions(uuid, jsonb, text, text, text, text) OWNER TO postgres;
GRANT ALL ON FUNCTION public.import_transactions(uuid, jsonb, text, text, text, text) TO anon;
GRANT ALL ON FUNCTION public.import_transactions(uuid, jsonb, text, text, text, text) TO authenticated;
GRANT ALL ON FUNCTION public.import_transactions(uuid, jsonb, text, text, text, text) TO service_role;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================
COMMENT ON FUNCTION public.import_transactions(uuid, jsonb, text, text, text, text) IS
'SACRED LEDGER: Import transactions from CSV with automatic account/category creation.

Hierarchy-aware category handling prevents parent category trap:
  - Parent category matches → redirect to "{Parent} > General" subcategory (auto-created)
  - Unknown categories → create under "Uncategorized" parent (auto-created per user)
  - Leaf categories and orphaned parents → use directly

Features:
  - Atomic upserts (ON CONFLICT) prevent concurrent import race conditions
  - Trigger inheritance: subcategories auto-inherit type/color from parent
  - Audit trail: original category name stored in source_text column
  - i18n support: p_general_label and p_uncategorized_label are parameterized

Currency derived from account_id via trigger, ensuring transactions match account currency.';
