-- ============================================================================
-- MIGRATION: Relax Account Grouping Constraint
-- Purpose: Make group_id nullable to prevent sync crashes while Pull Engine heals
-- Date: 2026-02-02
--
-- CONTEXT:
-- - batch_upsert_accounts fails with NOT NULL violation when group_id is null
-- - This is a "Permissive Schema" fix - the Pull Engine will heal null values
-- - Do NOT relax transactions.account_id - that's the Sacred Ledger
--
-- STRATEGY: "Permissive Schema, Strict Ledger"
-- - Accounts can tolerate nullable group_id (UI groups will self-heal)
-- - Transactions must keep strict account_id (referential integrity)
-- ============================================================================

-- Make group_id nullable to prevent hard 400 errors during sync
ALTER TABLE bank_accounts ALTER COLUMN group_id DROP NOT NULL;

COMMENT ON COLUMN bank_accounts.group_id IS
'Logical grouping ID for multi-currency account sets. Nullable for sync resilience - Pull Engine will auto-generate if missing.';
