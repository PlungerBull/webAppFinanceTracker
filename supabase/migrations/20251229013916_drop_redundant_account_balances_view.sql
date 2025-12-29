-- Migration: Drop Redundant account_balances View
-- Date: 2025-12-29
-- Reason: View is unused and potentially dangerous post-normalization
--
-- CONTEXT:
-- The account_balances view was created before the currency normalization refactor.
-- It's no longer used anywhere in the application code - the sidebar queries
-- bank_accounts table directly for O(1) performance (accountsApi.getAll).
--
-- RISK:
-- The view wasn't updated for currency normalization and may return incorrect
-- or incomplete data. Keeping it creates maintenance burden and confusion.
--
-- VERIFICATION:
-- Codebase search confirms NO active usage:
-- - accountsApi.getAll() queries bank_accounts directly
-- - useGroupedAccounts() uses useAccounts() which queries bank_accounts
-- - Only references are in type definitions and schema docs

-- Drop the view (IF EXISTS for safety)
DROP VIEW IF EXISTS public.account_balances;

-- ROLLBACK STRATEGY:
-- If this view is needed in the future, it should be recreated with proper
-- currency normalization logic (JOIN to bank_accounts for currency_code).
-- Current implementation is outdated and should not be restored as-is.
