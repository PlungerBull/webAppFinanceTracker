-- ============================================================================
-- REPOSITORY PATTERN PREPARATION MIGRATION
-- CTO-Mandated Changes for Todoist-Style Delta Sync Architecture
-- ============================================================================
-- This migration prepares the database for the Repository Pattern refactor
-- and dual-platform (Web + iOS) architecture with offline-first sync.
--
-- Three Critical Mandates:
-- 1. Soft Deletes (Tombstone Pattern) - for offline sync
-- 2. Version-Based Sync (NOT Timestamp-Based) - prevents clock drift
-- 3. Atomic Transfer Protocol - prevents unbalanced ledger
-- ============================================================================

-- ============================================================================
-- CTO Mandate #1: Soft Deletes (Tombstone Pattern)
-- ============================================================================
-- Problem: If iOS app is offline and Web hard-deletes a transaction,
--          iOS has no way to know it's gone (orphaned record forever).
-- Solution: Soft delete with `deleted_at` timestamp acts as "tombstone"
--           telling clients "this record was intentionally removed".
-- ============================================================================

-- Add deleted_at column to transactions table
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Index for soft delete queries (performance optimization for sync)
CREATE INDEX IF NOT EXISTS idx_transactions_deleted_at
ON transactions(deleted_at)
WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- CTO Mandate #2: Version-Based Sync (NOT Timestamp-Based)
-- ============================================================================
-- Problem: Timestamp-based sync is vulnerable to clock drift.
--          If user's iPhone clock is 1 second off, they'll miss deletions.
-- Solution: Global monotonic version counter - clock-independent, deterministic.
-- ============================================================================

-- Global version counter (monotonically increasing, never resets)
CREATE SEQUENCE IF NOT EXISTS global_transaction_version START 1;

-- Update trigger to use global version (replaces per-record version)
CREATE OR REPLACE FUNCTION set_transaction_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Assign next global version (NOT per-record counter)
  -- This ensures version numbers are globally unique and monotonically increasing
  NEW.version := nextval('global_transaction_version');
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger if exists and create new one
DROP TRIGGER IF EXISTS set_transaction_version_trigger ON transactions;
CREATE TRIGGER set_transaction_version_trigger
BEFORE INSERT OR UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION set_transaction_version();

-- Create index on version for efficient delta sync queries
CREATE INDEX IF NOT EXISTS idx_transactions_version ON transactions(version);

-- ============================================================================
-- CTO Mandate #3: Atomic Transfer Protocol
-- ============================================================================
-- Problem: A "Transfer" is two physical records (OUT from Account A, IN to Account B).
--          If network drops between two separate create() calls, ledger becomes unbalanced.
--          iOS app has no way to "heal" a half-created transfer.
-- Solution: Single atomic RPC creates both transactions - guaranteed all-or-nothing.
-- ============================================================================

