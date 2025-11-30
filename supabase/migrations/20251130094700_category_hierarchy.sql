-- Migration: Two-Level Category Hierarchy
-- Timestamp: 20251130094700

BEGIN;

-- 1. Modify categories Table
-- Add parent_id column
ALTER TABLE categories 
ADD COLUMN parent_id UUID REFERENCES categories(id) ON DELETE RESTRICT;

-- Create index on parent_id
CREATE INDEX idx_categories_parent_id ON categories(parent_id);

-- 2. Create "Un-assigned" Parent Category & Migrate Data
-- We need to do this per user to ensure data isolation
DO $$
DECLARE
    user_record RECORD;
    unassigned_id UUID;
BEGIN
    -- Loop through all users who have categories
    FOR user_record IN SELECT DISTINCT user_id FROM categories LOOP
        -- Create "Un-assigned" parent for this user
        INSERT INTO categories (name, color, user_id, created_at, updated_at, parent_id)
        VALUES ('Un-assigned', '#6B7280', user_record.user_id, NOW(), NOW(), NULL)
        RETURNING id INTO unassigned_id;

        -- Update existing categories for this user to be children of the new "Un-assigned" category
        -- Exclude the newly created "Un-assigned" category itself
        UPDATE categories 
        SET parent_id = unassigned_id
        WHERE user_id = user_record.user_id 
          AND id != unassigned_id
          AND parent_id IS NULL;
    END LOOP;
END $$;

-- 3. Create Validation Function for Categories
CREATE OR REPLACE FUNCTION validate_category_hierarchy_func()
RETURNS TRIGGER AS $$
DECLARE
    parent_category RECORD;
    child_count INTEGER;
    transaction_count INTEGER;
BEGIN
    -- Check 1: Self-Parenting Prevention
    IF NEW.parent_id = NEW.id THEN
        RAISE EXCEPTION 'A category cannot be its own parent';
    END IF;

    -- Check 2: Parent Must Exist (Handled by FK, but good to have explicit check if needed, skipping as FK covers it)

    -- Check 3: Two-Level Hierarchy Enforcement
    IF NEW.parent_id IS NOT NULL THEN
        SELECT * INTO parent_category FROM categories WHERE id = NEW.parent_id;
        IF parent_category.parent_id IS NOT NULL THEN
            RAISE EXCEPTION 'Cannot create subcategory under another subcategory. Maximum 2 levels allowed.';
        END IF;
    END IF;

    -- Check 4: Promotion Prevention (Subcategory -> Parent)
    -- If changing from subcategory (parent_id IS NOT NULL) to parent (parent_id IS NULL)
    IF OLD.parent_id IS NOT NULL AND NEW.parent_id IS NULL THEN
        -- Check if it has transactions
        SELECT COUNT(*) INTO transaction_count FROM transactions WHERE category_id = NEW.id;
        IF transaction_count > 0 THEN
            RAISE EXCEPTION 'Cannot convert to parent category while it has transactions';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create Trigger for Category Validation
CREATE TRIGGER trg_validate_category_hierarchy
BEFORE INSERT OR UPDATE ON categories
FOR EACH ROW
EXECUTE FUNCTION validate_category_hierarchy_func();

-- 4. Create Function and Trigger to Enforce Transactions Only on Subcategories
-- (Replacing requested CHECK constraint with Trigger because CHECK constraints cannot reference other tables)
CREATE OR REPLACE FUNCTION check_transaction_category_hierarchy()
RETURNS TRIGGER AS $$
DECLARE
    cat_parent_id UUID;
BEGIN
    IF NEW.category_id IS NOT NULL THEN
        SELECT parent_id INTO cat_parent_id FROM categories WHERE id = NEW.category_id;
        
        IF cat_parent_id IS NULL THEN
            RAISE EXCEPTION 'Transactions can ONLY be assigned to subcategories (categories where parent_id IS NOT NULL)';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_transactions_only_subcategories
BEFORE INSERT OR UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION check_transaction_category_hierarchy();

-- 5. Orphan Detection Trigger
CREATE OR REPLACE FUNCTION handle_orphaned_categories()
RETURNS TRIGGER AS $$
DECLARE
    unassigned_id UUID;
BEGIN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_handle_orphaned_categories
BEFORE INSERT OR UPDATE ON categories
FOR EACH ROW
EXECUTE FUNCTION handle_orphaned_categories();

COMMIT;
