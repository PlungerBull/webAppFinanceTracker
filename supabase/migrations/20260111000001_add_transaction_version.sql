-- ============================================================================
-- MIGRATION: Add Version Column for Optimistic Concurrency Control
-- Purpose: Enable optimistic locking to prevent concurrent update conflicts
-- Date: 2026-01-11
-- Architecture: Zero-Latency UX with version-checked updates
-- ============================================================================

-- Add version column for optimistic locking
ALTER TABLE public.transactions
ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

-- Create composite index for conflict detection
-- Used in WHERE clauses: WHERE id = ? AND version = ?
CREATE INDEX idx_transactions_id_version
ON public.transactions(id, version);

-- Auto-increment version trigger
-- CRITICAL: This trigger increments version on EVERY UPDATE
-- Frontend optimistic updates must also increment version to stay in sync
CREATE OR REPLACE FUNCTION increment_transaction_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_transaction_version
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION increment_transaction_version();

-- Update transactions_view to include version
-- This ensures version is available in all queries
DROP VIEW IF EXISTS public.transactions_view;

CREATE VIEW public.transactions_view AS
SELECT
  t.id,
  t.user_id,
  t.account_id,
  t.category_id,
  t.amount_original,
  t.amount_home,
  t.exchange_rate,
  t.date,
  t.description,
  t.notes,
  t.transfer_id,
  t.created_at,
  t.updated_at,
  t.reconciliation_id,
  t.cleared,
  t.version, -- NEW: Include version for optimistic locking

  -- Joined account data
  a.name AS account_name,
  a.color AS account_color,
  a.currency_code AS currency_original,

  -- Joined category data
  c.name AS category_name,
  c.color AS category_color,
  c.type AS category_type,

  -- Joined reconciliation data
  r.status AS reconciliation_status
FROM transactions t
LEFT JOIN bank_accounts a ON t.account_id = a.id
LEFT JOIN categories c ON t.category_id = c.id
LEFT JOIN reconciliations r ON t.reconciliation_id = r.id;

-- Add comment for documentation
COMMENT ON COLUMN public.transactions.version IS
'Optimistic concurrency control version. Increments on every UPDATE via trigger.
Used by frontend to prevent concurrent update conflicts (e.g., User A and User B editing same transaction).
Client must provide expected version in update requests; conflicts return version_conflict error.';

COMMENT ON TRIGGER trigger_increment_transaction_version ON public.transactions IS
'Auto-increments version on UPDATE for optimistic locking.
CRITICAL: Frontend must also increment version optimistically to prevent UI "jumps".';
