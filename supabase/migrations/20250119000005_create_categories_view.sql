-- Create a view to get categories with transaction counts
CREATE OR REPLACE VIEW categories_with_counts
WITH (security_invoker = true)
AS
SELECT 
    c.id,
    c.user_id,
    c.name,
    c.icon,
    c.color,
    c.type,
    c.is_default,
    c.created_at,
    c.updated_at,
    COUNT(t.id) as transaction_count
FROM categories c
LEFT JOIN transactions t ON c.id = t.category_id
GROUP BY c.id, c.user_id, c.name, c.icon, c.color, c.type, c.is_default, c.created_at, c.updated_at;
