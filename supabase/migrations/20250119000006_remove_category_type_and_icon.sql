-- Drop the view first as it depends on the columns
DROP VIEW IF EXISTS categories_with_counts;

-- Remove columns from categories table
ALTER TABLE categories 
DROP COLUMN IF EXISTS type,
DROP COLUMN IF EXISTS icon;

-- Recreate the view without the dropped columns
CREATE OR REPLACE VIEW categories_with_counts
WITH (security_invoker = true)
AS
SELECT 
    c.id,
    c.user_id,
    c.name,
    c.color,
    c.is_default,
    c.created_at,
    c.updated_at,
    COUNT(t.id) as transaction_count
FROM categories c
LEFT JOIN transactions t ON c.id = t.category_id
GROUP BY c.id, c.user_id, c.name, c.color, c.is_default, c.created_at, c.updated_at;
