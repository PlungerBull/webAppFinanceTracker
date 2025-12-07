-- Drop the old function to avoid ambiguity (signature match based on database.types.ts inference)
-- We use broader types (text instead of uuid) just in case, or we rely on explicit CREATE OR REPLACE with new signature
DROP FUNCTION IF EXISTS create_transfer(numeric, text, text, date, text, numeric, text, text, text);
-- Also try dropping with UUIDs if they were UUIDs
DROP FUNCTION IF EXISTS create_transfer(numeric, uuid, text, date, text, numeric, uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION create_transfer(
  p_user_id uuid,
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,           -- Sent Amount
  p_amount_received numeric,  -- Received Amount
  p_from_currency text,
  p_to_currency text,
  p_exchange_rate numeric,
  p_date date,
  p_description text,
  p_category_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
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
    exchange_rate -- Store implied rate or 1? Standard practice is 1 if it's the 'source' relative to itself, 
                  -- but triggers might expect rate to HOME currency. 
                  -- We'll pass 1.0 assuming the trigger handles home currency rate lookup if needed,
                  -- or preserves it.
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
    'Transfer In: ' || p_exchange_rate::text, -- Useful info in note
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
