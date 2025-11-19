-- Manual migration script to apply only the color-related changes
-- Run this in Supabase SQL Editor if supabase db push fails

-- =============================================================================
-- MIGRATION 1: Add color column to bank_accounts
-- =============================================================================

-- Step 1: Add color column (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_accounts' AND column_name = 'color'
  ) THEN
    ALTER TABLE bank_accounts ADD COLUMN color TEXT;

    -- Set default color for all existing accounts
    UPDATE bank_accounts SET color = '#3b82f6' WHERE color IS NULL;

    -- Make color NOT NULL with default value
    ALTER TABLE bank_accounts
      ALTER COLUMN color SET DEFAULT '#3b82f6',
      ALTER COLUMN color SET NOT NULL;

    -- Add check constraint to ensure color is a valid hex color
    ALTER TABLE bank_accounts
      ADD CONSTRAINT valid_color_format CHECK (color ~ '^#[0-9A-Fa-f]{6}$');

    -- Add comment for documentation
    COMMENT ON COLUMN bank_accounts.color IS 'Hex color code for visual identification of the account (e.g., #3b82f6)';

    RAISE NOTICE 'Successfully added color column to bank_accounts';
  ELSE
    RAISE NOTICE 'Color column already exists in bank_accounts';
  END IF;
END $$;

-- =============================================================================
-- MIGRATION 2: Update create_account_with_currencies function with color
-- =============================================================================

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

-- =============================================================================
-- Verification
-- =============================================================================

-- Verify the color column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_accounts' AND column_name = 'color'
  ) THEN
    RAISE NOTICE '✓ Color column exists in bank_accounts table';
  ELSE
    RAISE WARNING '✗ Color column NOT found in bank_accounts table';
  END IF;
END $$;

-- Verify the function signature
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'create_account_with_currencies'
    AND pg_get_function_arguments(p.oid) LIKE '%p_account_color%'
  ) THEN
    RAISE NOTICE '✓ create_account_with_currencies function updated with color parameter';
  ELSE
    RAISE WARNING '✗ create_account_with_currencies function NOT updated';
  END IF;
END $$;
