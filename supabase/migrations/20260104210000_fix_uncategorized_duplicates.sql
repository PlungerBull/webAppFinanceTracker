-- ============================================================================
-- MIGRATION: Fix duplicate Uncategorized parent categories
-- Purpose: Prevent multiple "Uncategorized" parents by treating NULL as equal
-- Date: 2026-01-04
-- ============================================================================
-- Root Cause: UNIQUE (user_id, name, parent_id) allows multiple NULLs
--   - Standard SQL: NULL != NULL, so multiple top-level categories allowed
--   - Result: Every import creates new "Uncategorized" parent (ON CONFLICT never triggers)
--
-- Solution: Use NULLS NOT DISTINCT (Postgres 15+) to treat NULL as equal
--   - Now: NULL == NULL for constraint purposes
--   - Result: ON CONFLICT triggers correctly, only ONE "Uncategorized" per user
-- ============================================================================

-- Drop the old constraint that allows duplicate NULLs
ALTER TABLE categories
DROP CONSTRAINT IF EXISTS unique_user_category_name_per_parent;

-- Create new constraint with NULLS NOT DISTINCT
-- This treats NULL values as equal, preventing duplicate top-level categories
ALTER TABLE categories
ADD CONSTRAINT unique_user_category_name_per_parent
UNIQUE NULLS NOT DISTINCT (user_id, name, parent_id);

-- Now the import function's ON CONFLICT will work correctly for:
-- 1. Top-level categories (parent_id IS NULL) - no more duplicates!
-- 2. Subcategories (parent_id IS NOT NULL) - already working
