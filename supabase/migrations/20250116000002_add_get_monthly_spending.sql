-- Migration: Add get_monthly_spending_by_category function
-- Purpose: Calculate spending by category for the last N months in main currency
-- Created: 2025-01-16

-- Drop function if it exists (for idempotency)
DROP FUNCTION IF EXISTS get_monthly_spending_by_category(INTEGER);

-- Create function to get monthly spending aggregated by category
CREATE OR REPLACE FUNCTION get_monthly_spending_by_category(
  p_months_back INTEGER DEFAULT 6
)
RETURNS TABLE (
  category_id UUID,
  category_name TEXT,
  category_icon TEXT,
  month_key TEXT,
  total_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY INVOKER  -- Uses caller's permissions (respects RLS)
AS $$
DECLARE
  v_user_id UUID;
  v_start_date TIMESTAMPTZ;
BEGIN
  -- Get authenticated user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Validate months_back parameter
  IF p_months_back < 1 OR p_months_back > 120 THEN
    RAISE EXCEPTION 'months_back must be between 1 and 120';
  END IF;

  -- Calculate start date (beginning of month N months ago)
  v_start_date := date_trunc('month', NOW()) - (p_months_back || ' months')::INTERVAL;

  -- Return aggregated spending by category and month
  -- Uses amount_home (converted to main currency) for consistency
  RETURN QUERY
  SELECT 
    c.id as category_id,
    c.name as category_name,
    c.icon as category_icon,
    to_char(date_trunc('month', t.date), 'YYYY-MM') as month_key,
    SUM(t.amount_home) as total_amount
  FROM transactions t
  JOIN categories c ON c.id = t.category_id
  WHERE t.user_id = v_user_id
    AND t.date >= v_start_date
    AND t.category_id IS NOT NULL  -- Exclude uncategorized transactions
  GROUP BY c.id, c.name, c.icon, date_trunc('month', t.date)
  ORDER BY date_trunc('month', t.date) DESC, c.name ASC;

END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_monthly_spending_by_category(INTEGER) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_monthly_spending_by_category(INTEGER) IS 
  'Returns spending aggregated by category for the last N months in main currency (amount_home). Uses SECURITY INVOKER to respect RLS policies.';