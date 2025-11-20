-- Function to assign a default category to transactions with no category
CREATE OR REPLACE FUNCTION assign_default_category_to_orphans()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    r RECORD;
    default_category_id UUID;
BEGIN
    -- Iterate through all users who have transactions with no category
    FOR r IN 
        SELECT DISTINCT user_id 
        FROM transactions 
        WHERE category_id IS NULL
    LOOP
        -- Find the first available category for this user
        SELECT id INTO default_category_id
        FROM categories
        WHERE user_id = r.user_id OR user_id IS NULL
        ORDER BY is_default DESC, name ASC
        LIMIT 1;

        -- If a category is found, update the transactions
        IF default_category_id IS NOT NULL THEN
            UPDATE transactions
            SET category_id = default_category_id
            WHERE user_id = r.user_id AND category_id IS NULL;
        END IF;
    END LOOP;
END;
$$;

-- Execute the function
SELECT assign_default_category_to_orphans();

-- Drop the function as it's a one-time migration
DROP FUNCTION assign_default_category_to_orphans();
