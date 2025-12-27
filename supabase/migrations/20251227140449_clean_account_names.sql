-- ============================================================================
-- MIGRATION: Clean Account Names & Add Uniqueness Constraint
--
-- Purpose: Remove redundant currency code suffixes from account names
-- Problem: Account names contain both the currency code AND it's stored separately
--          Example: name="BCP Credito (PEN)", currency_code="PEN"
--          Results in UI displaying: "BCP Credito (PEN) S/" (redundant!)
-- Solution: Clean the name field to remove currency suffixes
--          After: name="BCP Credito", currency_code="PEN"
--          UI displays: "BCP Credito S/" (clean!)
-- Date: 2025-12-27
-- Dependencies: MUST run AFTER fix_import_account_lookup.sql migration
-- ============================================================================

-- ============================================================================
-- PHASE 1: Clean Existing Account Names
-- ============================================================================

-- Remove currency code suffixes from account names
-- Pattern: Matches space + parentheses with 3-4 uppercase letters at end of string
-- Examples:
--   "BCP Credito (PEN)" → "BCP Credito"
--   "Savings (Joint) (USD)" → "Savings (Joint)"  (preserves middle parentheses)
--   "Chase (EUR)" → "Chase"
--   "Test Account" → "Test Account"  (no match, no change)

UPDATE bank_accounts
SET name = regexp_replace(name, '\s\([A-Z]{3,4}\)$', '')
WHERE name ~ '\s\([A-Z]{3,4}\)$';

-- Regex breakdown:
-- \s         - Matches one whitespace character
-- \(         - Matches opening parenthesis (escaped)
-- [A-Z]{3,4} - Matches 3 or 4 uppercase letters (currency code like USD, PEN, EURO)
-- \)         - Matches closing parenthesis (escaped)
-- $          - Anchors to end of string (only strips suffix, not middle occurrences)

-- ============================================================================
-- PHASE 2: Add Uniqueness Constraint
-- ============================================================================

-- Prevent duplicate accounts with same user + name + currency
-- This allows:
--   ✅ User A has "Savings" in USD
--   ✅ User A has "Savings" in EUR  (different currencies, same name - OK!)
--   ❌ User A has two "Savings" accounts both in USD  (blocked!)
--
-- Benefit: Prevents data integrity issues while supporting multi-currency accounts

ALTER TABLE bank_accounts
ADD CONSTRAINT unique_user_account_currency
UNIQUE (user_id, name, currency_code);

-- ============================================================================
-- VERIFICATION QUERIES (For Testing)
-- ============================================================================

-- Uncomment these to verify the migration worked correctly:

-- Check if any accounts still have currency suffixes (should return 0 rows):
-- SELECT id, name, currency_code FROM bank_accounts WHERE name ~ '\s\([A-Z]{3,4}\)$';

-- Show all accounts with their clean names and currencies:
-- SELECT user_id, name, currency_code FROM bank_accounts ORDER BY name, currency_code;

-- Test constraint by trying to create duplicate (should fail):
-- INSERT INTO bank_accounts (user_id, name, currency_code, color)
-- VALUES ('<some_user_id>', 'Test', 'USD', '#000000'),
--        ('<same_user_id>', 'Test', 'USD', '#000000');  -- Should fail!
