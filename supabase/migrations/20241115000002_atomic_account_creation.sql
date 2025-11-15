-- Migration: Atomic account creation with currencies
-- Purpose: Ensure account and its currencies are created together (all or nothing)
-- This prevents orphaned accounts without currencies

-- Create function to atomically create account with multiple currencies
CREATE OR REPLACE FUNCTION create_account_with_currencies(
  p_user_id UUID,
  p_account_name TEXT,
  p_currencies JSONB  -- Format: [{"code": "USD", "starting_balance": 1000}, {"code": "PEN", "starting_balance": 500}]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with definer's permissions
AS $$
DECLARE
  v_account_id UUID;
  v_currency RECORD;
  v_currency_count INTEGER := 0;
BEGIN
  -- Validation: Check user is authenticated
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID cannot be null';
  END IF;

  -- Validation: Check account name
  IF p_account_name IS NULL OR trim(p_account_name) = '' THEN
    RAISE EXCEPTION 'Account name cannot be empty';
  END IF;

  -- Validation: Check at least one currency provided
  IF jsonb_array_length(p_currencies) = 0 THEN
    RAISE EXCEPTION 'At least one currency must be provided';
  END IF;

  -- Step 1: Create the account
  INSERT INTO bank_accounts (user_id, name)
  VALUES (p_user_id, p_account_name)
  RETURNING id INTO v_account_id;

  -- Step 2: Insert all currencies atomically
  FOR v_currency IN 
    SELECT * FROM jsonb_to_recordset(p_currencies) 
    AS x(code TEXT, starting_balance NUMERIC)
  LOOP
    -- Validate currency code format
    IF v_currency.code IS NULL OR length(v_currency.code) != 3 THEN
      RAISE EXCEPTION 'Invalid currency code: %', v_currency.code;
    END IF;

    -- Insert currency for account
    INSERT INTO account_currencies (
      account_id, 
      currency_code, 
      starting_balance
    )
    VALUES (
      v_account_id, 
      upper(v_currency.code),  -- Ensure uppercase
      COALESCE(v_currency.starting_balance, 0)  -- Default to 0 if null
    );

    v_currency_count := v_currency_count + 1;
  END LOOP;

  -- Return success with account details
  RETURN json_build_object(
    'success', true,
    'account_id', v_account_id,
    'currencies_added', v_currency_count,
    'message', format('Account "%s" created with %s currency(ies)', p_account_name, v_currency_count)
  );

EXCEPTION
  WHEN OTHERS THEN
    -- If anything fails, the entire transaction rolls back
    RAISE EXCEPTION 'Failed to create account: %', SQLERRM;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION create_account_with_currencies(UUID, TEXT, JSONB) IS 
  'Atomically creates a bank account with multiple currencies. Either all succeed or all fail.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_account_with_currencies(UUID, TEXT, JSONB) TO authenticated;