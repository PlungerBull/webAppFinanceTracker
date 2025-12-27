-- Migration: Make Inbox Permissive (Scratchpad Transformation)
-- Purpose: Remove NOT NULL constraints from amount and description columns
-- to allow partial data entry in the transaction_inbox table.
--
-- This enables the "Scratchpad" functionality where users can save incomplete
-- drafts with any combination of fields (e.g., just a category, just an amount, etc.)

-- Remove NOT NULL constraint from amount column
ALTER TABLE transaction_inbox
  ALTER COLUMN amount DROP NOT NULL;

-- Remove NOT NULL constraint from description column
ALTER TABLE transaction_inbox
  ALTER COLUMN description DROP NOT NULL;

-- Add comment explaining the relaxed constraints
COMMENT ON COLUMN transaction_inbox.amount IS 'Transaction amount - nullable to support partial drafts in scratchpad mode';
COMMENT ON COLUMN transaction_inbox.description IS 'Transaction description - nullable to support partial drafts in scratchpad mode';
