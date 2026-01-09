-- ============================================================================
-- VERIFICATION QUERY: Confirm Search Path Hardening
-- Purpose: Verify all trigger functions have SET search_path configured
-- Usage: Run this in Supabase SQL Editor to validate the security fix
-- ============================================================================

SELECT
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    CASE
        WHEN p.proconfig IS NULL THEN '❌ No search_path set'
        WHEN array_to_string(p.proconfig, ',') LIKE '%search_path=%'
            THEN '✅ search_path configured: ' || array_to_string(p.proconfig, ',')
        ELSE '⚠️ Other config: ' || array_to_string(p.proconfig, ',')
    END AS search_path_status,
    pg_get_functiondef(p.oid) AS full_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
      'check_reconciliation_date_overlap',
      'auto_set_cleared_flag',
      'check_reconciliation_account_match',
      'check_transaction_reconciliation_lock'
  )
ORDER BY p.proname;

-- Expected Result:
-- All 4 functions should show: ✅ search_path configured: search_path=
-- If any show ❌, the migration needs to be re-run
