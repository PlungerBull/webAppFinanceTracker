-- ============================================================================
-- Migration: Update parent_categories_with_counts view to include type field
-- Date: 2024-12-10
-- Description: Recreates the parent_categories_with_counts view to include
--              the 'type' column (income/expense) that was added to categories
-- ============================================================================

-- Drop existing view if it exists
DROP VIEW IF EXISTS parent_categories_with_counts;

-- Create (or replace) the view for Parent Categories
-- NOW INCLUDES: 'type' column to match recent schema changes
CREATE OR REPLACE VIEW parent_categories_with_counts AS
SELECT
    p.id,
    p.name,
    p.color,
    p.type,           -- ADDED: Now includes Income/Expense type
    p.user_id,
    p.created_at,
    p.updated_at,
    p.parent_id,
    COALESCE(SUM(t_count.transaction_count), 0) AS transaction_count
FROM categories p
LEFT JOIN categories c ON c.parent_id = p.id
LEFT JOIN (
    SELECT category_id, COUNT(*) as transaction_count
    FROM transactions
    GROUP BY category_id
) t_count ON c.id = t_count.category_id
WHERE p.parent_id IS NULL  -- Only parent categories
GROUP BY p.id, p.name, p.color, p.type, p.user_id, p.created_at, p.updated_at, p.parent_id;

-- Permissions
GRANT SELECT ON parent_categories_with_counts TO authenticated;
ALTER VIEW parent_categories_with_counts SET (security_invoker = true);

-- ============================================================================
-- Notes:
-- - This view aggregates transaction counts for parent categories
-- - The 'type' field was added to support income/expense categorization
-- - security_invoker = true ensures RLS policies are respected
-- ============================================================================
