-- Migration: Add replace_account_currency function
-- Purpose: Atomically replace a currency in an account and update all related transactions
-- Created: 2025-01-16

-- Drop function if it exists (for idempotency)
DROP FUNCTION IF EXISTS replace_account_currency(UUID, TEXT, TEXT, NUMERIC);

-- Create function to replace currency in account and all transactions
CREATE OR REPLACE FUNCTION replace_account_currency(
  p_account_id UUID,
  p_old_currency_code TEXT,
  p_new_currency_code TEXT,
  p_new_starting_balance NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with elevated permissions but checks auth
AS $$
DECLARE
  v_user_id UUID;
  v_transactions_updated INTEGER;
BEGIN
  -- Security: Get authenticated user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Security: Verify user owns this account
  IF NOT EXISTS (
    SELECT 1 FROM bank_accounts 
    WHERE id = p_account_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Account not found or unauthorized';
  END IF;

  -- Normalize currency codes to uppercase
  p_old_currency_code := upper(trim(p_old_currency_code));
  p_new_currency_code := upper(trim(p_new_currency_code));

  -- Validate currency codes
  IF length(p_old_currency_code) != 3 OR length(p_new_currency_code) != 3 THEN
    RAISE EXCEPTION 'Currency codes must be exactly 3 characters';
  END IF;

  -- Step 1: Update all transactions with old currency to new currency
  UPDATE transactions
  SET currency_original = p_new_currency_code
  WHERE account_id = p_account_id 
    AND currency_original = p_old_currency_code
    AND user_id = v_user_id;

  GET DIAGNOSTICS v_transactions_updated = ROW_COUNT;

  -- Step 2: Update or create account_currency entry for new currency
  INSERT INTO account_currencies (account_id, currency_code, starting_balance)
  VALUES (p_account_id, p_new_currency_code, p_new_starting_balance)
  ON CONFLICT (account_id, currency_code)
  DO UPDATE SET 
    starting_balance = p_new_starting_balance,
    updated_at = NOW();

  -- Step 3: Delete old currency entry if different from new currency
  IF p_old_currency_code != p_new_currency_code THEN
    DELETE FROM account_currencies
    WHERE account_id = p_account_id 
      AND currency_code = p_old_currency_code;
  END IF;

  -- Log success
  RAISE NOTICE 'Currency replacement completed: % → % (% transactions updated)', 
    p_old_currency_code, p_new_currency_code, v_transactions_updated;

END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION replace_account_currency(UUID, TEXT, TEXT, NUMERIC) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION replace_account_currency(UUID, TEXT, TEXT, NUMERIC) IS 
  'Atomically replaces a currency in an account and updates all related transactions. Uses auth.uid() for security.';