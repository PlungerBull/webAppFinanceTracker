-- Tombstone Partial Indexes Migration
-- CTO MANDATE: Performance hardening for deleted_at filtering
--
-- Problem: Views and repositories use WHERE deleted_at IS NULL.
-- Without indexes, Postgres performs O(N) sequential scans.
-- With partial indexes, this becomes O(1) index lookup.
--
-- These indexes ONLY include rows where deleted_at IS NULL,
-- making them small and fast for the common "active records" query.
--
-- NOTE: CONCURRENTLY removed for migration compatibility.
-- In production, indexes should be created CONCURRENTLY outside migrations.

-- ============================================================================
-- 1. TRANSACTIONS TABLE
-- ============================================================================
-- Most frequently queried table - critical for performance
CREATE INDEX IF NOT EXISTS idx_transactions_active
ON transactions (id)
WHERE deleted_at IS NULL;

-- Also index by user_id for user-scoped queries
CREATE INDEX IF NOT EXISTS idx_transactions_active_by_user
ON transactions (user_id, date DESC)
WHERE deleted_at IS NULL;

-- Index for delta sync queries (version-based)
CREATE INDEX IF NOT EXISTS idx_transactions_sync_version
ON transactions (user_id, version)
WHERE deleted_at IS NULL;

-- ============================================================================
-- 2. BANK_ACCOUNTS TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_accounts_active
ON bank_accounts (id)
WHERE deleted_at IS NULL;

-- User-scoped account queries
CREATE INDEX IF NOT EXISTS idx_accounts_active_by_user
ON bank_accounts (user_id)
WHERE deleted_at IS NULL;

-- Delta sync support
CREATE INDEX IF NOT EXISTS idx_accounts_sync_version
ON bank_accounts (user_id, version)
WHERE deleted_at IS NULL;

-- ============================================================================
-- 3. CATEGORIES TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_categories_active
ON categories (id)
WHERE deleted_at IS NULL;

-- User-scoped category queries (includes system categories where user_id IS NULL)
CREATE INDEX IF NOT EXISTS idx_categories_active_by_user
ON categories (user_id)
WHERE deleted_at IS NULL;

-- Delta sync support
CREATE INDEX IF NOT EXISTS idx_categories_sync_version
ON categories (user_id, version)
WHERE deleted_at IS NULL;

-- ============================================================================
-- 4. TRANSACTION_INBOX TABLE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_inbox_active
ON transaction_inbox (id)
WHERE deleted_at IS NULL;

-- User-scoped inbox queries with status filter
CREATE INDEX IF NOT EXISTS idx_inbox_active_pending
ON transaction_inbox (user_id, created_at DESC)
WHERE deleted_at IS NULL AND status = 'pending';

-- Delta sync support
CREATE INDEX IF NOT EXISTS idx_inbox_sync_version
ON transaction_inbox (user_id, version)
WHERE deleted_at IS NULL;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run these to verify indexes exist:
--
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename IN ('transactions', 'bank_accounts', 'categories', 'transaction_inbox')
--   AND indexname LIKE '%active%' OR indexname LIKE '%sync_version%';
--
-- Expected: 12 indexes (3 per table)
-- ============================================================================

COMMENT ON INDEX idx_transactions_active IS 'Partial index for active (non-deleted) transactions. O(1) lookup for WHERE deleted_at IS NULL queries.';
COMMENT ON INDEX idx_accounts_active IS 'Partial index for active (non-deleted) accounts. O(1) lookup for WHERE deleted_at IS NULL queries.';
COMMENT ON INDEX idx_categories_active IS 'Partial index for active (non-deleted) categories. O(1) lookup for WHERE deleted_at IS NULL queries.';
COMMENT ON INDEX idx_inbox_active IS 'Partial index for active (non-deleted) inbox items. O(1) lookup for WHERE deleted_at IS NULL queries.';
