-- ============================================================================
-- MIGRATION: Fix create_transfer p_category_id to Allow NULL Default
-- Purpose: Mark p_category_id as DEFAULT NULL to eliminate type workaround in code
-- Date: 2026-01-16
-- CTO Mandate: "Do not keep quarantines in the codebase if we can cure the disease at the source"
-- ============================================================================

-- Drop the existing function first (required when changing parameter defaults)
DROP FUNCTION IF EXISTS "public"."create_transfer"(
  "uuid", "uuid", "uuid", numeric, numeric, numeric, timestamp with time zone, "text", "uuid"
);

-- Recreate with p_category_id DEFAULT NULL
-- This allows transfers to be created without a category (which is the common case)
CREATE OR REPLACE FUNCTION "public"."create_transfer"(
  "p_user_id" "uuid",
  "p_from_account_id" "uuid",
  "p_to_account_id" "uuid",
  "p_amount" numeric,
  "p_amount_received" numeric,
  "p_exchange_rate" numeric,
  "p_date" timestamp with time zone,
  "p_description" "text",
  "p_category_id" "uuid" DEFAULT NULL  -- CTO Fix: Allow NULL for transfers without category
) RETURNS json
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
  -- SACRED LEDGER FIX: Currency is derived from p_from_account_id via trigger
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
    p_category_id,  -- NULL is valid for transfers
    -p_amount,      -- Negative for leaving
    p_description,
    'Transfer Out',
    p_date,
    v_transfer_id,
    1.0
  ) RETURNING id INTO v_transaction_from_id;

  -- Create Inbound Transaction (Destination)
  -- SACRED LEDGER FIX: Currency is derived from p_to_account_id via trigger
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
    p_category_id,      -- NULL is valid for transfers
    p_amount_received,  -- Positive for entering
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

-- Set ownership
ALTER FUNCTION "public"."create_transfer"(
  "uuid", "uuid", "uuid", numeric, numeric, numeric, timestamp with time zone, "text", "uuid"
) OWNER TO "postgres";

-- Update comment
COMMENT ON FUNCTION "public"."create_transfer"(
  "uuid", "uuid", "uuid", numeric, numeric, numeric, timestamp with time zone, "text", "uuid"
) IS
'SACRED LEDGER: Creates a transfer between two accounts with linked transactions. Currency is automatically derived from each account via trigger. p_category_id defaults to NULL for transfers.';
