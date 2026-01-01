-- ============================================================================
-- MIGRATION: Add Unique Constraint to Categories Table
-- Purpose: Support atomic upserts (INSERT ... ON CONFLICT) for concurrency safety
-- Date: 2026-01-01
-- ============================================================================

-- Add unique constraint to prevent duplicate category names per user+parent combination
-- This enables ON CONFLICT handling for concurrent imports creating the same categories
ALTER TABLE categories
ADD CONSTRAINT unique_user_category_name_per_parent
UNIQUE (user_id, name, parent_id);

-- Note: PostgreSQL allows multiple NULL values in unique constraints,
-- so multiple top-level categories (parent_id IS NULL) with the same name per user
-- are handled correctly by this constraint.
