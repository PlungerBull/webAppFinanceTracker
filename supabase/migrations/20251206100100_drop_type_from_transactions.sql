-- Verify and drop type column from transactions table if it exists
-- Transaction types are now determined implicitly:
-- - transfer_id IS NOT NULL → Transfer
-- - category_id IS NULL AND transfer_id IS NULL → Opening Balance
-- - category_id IS NOT NULL → Standard Transaction (type from category)

DO $$
BEGIN
    -- Check if type column exists in transactions table
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'transactions'
        AND column_name = 'type'
    ) THEN
        -- Drop the column if it exists
        ALTER TABLE transactions DROP COLUMN type;
        RAISE NOTICE 'Dropped type column from transactions table';
    ELSE
        -- Column doesn't exist, nothing to do
        RAISE NOTICE 'No type column found in transactions table - nothing to drop';
    END IF;
END $$;

-- Add comment to document the implicit type system
COMMENT ON TABLE transactions IS 'Transactions table. Type is determined implicitly: transfer (transfer_id NOT NULL), opening balance (category_id NULL and transfer_id NULL), or standard (category_id NOT NULL with type from category).';
