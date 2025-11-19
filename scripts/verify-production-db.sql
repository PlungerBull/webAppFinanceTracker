-- Production Database Verification Script
-- Run this in your Supabase SQL Editor to verify critical database components

-- 1. Verify amount_home trigger exists
SELECT
  event_object_table as table_name,
  trigger_name,
  event_manipulation as event_type,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'transactions'
  AND trigger_name IN ('set_amount_home_on_insert', 'set_amount_home_on_update');

-- Expected output: 2 rows
-- - set_amount_home_on_insert (BEFORE INSERT)
-- - set_amount_home_on_update (BEFORE UPDATE)

-- 2. Verify calculate_amount_home function exists
SELECT
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_name = 'calculate_amount_home'
  AND routine_schema = 'public';

-- Expected output: 1 row with routine_type = 'FUNCTION'

-- 3. Test trigger is working (optional - creates test data)
-- Uncomment to run:
/*
DO $$
DECLARE
  test_user_id uuid;
  test_account_id uuid;
  test_currency text := 'USD';
  test_transaction_id uuid;
  calculated_amount numeric;
BEGIN
  -- Get a test user (use first available user)
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;

  IF test_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found for testing';
  END IF;

  -- Get a test account
  SELECT id INTO test_account_id
  FROM bank_accounts
  WHERE user_id = test_user_id
  LIMIT 1;

  IF test_account_id IS NULL THEN
    RAISE EXCEPTION 'No accounts found for testing user';
  END IF;

  -- Insert test transaction with amount_home = 0
  -- Trigger should override this with correct calculation
  INSERT INTO transactions (
    user_id,
    account_id,
    currency_original,
    amount_original,
    exchange_rate,
    amount_home,
    date,
    description
  ) VALUES (
    test_user_id,
    test_account_id,
    test_currency,
    100.50,
    1.25,
    0, -- Should be overridden to 125.625
    CURRENT_DATE,
    'Trigger Test Transaction'
  )
  RETURNING id, amount_home INTO test_transaction_id, calculated_amount;

  -- Verify the trigger worked
  IF calculated_amount = 125.625 THEN
    RAISE NOTICE 'SUCCESS: Trigger working correctly. amount_home = %', calculated_amount;
  ELSE
    RAISE EXCEPTION 'FAILURE: Trigger not working. Expected 125.625, got %', calculated_amount;
  END IF;

  -- Clean up test data
  DELETE FROM transactions WHERE id = test_transaction_id;

END $$;
*/
