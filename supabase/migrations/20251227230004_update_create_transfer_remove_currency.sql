-- ============================================================================
-- MIGRATION: Update create_transfer to Remove Currency Parameters (Trust Trigger)
-- Purpose: Remove explicit currency handling from transfer creation, let Sacred Ledger trigger enforce
-- Date: 2025-12-27
-- ============================================================================

-- SACRED LEDGER FIX: Remove currency parameters from function signature
-- The trigger will automatically derive currency from each account_id
CREATE OR REPLACE FUNCTION "public"."create_transfer"(
  "p_user_id" "uuid",
  "p_from_account_id" "uuid",
  "p_to_account_id" "uuid",
  "p_amount" numeric,
  -- p_from_currency REMOVED - trigger derives from p_from_account_id
  -- p_to_currency REMOVED - trigger derives from p_to_account_id
  "p_amount_received" numeric,
  "p_exchange_rate" numeric,
  "p_date" timestamp with time zone,
  "p_description" "text",
  "p_category_id" "uuid"
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
  -- SACRED LEDGER FIX: Remove currency_original from INSERT
  -- The enforce_sacred_ledger_currency trigger will derive it from p_from_account_id
  INSERT INTO transactions (
    user_id,
    account_id,
    category_id,
    amount_original,
    -- currency_original REMOVED - trigger enforces from account
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
    -- p_from_currency REMOVED
    p_description,
    'Transfer Out',
    p_date,
    v_transfer_id,
    1.0
  ) RETURNING id INTO v_transaction_from_id;

  -- Create Inbound Transaction (Destination)
  -- SACRED LEDGER FIX: Remove currency_original from INSERT
  -- The enforce_sacred_ledger_currency trigger will derive it from p_to_account_id
  INSERT INTO transactions (
    user_id,
    account_id,
    category_id,
    amount_original,
    -- currency_original REMOVED - trigger enforces from account
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
    -- p_to_currency REMOVED
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

-- Update function ownership with new signature (currency parameters removed)
ALTER FUNCTION "public"."create_transfer"(
  "p_user_id" "uuid",
  "p_from_account_id" "uuid",
  "p_to_account_id" "uuid",
  "p_amount" numeric,
  "p_amount_received" numeric,
  "p_exchange_rate" numeric,
  "p_date" timestamp with time zone,
  "p_description" "text",
  "p_category_id" "uuid"
) OWNER TO "postgres";

-- Update comment
COMMENT ON FUNCTION "public"."create_transfer"(
  "uuid", "uuid", "uuid", numeric, numeric, numeric, timestamp with time zone, "text", "uuid"
) IS
'SACRED LEDGER: Creates a transfer between two accounts with linked transactions. Currency is automatically derived from each account via trigger, ensuring correctness.';
