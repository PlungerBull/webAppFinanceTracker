-- Migration: Update create_account_with_currencies to include color parameter
-- Purpose: Add color support to account creation function
-- Date: 2025-01-19

-- Drop old function signature
DROP FUNCTION IF EXISTS create_account_with_currencies(TEXT, JSONB);

-- Create new version with color parameter
CREATE OR REPLACE FUNCTION create_account_with_currencies(
  p_account_name TEXT,
  p_account_color TEXT,
  p_currencies JSONB  -- Format: [{"code": "USD", "starting_balance": 1000}, ...]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with elevated permissions but validates auth
AS $$
DECLARE
  v_user_id UUID;
  v_account_id UUID;
  v_currency RECORD;
  v_currency_count INTEGER := 0;
BEGIN
  -- Security: Get authenticated user ID (cannot be spoofed)
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Validation: Check account name
  IF p_account_name IS NULL OR trim(p_account_name) = '' THEN
    RAISE EXCEPTION 'Account name cannot be empty';
  END IF;

  -- Validation: Check color format (hex color)
  IF p_account_color IS NULL OR p_account_color !~ '^#[0-9A-Fa-f]{6}$' THEN
    RAISE EXCEPTION 'Invalid color format. Must be a hex color (e.g., #3b82f6)';
  END IF;

  -- Validation: Check at least one currency provided
  IF jsonb_array_length(p_currencies) = 0 THEN
    RAISE EXCEPTION 'At least one currency must be provided';
  END IF;

  -- Step 1: Create the account with color
  INSERT INTO bank_accounts (user_id, name, color)
  VALUES (v_user_id, trim(p_account_name), p_account_color)
  RETURNING id INTO v_account_id;

  -- Step 2: Insert all currencies atomically
  FOR v_currency IN
    SELECT * FROM jsonb_to_recordset(p_currencies)
    AS x(code TEXT, starting_balance NUMERIC)
  LOOP
    -- Validate currency code format
    IF v_currency.code IS NULL OR length(trim(v_currency.code)) != 3 THEN
      RAISE EXCEPTION 'Invalid currency code: %. Must be exactly 3 characters.', v_currency.code;
    END IF;

    -- Insert currency for account (uppercase and trimmed)
    INSERT INTO account_currencies (
      account_id,
      currency_code,
      starting_balance
    )
    VALUES (
      v_account_id,
      upper(trim(v_currency.code)),
      COALESCE(v_currency.starting_balance, 0)
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_account_with_currencies(TEXT, TEXT, JSONB) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION create_account_with_currencies(TEXT, TEXT, JSONB) IS
  'Atomically creates a bank account with color and multiple currencies. Uses auth.uid() internally for security. Either all operations succeed or all fail.';
