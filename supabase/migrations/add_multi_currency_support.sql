-- Step 1: Drop old account_balances view FIRST (it depends on the columns we're about to drop)
DROP VIEW IF EXISTS account_balances;

-- Step 2: Create account_currencies junction table
-- This properly normalizes the many-to-many relationship between accounts and currencies
-- Linked via: account_currencies.account_id → bank_accounts.id
CREATE TABLE IF NOT EXISTS account_currencies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  currency_code VARCHAR(3) NOT NULL,
  starting_balance NUMERIC(15, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(account_id, currency_code)
);

-- Step 3: Migrate existing data BEFORE dropping columns
INSERT INTO account_currencies (account_id, currency_code, starting_balance)
SELECT id, currency, starting_balance
FROM bank_accounts
WHERE NOT EXISTS (
  SELECT 1 FROM account_currencies ac
  WHERE ac.account_id = bank_accounts.id
  AND ac.currency_code = bank_accounts.currency
);

-- Step 4: Now drop old columns from bank_accounts
ALTER TABLE bank_accounts DROP COLUMN IF EXISTS currency;
ALTER TABLE bank_accounts DROP COLUMN IF EXISTS starting_balance;

-- Step 5: Add RLS policies for account_currencies
ALTER TABLE account_currencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own account currencies"
  ON account_currencies FOR SELECT
  USING (
    account_id IN (
      SELECT id FROM bank_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own account currencies"
  ON account_currencies FOR INSERT
  WITH CHECK (
    account_id IN (
      SELECT id FROM bank_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own account currencies"
  ON account_currencies FOR UPDATE
  USING (
    account_id IN (
      SELECT id FROM bank_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own account currencies"
  ON account_currencies FOR DELETE
  USING (
    account_id IN (
      SELECT id FROM bank_accounts WHERE user_id = auth.uid()
    )
  );

-- Step 6: Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_account_currencies_account_id ON account_currencies(account_id);
CREATE INDEX IF NOT EXISTS idx_account_currencies_currency_code ON account_currencies(currency_code);

-- Step 7: Create updated_at trigger
CREATE OR REPLACE FUNCTION update_account_currencies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_account_currencies_updated_at
  BEFORE UPDATE ON account_currencies
  FOR EACH ROW
  EXECUTE FUNCTION update_account_currencies_updated_at();

-- Step 8: Create NEW account_balances view (WITHOUT SECURITY DEFINER)
-- This view returns one row per account per currency with current balance
-- Drop old view first
DROP VIEW IF EXISTS account_balances;

-- Create view WITHOUT any security definer property
CREATE VIEW account_balances 
WITH (security_invoker = true)  -- ✅ This is the key - explicitly set security invoker
AS
SELECT
    ac.id,
    ba.id as account_id,
    ba.user_id,
    ba.name,
    ac.currency_code as currency,
    ac.starting_balance,
    COALESCE(SUM(t.amount_original), 0) as transaction_sum,
    ac.starting_balance + COALESCE(SUM(t.amount_original), 0) as current_balance,
    ba.created_at,
    ba.updated_at
FROM account_currencies ac
JOIN bank_accounts ba ON ba.id = ac.account_id
LEFT JOIN transactions t ON t.account_id = ac.account_id AND t.currency_original = ac.currency_code
GROUP BY ac.id, ba.id, ba.user_id, ba.name, ac.currency_code, ac.starting_balance, ba.created_at, ba.updated_at;

-- Grant select permission to authenticated users
GRANT SELECT ON account_balances TO authenticated;