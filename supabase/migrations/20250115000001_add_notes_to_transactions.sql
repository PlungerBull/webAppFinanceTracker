-- Add notes column to transactions table
ALTER TABLE transactions
ADD COLUMN notes TEXT;

-- Add comment to describe the column
COMMENT ON COLUMN transactions.notes IS 'Optional notes or memo for the transaction';
