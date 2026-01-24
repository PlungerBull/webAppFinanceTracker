-- Technical Debt: fix_transfer_null_params
-- Updates create_transfer RPC to allow NULL p_category_id (defaulting to NULL)
-- This fixes the issue where the repository was omitting it, causing RPC failures.

CREATE OR REPLACE FUNCTION "public"."create_transfer"(
  "p_user_id" "uuid",
  "p_from_account_id" "uuid",
  "p_to_account_id" "uuid",
  "p_amount" numeric,
  "p_amount_received" numeric,
  "p_exchange_rate" numeric,
  "p_date" timestamp with time zone,
  "p_description" "text",
  "p_category_id" "uuid" DEFAULT NULL::uuid  -- CHANGE: Added DEFAULT NULL
) RETURNS json
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_from_transaction_id uuid;
  v_to_transaction_id uuid;
  v_transfer_id uuid;
BEGIN
  -- Generate shared transfer ID
  v_transfer_id := gen_random_uuid();

  -- Debit Sender
  INSERT INTO transactions (
    user_id, account_id, category_id, date, amount_original, 
    exchange_rate, description, transfer_id
  ) VALUES (
    p_user_id, p_from_account_id, p_category_id, p_date, -p_amount,
    1.0, p_description, v_transfer_id
  ) RETURNING id INTO v_from_transaction_id;

  -- Credit Receiver
  INSERT INTO transactions (
    user_id, account_id, category_id, date, amount_original,
    exchange_rate, description, transfer_id
  ) VALUES (
    p_user_id, p_to_account_id, p_category_id, p_date, p_amount_received,
    p_exchange_rate, p_description, v_transfer_id
  ) RETURNING id INTO v_to_transaction_id;

  RETURN json_build_object(
    'transfer_id', v_transfer_id,
    'from_transaction_id', v_from_transaction_id,
    'to_transaction_id', v_to_transaction_id
  );
END;
$$;
