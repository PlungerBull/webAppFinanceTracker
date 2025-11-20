-- Drop the old function signature explicitly to remove the ambiguity/overload
DROP FUNCTION IF EXISTS get_monthly_spending_by_category(INTEGER);

-- The new function (INTEGER, UUID) should already exist from the previous migration,
-- but let's ensure it's the only one and correctly defined just in case.
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
  WITH monthly_data AS (
    SELECT 
      t.category_id,
      TO_CHAR(t.date, 'YYYY-MM') as month_key,
      SUM(t.amount_home) as amount
    FROM transactions t
    WHERE 
      t.user_id = p_user_id
      AND t.date >= (CURRENT_DATE - (p_months_back || ' months')::INTERVAL)
      AND t.amount_home < 0 -- Only consider expenses (negative amounts)
      AND t.category_id IS NOT NULL -- Exclude uncategorized for now
    GROUP BY 
      t.category_id, 
      TO_CHAR(t.date, 'YYYY-MM')
  )
  SELECT 
    c.id as category_id,
    c.name as category_name,
    c.color as category_color,
    md.month_key,
    ABS(md.amount) as total_amount -- Return positive values for spending
  FROM monthly_data md
  JOIN categories c ON md.category_id = c.id
  ORDER BY md.month_key DESC, total_amount DESC;
END;
$$;
