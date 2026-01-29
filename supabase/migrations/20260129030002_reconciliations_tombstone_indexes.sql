-- ============================================================================
-- MIGRATION: Reconciliations Tombstone Partial Indexes
-- Purpose: Performance hardening for deleted_at filtering
-- Date: 2026-01-29
-- Architecture: CTO Mandate - Partial indexes for O(1) active record lookups
-- ============================================================================
--
-- Problem: Views and repositories use WHERE deleted_at IS NULL.
-- Without indexes, Postgres performs O(N) sequential scans.
-- With partial indexes, this becomes O(1) index lookup.
--
-- These indexes ONLY include rows where deleted_at IS NULL,
-- making them small and fast for the common "active records" query.
-- ============================================================================

-- Primary key lookup for active reconciliations
CREATE INDEX IF NOT EXISTS idx_reconciliations_active
ON reconciliations (id)
WHERE deleted_at IS NULL;

-- User-scoped reconciliation queries
CREATE INDEX IF NOT EXISTS idx_reconciliations_active_by_user
ON reconciliations (user_id)
WHERE deleted_at IS NULL;

-- Account-scoped reconciliation queries (most common access pattern)
CREATE INDEX IF NOT EXISTS idx_reconciliations_active_by_account
ON reconciliations (account_id)
WHERE deleted_at IS NULL;

-- Delta sync support (version-based incremental queries)
CREATE INDEX IF NOT EXISTS idx_reconciliations_sync_version
ON reconciliations (user_id, version)
WHERE deleted_at IS NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON INDEX idx_reconciliations_active IS 'Partial index for active (non-deleted) reconciliations. O(1) lookup for WHERE deleted_at IS NULL queries.';
COMMENT ON INDEX idx_reconciliations_active_by_user IS 'User-scoped partial index for active reconciliations.';
COMMENT ON INDEX idx_reconciliations_active_by_account IS 'Account-scoped partial index for active reconciliations. Most common access pattern.';
COMMENT ON INDEX idx_reconciliations_sync_version IS 'Delta sync index for version-based incremental queries.';
