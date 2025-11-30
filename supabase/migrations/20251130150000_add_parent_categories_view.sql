-- Create view to aggregate transaction counts from children to parents
-- This view shows only parent categories (parent_id IS NULL) with aggregated transaction counts from all their children

CREATE OR REPLACE VIEW parent_categories_with_counts AS
SELECT
    p.id,
    p.name,
    p.color,
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
GROUP BY p.id, p.name, p.color, p.user_id, p.created_at, p.updated_at, p.parent_id;

-- Grant access to authenticated users
GRANT SELECT ON parent_categories_with_counts TO authenticated;

-- Enable RLS on the view to inherit from categories table
ALTER VIEW parent_categories_with_counts SET (security_invoker = true);
