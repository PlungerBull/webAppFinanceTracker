-- Function to migrate global categories to user-specific categories
CREATE OR REPLACE FUNCTION migrate_and_remove_default_categories()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    r RECORD;
    new_category_id UUID;
    global_category RECORD;
BEGIN
    -- Loop through all transactions that are using a global category (where category.user_id is NULL)
    FOR r IN 
        SELECT DISTINCT t.user_id, t.category_id
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE c.user_id IS NULL
    LOOP
        -- Get the global category details
        SELECT * INTO global_category FROM categories WHERE id = r.category_id;

        -- Check if the user already has a category with the same name
        SELECT id INTO new_category_id
        FROM categories
        WHERE user_id = r.user_id AND name = global_category.name
        LIMIT 1;

        -- If not, create a new category for the user
        IF new_category_id IS NULL THEN
            INSERT INTO categories (user_id, name, color, is_default)
            VALUES (r.user_id, global_category.name, global_category.color, false)
            RETURNING id INTO new_category_id;
        END IF;

        -- Update transactions to use the new user-specific category
        UPDATE transactions
        SET category_id = new_category_id
        WHERE user_id = r.user_id AND category_id = r.category_id;
    END LOOP;

    -- Now that no transactions reference global categories, delete them
    DELETE FROM categories WHERE user_id IS NULL;
END;
$$;

-- Execute the migration
SELECT migrate_and_remove_default_categories();

-- Drop the function
DROP FUNCTION migrate_and_remove_default_categories();
