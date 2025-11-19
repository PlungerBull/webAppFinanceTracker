-- Migration: Add color column to bank_accounts
-- Purpose: Allow users to assign colors to bank accounts for better visual organization
-- Date: 2025-01-19

-- Step 1: Add color column to bank_accounts table
ALTER TABLE bank_accounts
ADD COLUMN color TEXT;

-- Step 2: Set default color for all existing accounts
-- Using a neutral blue color (#3b82f6) for all existing accounts
UPDATE bank_accounts
SET color = '#3b82f6'
WHERE color IS NULL;

-- Step 3: Make color NOT NULL with default value
ALTER TABLE bank_accounts
ALTER COLUMN color SET DEFAULT '#3b82f6',
ALTER COLUMN color SET NOT NULL;

-- Step 4: Add check constraint to ensure color is a valid hex color
ALTER TABLE bank_accounts
ADD CONSTRAINT valid_color_format CHECK (color ~ '^#[0-9A-Fa-f]{6}$');

-- Step 5: Add comment for documentation
COMMENT ON COLUMN bank_accounts.color IS 'Hex color code for visual identification of the account (e.g., #3b82f6)';
