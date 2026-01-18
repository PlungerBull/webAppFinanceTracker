-- ============================================================================
-- MIGRATION: Drop Old NUMERIC Function Signatures
-- Purpose: Remove legacy NUMERIC parameter versions of hardened functions
-- Date: 2026-01-19
-- Architecture: Cleanup after BIGINT hardening to eliminate function overloads
-- ============================================================================
--
-- CONTEXT: PostgreSQL allows function overloading - multiple functions with same
-- name but different parameter types. After creating new BIGINT versions, we must
-- explicitly DROP the old NUMERIC versions to prevent TypeScript type confusion.
--
-- This migration runs AFTER 20260119000002_harden_all_ledger_rpcs.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. DROP: Old promote_inbox_item NUMERIC signatures
-- ============================================================================
-- Remove all NUMERIC parameter variations that may exist from previous migrations

DROP FUNCTION IF EXISTS "public"."promote_inbox_item"(
  "uuid", "uuid", "uuid", "text", timestamp with time zone, numeric
);

DROP FUNCTION IF EXISTS "public"."promote_inbox_item"(
  "uuid", "uuid", "uuid", "text", timestamp with time zone, numeric, numeric
);

DROP FUNCTION IF EXISTS "public"."promote_inbox_item"(
  "uuid", "uuid", "uuid"
);

-- ============================================================================
-- 2. DROP: Old create_transfer NUMERIC signature
-- ============================================================================

DROP FUNCTION IF EXISTS "public"."create_transfer"(
  "uuid", "uuid", "uuid", numeric, numeric, numeric, timestamp with time zone, "text", "uuid"
);

-- ============================================================================
-- Audit Trail
-- ============================================================================

COMMENT ON SCHEMA public IS '[CLEANUP 2026-01-19] Removed legacy NUMERIC function signatures - only BIGINT versions remain';

COMMIT;
