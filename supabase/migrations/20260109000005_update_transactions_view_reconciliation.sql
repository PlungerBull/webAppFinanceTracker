-- ============================================================================
-- MIGRATION: Update transactions_view with Reconciliation Data
-- Purpose: Add reconciliation_id and cleared to transactions_view
-- Date: 2026-01-09
-- ============================================================================

-- Drop existing view
DROP VIEW IF EXISTS public.transactions_view;

-- Recreate view with reconciliation fields
CREATE VIEW public.transactions_view
WITH (security_invoker = true)
AS
SELECT
    -- Core transaction fields
    t.id,
    t.user_id,
    t.account_id,
    t.category_id,
    t.description,
    t.amount_original,
    t.amount_home,
    t.exchange_rate,
    t.date,
    t.notes,
    t.source_text,
    t.inbox_id,
    t.transfer_id,
    t.reconciliation_id,  -- NEW
    t.cleared,            -- NEW
    t.created_at,
    t.updated_at,

    -- Joined account data (currency aliased from account)
    a.name AS account_name,
    a.currency_code AS currency_original,  -- ALIASED for frontend compatibility
    a.currency_code AS account_currency,   -- Also exposed for clarity
    a.color AS account_color,

    -- Joined category data
    c.name AS category_name,
    c.color AS category_color,
    c.type AS category_type
FROM public.transactions t
LEFT JOIN public.bank_accounts a ON t.account_id = a.id
LEFT JOIN public.categories c ON t.category_id = c.id;

COMMENT ON VIEW public.transactions_view IS
'Enriched transaction view with joined account and category display data. Includes reconciliation_id and cleared flag for audit workspace. Uses security_invoker = true to enforce RLS policies.';
