-- Add index for Activity Feed sorting (created_at DESC)
-- This mirrors the existing idx_transactions_user_date for Financial Ledger sorting
CREATE INDEX IF NOT EXISTS idx_transactions_user_created_at
ON public.transactions
USING btree (user_id, created_at DESC);

-- Comment for documentation
COMMENT ON INDEX idx_transactions_user_created_at IS
'Optimizes Activity Feed queries (ORDER BY created_at DESC) for Dual-Logic Ledger Architecture';
