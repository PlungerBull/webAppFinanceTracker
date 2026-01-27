-- ============================================================================
-- MIGRATION: Get Changes Since Version for Delta Sync Pull Engine
-- Purpose: Incremental pull of records changed since a version
-- Date: 2026-01-27
--
-- CTO MANDATES:
-- - Pull Engine MUST be incremental (only version > sinceVersion)
-- - Include tombstones (deleted_at IS NOT NULL) for propagating deletes
-- - Limit results to prevent memory issues on large datasets
--
-- Returns: { records: array of record objects }
-- ============================================================================

CREATE OR REPLACE FUNCTION get_changes_since(
  p_user_id UUID,
  p_table_name TEXT,
  p_since_version INTEGER,
  p_limit INTEGER DEFAULT 500
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_records JSONB := '[]'::jsonb;
BEGIN
  -- Validate table name to prevent SQL injection
  IF p_table_name NOT IN ('bank_accounts', 'transactions', 'categories', 'transaction_inbox') THEN
    RAISE EXCEPTION 'Invalid table name: %', p_table_name;
  END IF;

  -- Route to appropriate table
  CASE p_table_name
    WHEN 'bank_accounts' THEN
      SELECT COALESCE(jsonb_agg(row_to_json(t.*) ORDER BY t.version), '[]'::jsonb)
      INTO v_records
      FROM (
        SELECT *
        FROM bank_accounts
        WHERE user_id = p_user_id
          AND version > p_since_version
        ORDER BY version
        LIMIT p_limit
      ) t;

    WHEN 'transactions' THEN
      SELECT COALESCE(jsonb_agg(row_to_json(t.*) ORDER BY t.version), '[]'::jsonb)
      INTO v_records
      FROM (
        SELECT *
        FROM transactions
        WHERE user_id = p_user_id
          AND version > p_since_version
        ORDER BY version
        LIMIT p_limit
      ) t;

    WHEN 'categories' THEN
      SELECT COALESCE(jsonb_agg(row_to_json(t.*) ORDER BY t.version), '[]'::jsonb)
      INTO v_records
      FROM (
        SELECT *
        FROM categories
        WHERE (user_id = p_user_id OR user_id IS NULL)
          AND version > p_since_version
        ORDER BY version
        LIMIT p_limit
      ) t;

    WHEN 'transaction_inbox' THEN
      SELECT COALESCE(jsonb_agg(row_to_json(t.*) ORDER BY t.version), '[]'::jsonb)
      INTO v_records
      FROM (
        SELECT *
        FROM transaction_inbox
        WHERE user_id = p_user_id
          AND version > p_since_version
        ORDER BY version
        LIMIT p_limit
      ) t;

  END CASE;

  RETURN jsonb_build_object('records', v_records);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_changes_since(UUID, TEXT, INTEGER, INTEGER) TO authenticated;

COMMENT ON FUNCTION get_changes_since(UUID, TEXT, INTEGER, INTEGER) IS
'Incremental pull for Delta Sync.
Returns records with version > since_version, ordered by version.
Includes tombstones (deleted_at not null) for propagating deletes.
Limited to p_limit records to prevent memory issues.';
