-- Migration: Remove is_default column from categories
-- Timestamp: 20251130095800

BEGIN;

-- 1. Drop the policy that depends on is_default
DROP POLICY IF EXISTS "Users can view default and their own categories" ON categories;

-- 2. Create a new policy for viewing categories (only user's own)
-- Assuming the intention is that users only see their own categories now.
CREATE POLICY "Users can view their own categories" ON categories
    FOR SELECT
    USING (auth.uid() = user_id);

-- 3. Drop the column with CASCADE to remove it from views (like categories_with_counts)
ALTER TABLE categories DROP COLUMN IF EXISTS is_default CASCADE;

-- 4. Recreate the view categories_with_counts
-- The CASCADE above dropped the view, so we must recreate it.
CREATE OR REPLACE VIEW categories_with_counts AS
SELECT 
    c.id,
    c.name,
    c.color,
    c.user_id,
    c.created_at,
    c.updated_at,
    c.parent_id,
    COALESCE(COUNT(t.id), 0) AS transaction_count
FROM categories c
LEFT JOIN transactions t ON c.id = t.category_id
GROUP BY c.id;

COMMIT;
