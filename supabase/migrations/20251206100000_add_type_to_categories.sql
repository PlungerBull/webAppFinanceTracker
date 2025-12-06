-- Add type column to categories table
-- This makes category the single source of truth for transaction type (income/expense)

-- Add type column with default 'expense'
ALTER TABLE categories
ADD COLUMN type TEXT CHECK (type IN ('income', 'expense')) DEFAULT 'expense';

-- Set NOT NULL constraint
ALTER TABLE categories
ALTER COLUMN type SET NOT NULL;

-- Add index for performance (we'll be filtering by type frequently)
CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type);

-- Add comment to document the column
COMMENT ON COLUMN categories.type IS 'Category type: income or expense. Determines the default direction of transactions using this category.';
