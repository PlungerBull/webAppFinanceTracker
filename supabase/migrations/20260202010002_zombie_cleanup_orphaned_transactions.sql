-- ============================================================================
-- MIGRATION: Zombie Cleanup - Delete Orphaned Transactions
-- Purpose: Remove transactions with null account_id (should have been in inbox)
-- Date: 2026-02-02
--
-- CTO MANDATE: These are "zombies" that shouldn't exist in the Sacred Ledger.
-- They should have been in transaction_inbox instead.
-- ============================================================================

-- First, log the count for audit purposes
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM transactions WHERE account_id IS NULL;
  RAISE NOTICE 'Zombie cleanup: Found % orphaned transactions with NULL account_id', orphan_count;
END $$;

-- Delete orphaned transactions
DELETE FROM transactions WHERE account_id IS NULL;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Zombie cleanup complete: Removed all transactions with NULL account_id';
END $$;
