-- Migration: Fix Category Hierarchy (Align with Debrief)
-- Timestamp: 20251130101500

BEGIN;

-- 1. Drop the stub orphan trigger and function if they exist
DROP TRIGGER IF EXISTS trg_handle_orphaned_categories ON categories;
DROP FUNCTION IF EXISTS handle_orphaned_categories();

-- 2. Modify transactions foreign key to ON DELETE CASCADE
-- First drop the existing constraint
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_category_id_fkey;

-- Re-add with CASCADE
ALTER TABLE transactions 
ADD CONSTRAINT transactions_category_id_fkey 
FOREIGN KEY (category_id) 
REFERENCES categories(id) 
ON DELETE CASCADE;

-- 3. Create Manual Cleanup Function for Orphans
CREATE OR REPLACE FUNCTION cleanup_orphaned_categories()
RETURNS void AS $$
DECLARE
    unassigned_id UUID;
    user_record RECORD;
BEGIN
    -- Loop through users who have potential orphans (categories pointing to non-existent parents)
    -- Note: This should not happen with FK RESTRICT, but this is for data corruption recovery.
    FOR user_record IN 
        SELECT DISTINCT c.user_id 
        FROM categories c
        LEFT JOIN categories p ON c.parent_id = p.id
        WHERE c.parent_id IS NOT NULL AND p.id IS NULL
    LOOP
        -- Find or create 'Un-assigned' parent for this user
        SELECT id INTO unassigned_id 
        FROM categories 
        WHERE user_id = user_record.user_id AND name = 'Un-assigned' AND parent_id IS NULL 
        LIMIT 1;

        IF unassigned_id IS NULL THEN
            INSERT INTO categories (name, color, user_id, parent_id, created_at, updated_at)
            VALUES ('Un-assigned', '#6B7280', user_record.user_id, NULL, NOW(), NOW())
            RETURNING id INTO unassigned_id;
        END IF;

        -- Reassign orphans to 'Un-assigned'
        UPDATE categories c
        SET parent_id = unassigned_id
        WHERE c.user_id = user_record.user_id
        AND c.parent_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM categories p WHERE p.id = c.parent_id);
        
    END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMIT;
