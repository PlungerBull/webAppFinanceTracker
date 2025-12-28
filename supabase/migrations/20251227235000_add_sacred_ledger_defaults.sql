-- ============================================================================
-- MIGRATION: Add DEFAULT Values for Sacred Ledger Trigger-Managed Fields
-- Purpose: Make currency_original and amount_home optional in TypeScript Insert types
-- Strategy: Add DEFAULT values to signal these fields are system-managed, not user-provided
-- Date: 2025-12-27
-- ============================================================================

-- SACRED LEDGER ARCHITECTURE: System-Managed Fields
--
-- These fields have DEFAULT values but are ALWAYS overwritten by triggers before INSERT completes:
-- 1. currency_original - Set by enforce_sacred_ledger_currency trigger
-- 2. amount_home - Set by calculate_amount_home trigger
--
-- The DEFAULT values serve two purposes:
-- A. Signal to TypeScript generator that these fields are optional at INSERT time
-- B. Provide fallback values if triggers somehow fail (defensive programming)

-- Add DEFAULT for currency_original (trigger-managed)
ALTER TABLE transactions
  ALTER COLUMN currency_original SET DEFAULT 'PENDING';

-- Add DEFAULT for amount_home (trigger-managed)
-- Note: amount_home may already have DEFAULT 0, but we're making it explicit
ALTER TABLE transactions
  ALTER COLUMN amount_home SET DEFAULT 0;

-- Document the contract for future developers
COMMENT ON COLUMN transactions.currency_original IS
'SYSTEM-MANAGED FIELD: Automatically set by enforce_sacred_ledger_currency trigger based on account_id. The DEFAULT value (PENDING) is ALWAYS overwritten before INSERT completes. Frontend should NOT send this field - it will be ignored.';

COMMENT ON COLUMN transactions.amount_home IS
'SYSTEM-MANAGED FIELD: Automatically calculated by calculate_amount_home trigger as (amount_original * exchange_rate). The DEFAULT value (0) is ALWAYS overwritten before INSERT completes. Frontend should NOT send this field - it will be ignored.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After this migration, regenerate TypeScript types:
-- $ npx supabase gen types typescript --linked > types/database.types.ts
--
-- Expected: currency_original and amount_home become optional in Insert type:
-- Insert: {
--   currency_original?: string;  // Now optional
--   amount_home?: number;        // Now optional
-- }
--
-- Test that trigger still overwrites DEFAULT:
-- INSERT INTO transactions (user_id, account_id, amount_original, date)
-- VALUES (...) RETURNING currency_original, amount_home;
--
-- Expected: currency_original = account's currency_code (NOT 'PENDING')
--           amount_home = calculated value (NOT 0)
