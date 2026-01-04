-- ============================================================================
-- DIAGNOSTIC: Check and fix PROD import_transactions function state
-- Purpose: Verify function signatures and ensure only 6-parameter version exists
-- Date: 2026-01-04
-- ============================================================================

-- Force drop the old 4-parameter function signature (in case it still exists)
DROP FUNCTION IF EXISTS public.import_transactions(uuid, jsonb, text, text);

-- Verify the 6-parameter function exists and show its signature
DO $$
DECLARE
  func_count integer;
  func_args text;
BEGIN
  -- Count how many import_transactions functions exist
  SELECT COUNT(*) INTO func_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'import_transactions';

  RAISE NOTICE 'Found % import_transactions function(s)', func_count;

  -- Show the function signature
  SELECT pg_get_function_arguments(p.oid) INTO func_args
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'import_transactions'
  LIMIT 1;

  RAISE NOTICE 'Function signature: import_transactions(%)', func_args;
END $$;

-- Verify the unique constraint exists
DO $$
DECLARE
  constraint_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_user_category_name_per_parent'
  ) INTO constraint_exists;

  IF constraint_exists THEN
    RAISE NOTICE 'Unique constraint exists: unique_user_category_name_per_parent';
  ELSE
    RAISE WARNING 'Unique constraint MISSING: unique_user_category_name_per_parent';
  END IF;
END $$;
