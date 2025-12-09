# 🚀 Quick Copy-Paste Guide for Supabase SQL Editor

## Instructions

1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Copy the SQL from **Migration 1** below
4. Paste and click **Run**
5. Wait for success confirmation
6. Copy the SQL from **Migration 2** below
7. Paste and click **Run**
8. Done! ✅

---

## Migration 1: Enforce Category Type Hierarchy

```sql
-- Migration: Enforce Category Type Hierarchy Consistency
-- Purpose: Automatically synchronize parent-child category types to prevent data inconsistencies
-- Bug Fix: Addresses "ghost categories" where parents and children have mismatched types

-- ============================================================================
-- 1. Create Trigger Function: sync_category_type_hierarchy
-- ============================================================================
-- This function enforces that parent and child categories always have matching types.
-- It handles three scenarios:
--   A) When a parent's type changes, cascade the change to all children
--   B) When a new child is inserted, inherit the parent's type
--   C) When a child is moved to a new parent, adopt the new parent's type

CREATE OR REPLACE FUNCTION sync_category_type_hierarchy()
RETURNS TRIGGER AS $$
BEGIN
    -- Scenario A: Parent type changed - cascade to all children
    -- Only triggers if: (1) It's an UPDATE, (2) type actually changed, (3) it's a parent (no parent_id)
    IF TG_OP = 'UPDATE'
       AND NEW.type != OLD.type
       AND NEW.parent_id IS NULL THEN

        UPDATE categories
        SET type = NEW.type,
            updated_at = NOW()
        WHERE parent_id = NEW.id
          AND user_id = NEW.user_id;

        RAISE NOTICE 'Cascaded type change from parent % to % children', NEW.id, NEW.type;
    END IF;

    -- Scenario B: New child inserted - inherit parent's type
    -- Only triggers if: (1) It's an INSERT, (2) it has a parent_id
    IF TG_OP = 'INSERT'
       AND NEW.parent_id IS NOT NULL THEN

        NEW.type := (SELECT type FROM categories WHERE id = NEW.parent_id);

        RAISE NOTICE 'Child % inherited type % from parent %', NEW.id, NEW.type, NEW.parent_id;
    END IF;

    -- Scenario C: Child moved to different parent - adopt new parent's type
    -- Only triggers if: (1) It's an UPDATE, (2) it has a parent_id, (3) parent_id changed or newly assigned
    IF TG_OP = 'UPDATE'
       AND NEW.parent_id IS NOT NULL
       AND (OLD.parent_id IS NULL OR NEW.parent_id != OLD.parent_id) THEN

        NEW.type := (SELECT type FROM categories WHERE id = NEW.parent_id);

        RAISE NOTICE 'Child % adopted type % from new parent %', NEW.id, NEW.type, NEW.parent_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. Attach Trigger to Categories Table
-- ============================================================================
-- BEFORE INSERT OR UPDATE ensures the type is corrected BEFORE it's written to the database
-- This prevents race conditions and ensures atomic consistency

DROP TRIGGER IF EXISTS trg_sync_category_type_hierarchy ON categories;

CREATE TRIGGER trg_sync_category_type_hierarchy
BEFORE INSERT OR UPDATE ON categories
FOR EACH ROW
EXECUTE FUNCTION sync_category_type_hierarchy();

-- ============================================================================
-- 3. Fix Existing Data Inconsistencies (Data Migration)
-- ============================================================================
-- This one-time UPDATE corrects any existing parent-child type mismatches
-- Run this during low-traffic periods if you have a large dataset

UPDATE categories child
SET type = parent.type,
    updated_at = NOW()
FROM categories parent
WHERE child.parent_id = parent.id
  AND child.type != parent.type;

-- Log the number of rows fixed
-- If this returns > 0, you had data inconsistencies that are now resolved
```

**Expected Output**: Should show success and possibly update count if you had mismatched types.

---

## Migration 2: Update Categories View with Type Column

```sql
-- Migration: Update categories_with_counts View to Include Type Field
-- Purpose: Fix missing 'type' column in the view
-- Bug Fix: The view was created on Nov 30, but 'type' column was added to categories table on Dec 6
--          This migration adds the missing type field to the view

-- ============================================================================
-- Drop and Recreate categories_with_counts View with Type Field
-- ============================================================================
-- Note: We must DROP first because CREATE OR REPLACE doesn't allow changing column order
-- This is safe because views don't contain data, just query definitions

DROP VIEW IF EXISTS categories_with_counts CASCADE;

CREATE VIEW categories_with_counts AS
SELECT
    c.id,
    c.name,
    c.color,
    c.type,           -- ✅ Added: This field was missing from the original view
    c.user_id,
    c.created_at,
    c.updated_at,
    c.parent_id,
    COALESCE(COUNT(t.id), 0) AS transaction_count
FROM categories c
LEFT JOIN transactions t ON c.id = t.category_id
GROUP BY c.id, c.name, c.color, c.type, c.user_id, c.created_at, c.updated_at, c.parent_id;

-- ============================================================================
-- Notes
-- ============================================================================
-- The type field is critical for:
-- 1. Dashboard categorization (Income vs Expense sections)
-- 2. Category filtering in the UI
-- 3. Validation of parent-child type consistency
--
-- Without this field in the view, frontend components couldn't properly
-- display categories by their type when querying this view.
```

**Expected Output**: Should show success for view creation.

---

## ✅ Verification Queries

After running both migrations, run these queries to verify everything works:

### Check the trigger exists:
```sql
SELECT
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trg_sync_category_type_hierarchy';
```

### Check the view includes type field:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'categories_with_counts'
ORDER BY ordinal_position;
```

### Check for any type mismatches (should return 0 rows):
```sql
SELECT
    parent.id as parent_id,
    parent.name as parent_name,
    parent.type as parent_type,
    child.id as child_id,
    child.name as child_name,
    child.type as child_type
FROM categories parent
JOIN categories child ON child.parent_id = parent.id
WHERE parent.type != child.type;
```

---

## 🎉 Done!

Once you run these, your category hierarchy bug is completely fixed at all levels:
- ✅ Database enforcement (triggers)
- ✅ API layer (TypeScript interfaces)
- ✅ Frontend (form submission)
- ✅ Data views (includes type field)

Let me know if you see any errors when running these!
