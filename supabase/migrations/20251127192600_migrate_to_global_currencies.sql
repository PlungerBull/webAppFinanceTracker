-- Migration: Centralize Currencies to Global System
-- Phase 3: Move from User-Defined to System-Defined Currency Model

-- 1. Create the Global Master Table
CREATE TABLE IF NOT EXISTS global_currencies (
  code text PRIMARY KEY,
  name text NOT NULL,
  symbol text NOT NULL,
  flag text
);

-- Enable RLS (Public Read-Only)
ALTER TABLE global_currencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access" ON global_currencies;
CREATE POLICY "Public read access" ON global_currencies FOR SELECT USING (true);

-- 2. Populate with Standard ISO Codes (Top 20 + Latin American)
INSERT INTO global_currencies (code, name, symbol, flag) VALUES
('USD', 'US Dollar', '$', '🇺🇸'),
('EUR', 'Euro', '€', '🇪🇺'),
('GBP', 'British Pound', '£', '🇬🇧'),
('JPY', 'Japanese Yen', '¥', '🇯🇵'),
('PEN', 'Peruvian Sol', 'S/.', '🇵🇪'),
('MXN', 'Mexican Peso', '$', '🇲🇽'),
('COP', 'Colombian Peso', '$', '🇨🇴'),
('CLP', 'Chilean Peso', '$', '🇨🇱'),
('ARS', 'Argentine Peso', '$', '🇦🇷'),
('BRL', 'Brazilian Real', 'R$', '🇧🇷'),
('CAD', 'Canadian Dollar', '$', '🇨🇦'),
('AUD', 'Australian Dollar', '$', '🇦🇺'),
('CHF', 'Swiss Franc', 'Fr', '🇨🇭'),
('CNY', 'Chinese Yuan', '¥', '🇨🇳'),
('HKD', 'Hong Kong Dollar', '$', '🇭🇰'),
('NZD', 'New Zealand Dollar', '$', '🇳🇿'),
('SEK', 'Swedish Krona', 'kr', '🇸🇪'),
('KRW', 'South Korean Won', '₩', '🇰🇷'),
('SGD', 'Singapore Dollar', '$', '🇸🇬'),
('INR', 'Indian Rupee', '₹', '🇮🇳')
ON CONFLICT (code) DO NOTHING;

-- 3. Safety Net: Auto-add any custom codes currently in use to avoid FK errors
INSERT INTO global_currencies (code, name, symbol, flag)
SELECT DISTINCT currency_code, currency_code, '$', '🏳️' 
FROM account_currencies
WHERE currency_code NOT IN (SELECT code FROM global_currencies)
ON CONFLICT DO NOTHING;

-- 4. Move "Main Currency" preference to User Settings
-- A. Add column
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS main_currency text REFERENCES global_currencies(code) DEFAULT 'USD';

-- B. Migrate data (Find the currency marked 'is_main' for each user)
UPDATE user_settings us
SET main_currency = c.code
FROM currencies c
WHERE us.user_id = c.user_id AND c.is_main = true;

-- 5. Enforce Foreign Keys on Existing Tables
-- Link account_currencies to the new global table
ALTER TABLE account_currencies
DROP CONSTRAINT IF EXISTS fk_global_currency;

ALTER TABLE account_currencies
ADD CONSTRAINT fk_global_currency
FOREIGN KEY (currency_code) REFERENCES global_currencies(code);

-- Link transactions to the new global table
ALTER TABLE transactions
DROP CONSTRAINT IF EXISTS fk_transactions_currency;

ALTER TABLE transactions
ADD CONSTRAINT fk_transactions_currency
FOREIGN KEY (currency_original) REFERENCES global_currencies(code);

-- 6. Clean Up: Drop the old user-specific table
DROP TABLE IF EXISTS currencies;
