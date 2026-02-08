-- ============================================================================
-- Fix: get_monthly_spending_by_category missing deleted_at IS NULL filter
-- Date: 2026-02-07
-- ============================================================================
--
-- Problem: Both overloads of get_monthly_spending_by_category query the
-- transactions table without filtering out soft-deleted rows. This causes
-- deleted transactions to silently inflate spending reports.
--
-- Fix: Add AND t.deleted_at IS NULL to both overloads.
-- ============================================================================

-- Overload 1: (p_months_back, p_user_id)
CREATE OR REPLACE FUNCTION "public"."get_monthly_spending_by_category"(
  "p_months_back" integer DEFAULT 6,
  "p_user_id" "uuid" DEFAULT "auth"."uid"()
) RETURNS TABLE(
  "category_id" "uuid",
  "category_name" "text",
  "category_color" "text",
  "month_key" "text",
  "total_amount" numeric
)
LANGUAGE "plpgsql"
SET "search_path" TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH monthly_data AS (
    SELECT
      t.category_id,
      TO_CHAR(t.date, 'YYYY-MM') as month_key,
      SUM(t.amount_home_cents) as amount
    FROM transactions t
    WHERE
      t.user_id = auth.uid()
      AND t.deleted_at IS NULL
      AND t.date >= (CURRENT_DATE - (p_months_back || ' months')::INTERVAL)
    GROUP BY
      t.category_id,
      TO_CHAR(t.date, 'YYYY-MM')
  )
  SELECT
    c.id as category_id,
    c.name as category_name,
    c.color as category_color,
    md.month_key,
    ABS(md.amount) as total_amount
  FROM monthly_data md
  JOIN categories c ON md.category_id = c.id
  ORDER BY md.month_key DESC, total_amount DESC;
END;
$$;

-- Overload 2: (p_user_id, p_months_back)
CREATE OR REPLACE FUNCTION "public"."get_monthly_spending_by_category"(
  "p_user_id" "uuid",
  "p_months_back" integer DEFAULT 6
) RETURNS TABLE(
  "category_id" "uuid",
  "category_name" "text",
  "category_icon" "text",
  "month_key" "text",
  "total_amount" numeric
)
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public', 'pg_temp'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(t.category_id, '00000000-0000-0000-0000-000000000000'::UUID) as category_id,
    COALESCE(c.name, 'Uncategorized') as category_name,
    COALESCE(c.icon, '❓') as category_icon,
    TO_CHAR(DATE_TRUNC('month', t.date), 'YYYY-MM') as month_key,
    SUM(t.amount_home_cents) as total_amount
  FROM transactions t
  LEFT JOIN categories c ON c.id = t.category_id
  WHERE t.user_id = p_user_id
    AND t.deleted_at IS NULL
    AND t.date >= DATE_TRUNC('month', NOW() - (p_months_back || ' months')::INTERVAL)
  GROUP BY
    COALESCE(t.category_id, '00000000-0000-0000-0000-000000000000'::UUID),
    COALESCE(c.name, 'Uncategorized'),
    COALESCE(c.icon, '❓'),
    month_key
  HAVING SUM(t.amount_home_cents) != 0
  ORDER BY category_name, month_key;
END;
$$;
