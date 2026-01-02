-- ============================================================================
-- MIGRATION: Drop old import_transactions function signature
-- Purpose: Remove the 4-parameter version to avoid RPC 404 errors
-- Date: 2026-01-02
-- ============================================================================
-- The previous migration created a new 6-parameter version but didn't drop
-- the old 4-parameter version, causing the frontend to get 404 errors when
-- calling with 6 parameters.
-- ============================================================================

-- Drop the old 4-parameter function signature
DROP FUNCTION IF EXISTS public.import_transactions(uuid, jsonb, text, text);
