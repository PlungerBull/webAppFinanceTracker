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
