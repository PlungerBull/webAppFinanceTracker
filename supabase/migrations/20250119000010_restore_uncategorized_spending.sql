-- Drop the function to ensure a clean slate
DROP FUNCTION IF EXISTS get_monthly_spending_by_category(INTEGER, UUID);

-- Restore the function with the original logic for handling uncategorized transactions
-- Adapted to use 'color' instead of 'icon'
CREATE OR REPLACE FUNCTION get_monthly_spending_by_category(
  p_months_back INTEGER DEFAULT 6,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE (
  category_id UUID,
  category_name TEXT,
  category_color TEXT,
  month_key TEXT,
  total_amount NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Use a special UUID for uncategorized transactions
    COALESCE(t.category_id, '00000000-0000-0000-0000-000000000000'::UUID) as category_id,
    COALESCE(c.name, 'Uncategorized') as category_name,
    -- Use a default gray color for uncategorized (matches ACCOUNT.NO_COLOR)
    COALESCE(c.color, '#94a3b8') as category_color,
    TO_CHAR(DATE_TRUNC('month', t.date), 'YYYY-MM') as month_key,
    SUM(t.amount_home) as total_amount
  FROM transactions t
  LEFT JOIN categories c ON c.id = t.category_id
  WHERE t.user_id = p_user_id
    AND t.date >= DATE_TRUNC('month', NOW() - (p_months_back || ' months')::INTERVAL)
  GROUP BY 
    COALESCE(t.category_id, '00000000-0000-0000-0000-000000000000'::UUID),
    COALESCE(c.name, 'Uncategorized'),
    COALESCE(c.color, '#94a3b8'),
    month_key
  HAVING SUM(t.amount_home) != 0  -- Only include categories with activity
  ORDER BY category_name, month_key;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_monthly_spending_by_category(INTEGER, UUID) TO authenticated;
