-- ============================================================================
-- MIGRATION: Align Inbox with Ledger - Schema Parity
-- Purpose: Achieve 1:1 schema alignment between transaction_inbox and transactions
-- Date: 2025-12-28
-- ============================================================================

-- PART 1: Add notes column to transaction_inbox
-- Enables user annotations during scratchpad phase
ALTER TABLE public.transaction_inbox
ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN public.transaction_inbox.notes IS
'Optional notes or memo for the inbox item. Transferred to transaction.notes during promotion.';

-- PART 2: Add source_text column to transactions (Context Mirroring)
-- Natively holds raw context (OCR, import data) in the ledger
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS source_text text;

COMMENT ON COLUMN public.transactions.source_text IS
'Raw source context (OCR, bank import data, etc.) transferred from inbox. Separate from user notes field.';

-- PART 3: Add inbox_id to transactions (Birth Certificate)
-- Creates permanent audit trail from ledger back to inbox origin
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS inbox_id uuid;

-- Add foreign key constraint (nullable - not all transactions come from inbox)
ALTER TABLE public.transactions
ADD CONSTRAINT fk_transactions_inbox
FOREIGN KEY (inbox_id)
REFERENCES public.transaction_inbox(id)
ON DELETE SET NULL;  -- If inbox item deleted, just null the reference

COMMENT ON COLUMN public.transactions.inbox_id IS
'Tracks which inbox item this transaction was promoted from. Null for transactions created directly in the ledger.';

-- Create partial index for efficient reverse lookups (find transaction from inbox item)
CREATE INDEX IF NOT EXISTS idx_transactions_inbox_id
ON public.transactions(inbox_id)
WHERE inbox_id IS NOT NULL;

-- PART 4: Rename amount -> amount_original (Naming Standardization)
-- Aligns inbox column naming with ledger conventions
ALTER TABLE public.transaction_inbox
RENAME COLUMN amount TO amount_original;

-- PART 5: Rename currency -> currency_original (Naming Standardization)
-- Aligns inbox column naming with ledger conventions
ALTER TABLE public.transaction_inbox
RENAME COLUMN currency TO currency_original;

-- PART 6: Update transactions_view (CRITICAL)
-- Frontend consumes the VIEW, not the table directly
-- Must add new columns to make them visible to the UI

DROP VIEW IF EXISTS public.transactions_view;

CREATE VIEW public.transactions_view AS
SELECT
  -- Core transaction fields
  t.id,
  t.user_id,
  t.account_id,
  t.category_id,
  t.description,
  t.amount_original,
  t.amount_home,
  t.currency_original,
  t.exchange_rate,
  t.date,
  t.notes,
  t.source_text,        -- NEW: Raw source context
  t.inbox_id,           -- NEW: Birth certificate
  t.transfer_id,
  t.created_at,
  t.updated_at,

  -- Joined account fields (for display)
  a.name AS account_name,
  a.currency_code AS account_currency,
  a.color AS account_color,

  -- Joined category fields (for display)
  c.name AS category_name,
  c.color AS category_color,
  c.type AS category_type
FROM transactions t
LEFT JOIN bank_accounts a ON t.account_id = a.id
LEFT JOIN categories c ON t.category_id = c.id;

-- ============================================================================
-- VERIFICATION QUERIES (For manual testing after migration)
-- ============================================================================

-- Verify transaction_inbox columns
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'transaction_inbox'
-- AND column_name IN ('notes', 'amount_original', 'currency_original')
-- ORDER BY ordinal_position;

-- Verify transactions columns
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'transactions'
-- AND column_name IN ('source_text', 'inbox_id')
-- ORDER BY ordinal_position;

-- Verify foreign key
-- SELECT constraint_name, table_name, column_name
-- FROM information_schema.key_column_usage
-- WHERE constraint_name = 'fk_transactions_inbox';

-- Verify index
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'transactions'
-- AND indexname = 'idx_transactions_inbox_id';

-- Verify transactions_view columns
-- SELECT column_name
-- FROM information_schema.columns
-- WHERE table_name = 'transactions_view'
-- ORDER BY ordinal_position;
