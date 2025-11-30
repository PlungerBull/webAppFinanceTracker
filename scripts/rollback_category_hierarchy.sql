-- Rollback Migration: Two-Level Category Hierarchy

BEGIN;

-- 1. Drop Triggers and Functions
DROP TRIGGER IF EXISTS trg_handle_orphaned_categories ON categories;
DROP FUNCTION IF EXISTS handle_orphaned_categories;

DROP TRIGGER IF EXISTS trg_check_transactions_only_subcategories ON transactions;
DROP FUNCTION IF EXISTS check_transaction_category_hierarchy;

DROP TRIGGER IF EXISTS trg_validate_category_hierarchy ON categories;
DROP FUNCTION IF EXISTS validate_category_hierarchy_func;

-- 2. Drop Constraints and Indexes
-- Note: We used a Trigger for transactions check, so no CHECK constraint to drop there (unless we added one, but we didn't).
-- If we had added a CHECK constraint:
-- ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_only_subcategories;

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_parent_id_fkey;
DROP INDEX IF EXISTS idx_categories_parent_id;

-- 3. Revert Data (Optional - Flatten Hierarchy)
-- We can't easily "undo" the grouping into "Un-assigned" without losing the knowledge of which were roots before (none were roots in the new system, all were flat).
-- But we can just set parent_id to NULL for all categories.
UPDATE categories SET parent_id = NULL;

-- 4. Delete "Un-assigned" categories
DELETE FROM categories WHERE name = 'Un-assigned';

-- 5. Drop Column
ALTER TABLE categories DROP COLUMN parent_id;

COMMIT;
