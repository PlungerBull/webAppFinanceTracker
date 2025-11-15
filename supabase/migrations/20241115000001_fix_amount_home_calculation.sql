-- Migration: Auto-calculate amount_home for transactions
-- Purpose: Ensure amount_home is always calculated as amount_original * exchange_rate
-- This fixes the current bug where amount_home is hardcoded to 0

-- Step 1: Create trigger function to calculate amount_home
CREATE OR REPLACE FUNCTION calculate_amount_home()
RETURNS TRIGGER AS $$
BEGIN
  -- Automatically calculate amount_home based on exchange_rate
  NEW.amount_home := NEW.amount_original * NEW.exchange_rate;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Apply trigger on INSERT
CREATE TRIGGER set_amount_home_on_insert
  BEFORE INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION calculate_amount_home();

-- Step 3: Apply trigger on UPDATE
CREATE TRIGGER set_amount_home_on_update
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION calculate_amount_home();

-- Step 4: Fix existing transactions with incorrect amount_home
-- This backfills all existing transactions
UPDATE transactions
SET amount_home = amount_original * exchange_rate
WHERE amount_home != (amount_original * exchange_rate) OR amount_home = 0;

-- Step 5: Add comment for documentation
COMMENT ON FUNCTION calculate_amount_home() IS 
  'Automatically calculates amount_home as amount_original * exchange_rate for all transaction inserts/updates';