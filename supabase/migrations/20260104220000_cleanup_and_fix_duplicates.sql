-- ============================================================================
-- MIGRATION: Cleanup duplicate Uncategorized parents and add NULLS NOT DISTINCT
-- Purpose: Merge duplicate parent categories before adding proper constraint
-- Date: 2026-01-04
-- ============================================================================

-- STEP 1: Identify and merge duplicate "Uncategorized" parents per user
DO $$
DECLARE
  user_record RECORD;
  keeper_id uuid;
  duplicate_id uuid;
  duplicate_count integer;
BEGIN
  -- For each user with duplicate "Uncategorized" parents
  FOR user_record IN
    SELECT user_id, COUNT(*) as dup_count
    FROM categories
    WHERE name = 'Uncategorized' AND parent_id IS NULL
    GROUP BY user_id
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE 'User % has % duplicate Uncategorized parents', user_record.user_id, user_record.dup_count;

    -- Keep the oldest one (first created)
    SELECT id INTO keeper_id
    FROM categories
    WHERE user_id = user_record.user_id
      AND name = 'Uncategorized'
      AND parent_id IS NULL
    ORDER BY created_at ASC
    LIMIT 1;

    RAISE NOTICE '  Keeping category: %', keeper_id;

    -- Reassign all children from duplicates to the keeper
    FOR duplicate_id IN
      SELECT id
      FROM categories
      WHERE user_id = user_record.user_id
        AND name = 'Uncategorized'
        AND parent_id IS NULL
        AND id != keeper_id
    LOOP
      RAISE NOTICE '  Moving children from duplicate: %', duplicate_id;

      -- Update children to point to keeper (handle potential conflicts)
      UPDATE categories
      SET parent_id = keeper_id
      WHERE parent_id = duplicate_id;

      -- Delete the duplicate parent
      DELETE FROM categories WHERE id = duplicate_id;

      RAISE NOTICE '  Deleted duplicate: %', duplicate_id;
    END LOOP;
  END LOOP;
END $$;

-- STEP 2: Do the same for "General" subcategories (might have duplicates too)
DO $$
DECLARE
  parent_record RECORD;
  keeper_id uuid;
  duplicate_id uuid;
BEGIN
  -- For each parent category with duplicate "General" children
  FOR parent_record IN
    SELECT c.user_id, c.parent_id, COUNT(*) as dup_count
    FROM categories c
    WHERE c.name = 'General' AND c.parent_id IS NOT NULL
    GROUP BY c.user_id, c.parent_id
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE 'Parent % has % duplicate General subcategories', parent_record.parent_id, parent_record.dup_count;

    -- Keep the oldest one
    SELECT id INTO keeper_id
    FROM categories
    WHERE user_id = parent_record.user_id
      AND name = 'General'
      AND parent_id = parent_record.parent_id
    ORDER BY created_at ASC
    LIMIT 1;

    RAISE NOTICE '  Keeping subcategory: %', keeper_id;

    -- Reassign transactions and delete duplicates
    FOR duplicate_id IN
      SELECT id
      FROM categories
      WHERE user_id = parent_record.user_id
        AND name = 'General'
        AND parent_id = parent_record.parent_id
        AND id != keeper_id
    LOOP
      -- Move transactions to keeper
      UPDATE transactions
      SET category_id = keeper_id
      WHERE category_id = duplicate_id;

      -- Delete duplicate
      DELETE FROM categories WHERE id = duplicate_id;

      RAISE NOTICE '  Deleted duplicate General: %', duplicate_id;
    END LOOP;
  END LOOP;
END $$;

-- STEP 3: Clean up any other duplicate subcategories
DO $$
DECLARE
  dup_record RECORD;
  keeper_id uuid;
  duplicate_id uuid;
BEGIN
  FOR dup_record IN
    SELECT user_id, name, parent_id, COUNT(*) as dup_count
    FROM categories
    WHERE parent_id IS NOT NULL  -- Only subcategories
    GROUP BY user_id, name, parent_id
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE 'Found % duplicates of "%" under parent %', dup_record.dup_count, dup_record.name, dup_record.parent_id;

    -- Keep oldest
    SELECT id INTO keeper_id
    FROM categories
    WHERE user_id = dup_record.user_id
      AND name = dup_record.name
      AND parent_id = dup_record.parent_id
    ORDER BY created_at ASC
    LIMIT 1;

    -- Delete duplicates
    FOR duplicate_id IN
      SELECT id
      FROM categories
      WHERE user_id = dup_record.user_id
        AND name = dup_record.name
        AND parent_id = dup_record.parent_id
        AND id != keeper_id
    LOOP
      UPDATE transactions SET category_id = keeper_id WHERE category_id = duplicate_id;
      DELETE FROM categories WHERE id = duplicate_id;
      RAISE NOTICE '  Deleted duplicate: %', duplicate_id;
    END LOOP;
  END LOOP;
END $$;

-- STEP 4: Drop old constraint
ALTER TABLE categories
DROP CONSTRAINT IF EXISTS unique_user_category_name_per_parent;

-- STEP 5: Add new constraint with NULLS NOT DISTINCT
ALTER TABLE categories
ADD CONSTRAINT unique_user_category_name_per_parent
UNIQUE NULLS NOT DISTINCT (user_id, name, parent_id);

-- STEP 6: Verify success
DO $$
DECLARE
  constraint_def text;
  remaining_dups integer;
BEGIN
  -- Check constraint definition
  SELECT pg_get_constraintdef(oid) INTO constraint_def
  FROM pg_constraint
  WHERE conname = 'unique_user_category_name_per_parent';

  IF constraint_def LIKE '%NULLS NOT DISTINCT%' THEN
    RAISE NOTICE '✅ SUCCESS: Constraint has NULLS NOT DISTINCT';
  ELSE
    RAISE WARNING '❌ PROBLEM: Constraint missing NULLS NOT DISTINCT';
  END IF;

  -- Check for any remaining duplicates
  SELECT COUNT(*) INTO remaining_dups
  FROM (
    SELECT user_id, name, parent_id, COUNT(*) as cnt
    FROM categories
    GROUP BY user_id, name, parent_id
    HAVING COUNT(*) > 1
  ) dups;

  IF remaining_dups = 0 THEN
    RAISE NOTICE '✅ NO duplicate categories remaining';
  ELSE
    RAISE WARNING '❌ PROBLEM: % duplicate category groups still exist', remaining_dups;
  END IF;
END $$;