CREATE OR REPLACE FUNCTION create_transfer_transaction(
  p_user_id UUID,
  p_from_account_id UUID,
  p_to_account_id UUID,
  p_amount_cents INTEGER,  -- Integer cents! (CTO Mandate: Sacred Integer Arithmetic)
  p_date TIMESTAMPTZ,
  p_description TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_transfer_id UUID;
  v_out_txn_id UUID;
  v_in_txn_id UUID;
  v_out_txn transactions_view%ROWTYPE;
  v_in_txn transactions_view%ROWTYPE;
BEGIN
  -- Generate IDs
  -- NOTE: In future optimistic update version, client will provide these IDs
  v_transfer_id := gen_random_uuid();
  v_out_txn_id := gen_random_uuid();
  v_in_txn_id := gen_random_uuid();

  -- Create OUT transaction (negative amount)
  -- ATOMIC: Both INSERTs are in same transaction - both succeed or both fail
  INSERT INTO transactions (
    id, user_id, account_id, amount_original, date,
    description, notes, transfer_id
  ) VALUES (
    v_out_txn_id, p_user_id, p_from_account_id, -p_amount_cents, p_date,
    p_description, p_notes, v_transfer_id
  );

  -- Create IN transaction (positive amount)
  INSERT INTO transactions (
    id, user_id, account_id, amount_original, date,
    description, notes, transfer_id
  ) VALUES (
    v_in_txn_id, p_user_id, p_to_account_id, p_amount_cents, p_date,
    p_description, p_notes, v_transfer_id
  );

  -- Fetch complete data from transactions_view (includes joined account/category data)
  SELECT * INTO v_out_txn FROM transactions_view WHERE id = v_out_txn_id;
  SELECT * INTO v_in_txn FROM transactions_view WHERE id = v_in_txn_id;

  -- Return both transaction IDs and complete view data
  RETURN jsonb_build_object(
    'transferId', v_transfer_id,
    'outTransactionId', v_out_txn_id,
    'inTransactionId', v_in_txn_id,
    'outTransaction', row_to_json(v_out_txn),
    'inTransaction', row_to_json(v_in_txn)
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_transfer_transaction TO authenticated;

-- ============================================================================
-- Update transactions_view to exclude soft-deleted records
-- ============================================================================
-- CRITICAL: View must filter WHERE deleted_at IS NULL
--           This ensures normal queries never see deleted records
--           (but we can query them explicitly for sync with WHERE deleted_at IS NOT NULL)
--
-- IMPORTANT: Must DROP and recreate because PostgreSQL doesn't allow
--            reordering columns with CREATE OR REPLACE
-- ============================================================================

DROP VIEW IF EXISTS transactions_view;

CREATE VIEW transactions_view WITH (security_invoker='true') AS
SELECT
  t.id,
  t.user_id,
  t.account_id,
  t.category_id,
  t.description,
  t.amount_original,
  t.amount_home,
  t.exchange_rate,
  t.date,
  t.notes,
  t.source_text,
  t.inbox_id,
  t.transfer_id,
  t.reconciliation_id,
  t.cleared,
  t.created_at,
  t.updated_at,
  t.version,
  t.deleted_at,  -- ← NEW: Soft delete support
  a.name AS account_name,
  a.currency_code AS currency_original,  -- ← From account (Sacred Ledger pattern)
  a.currency_code AS account_currency,
  a.color AS account_color,
  c.name AS category_name,
  c.color AS category_color,
  c.type AS category_type,
  r.status AS reconciliation_status
FROM transactions t
LEFT JOIN bank_accounts a ON t.account_id = a.id
LEFT JOIN categories c ON t.category_id = c.id
LEFT JOIN reconciliations r ON t.reconciliation_id = r.id
WHERE t.deleted_at IS NULL;  -- ← Filter out soft-deleted rows

-- Grant select permission to authenticated users
GRANT SELECT ON transactions_view TO authenticated;

-- ============================================================================
-- Update delete_transaction_with_version to use soft delete
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_transaction_with_version(
  p_transaction_id UUID,
  p_expected_version INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_current_version INTEGER;
  v_current_data JSONB;
BEGIN
  -- Get current version
  SELECT version, row_to_json(t.*) INTO v_current_version, v_current_data
  FROM transactions t
  WHERE id = p_transaction_id;

  -- Transaction not found
  IF v_current_version IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'not_found',
      'message', 'Transaction not found'
    );
  END IF;

  -- Version conflict
  IF v_current_version != p_expected_version THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'version_conflict',
      'message', 'Transaction has been modified by another user',
      'currentData', v_current_data
    );
  END IF;

  -- Soft delete: Set deleted_at = NOW() instead of physical DELETE
  UPDATE transactions
  SET deleted_at = NOW()
  WHERE id = p_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Transaction soft deleted successfully'
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION delete_transaction_with_version TO authenticated;

-- ============================================================================
-- Add restore_transaction function for undeleting
-- ============================================================================

CREATE OR REPLACE FUNCTION restore_transaction(
  p_transaction_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_restored_data JSONB;
BEGIN
  -- Check if transaction exists and is deleted
  IF NOT EXISTS (
    SELECT 1 FROM transactions
    WHERE id = p_transaction_id AND deleted_at IS NOT NULL
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'not_found',
      'message', 'Transaction not found or not deleted'
    );
  END IF;

  -- Restore: Set deleted_at = NULL
  UPDATE transactions
  SET deleted_at = NULL
  WHERE id = p_transaction_id
  RETURNING row_to_json(transactions.*) INTO v_restored_data;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Transaction restored successfully',
    'data', v_restored_data
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION restore_transaction TO authenticated;

-- ============================================================================
-- Add get_deleted_transactions for delta sync
-- ============================================================================
-- This function allows clients to fetch soft-deleted transactions
-- for sync reconciliation (needed when iOS app was offline)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_deleted_transactions(
  p_user_id UUID,
  p_since_version INTEGER DEFAULT 0
) RETURNS TABLE (
  id UUID,
  user_id UUID,
  account_id UUID,
  category_id UUID,
  description TEXT,
  amount_original NUMERIC,
  amount_home NUMERIC,
  exchange_rate NUMERIC,
  date TIMESTAMPTZ,
  notes TEXT,
  source_text TEXT,
  inbox_id UUID,
  transfer_id UUID,
  reconciliation_id UUID,
  cleared BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  version INTEGER,
  deleted_at TIMESTAMPTZ,
  account_name TEXT,
  currency_original TEXT,
  account_currency TEXT,
  account_color TEXT,
  category_name TEXT,
  category_color TEXT,
  category_type TEXT,
  reconciliation_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.user_id,
    t.account_id,
    t.category_id,
    t.description,
    t.amount_original,
    t.amount_home,
    t.exchange_rate,
    t.date,
    t.notes,
    t.source_text,
    t.inbox_id,
    t.transfer_id,
    t.reconciliation_id,
    t.cleared,
    t.created_at,
    t.updated_at,
    t.version,
    t.deleted_at,
    a.name AS account_name,
    a.currency_code AS currency_original,
    a.currency_code AS account_currency,
    a.color AS account_color,
    c.name AS category_name,
    c.color AS category_color,
    c.type AS category_type,
    r.status AS reconciliation_status
  FROM transactions t
  LEFT JOIN bank_accounts a ON t.account_id = a.id
  LEFT JOIN categories c ON t.category_id = c.id
  LEFT JOIN reconciliations r ON t.reconciliation_id = r.id
  WHERE t.user_id = p_user_id
    AND t.deleted_at IS NOT NULL
    AND t.version > p_since_version
  ORDER BY t.version ASC;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_deleted_transactions TO authenticated;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Next steps:
-- 1. Verify migration: SELECT deleted_at FROM transactions LIMIT 1;
-- 2. Verify view: SELECT COUNT(*) FROM transactions_view WHERE deleted_at IS NOT NULL; (should be 0)
-- 3. Test atomic transfer: SELECT create_transfer_transaction(...);
-- 4. Update DB_SCHEMA.md with documentation
-- ============================================================================
