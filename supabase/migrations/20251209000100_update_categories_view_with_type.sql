-- Migration: Update categories_with_counts View to Include Type Field
-- Purpose: Fix missing 'type' column in the view
-- Bug Fix: The view was created on Nov 30, but 'type' column was added to categories table on Dec 6
--          This migration adds the missing type field to the view

-- ============================================================================
-- Drop and Recreate categories_with_counts View with Type Field
-- ============================================================================
-- Note: We must DROP first because CREATE OR REPLACE doesn't allow changing column order
-- This is safe because views don't contain data, just query definitions

DROP VIEW IF EXISTS categories_with_counts CASCADE;

CREATE VIEW categories_with_counts AS
SELECT
    c.id,
    c.name,
    c.color,
    c.type,           -- ✅ Added: This field was missing from the original view
    c.user_id,
    c.created_at,
    c.updated_at,
    c.parent_id,
    COALESCE(COUNT(t.id), 0) AS transaction_count
FROM categories c
LEFT JOIN transactions t ON c.id = t.category_id
GROUP BY c.id, c.name, c.color, c.type, c.user_id, c.created_at, c.updated_at, c.parent_id;

-- ============================================================================
-- Notes
-- ============================================================================
-- The type field is critical for:
-- 1. Dashboard categorization (Income vs Expense sections)
-- 2. Category filtering in the UI
-- 3. Validation of parent-child type consistency
--
-- Without this field in the view, frontend components couldn't properly
-- display categories by their type when querying this view.
