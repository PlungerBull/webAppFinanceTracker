-- Migration: Create transactions_enriched view
-- Purpose: Pre-join transactions with categories and accounts at the database layer
--          to eliminate client-side joins and improve query performance at scale
-- Created: 2025-11-22

-- Drop view if it exists (for idempotency)
DROP VIEW IF EXISTS transactions_enriched;

-- Create the enriched transactions view
-- This view joins transactions with their related categories and accounts
-- Uses LEFT JOIN for categories (transactions can be uncategorized)
-- Uses INNER JOIN for accounts (every transaction must have an account)
CREATE VIEW transactions_enriched
WITH (security_invoker = true)  -- Respects RLS policies on base tables
AS
SELECT
    -- All transaction columns
    t.id,
    t.user_id,
    t.description,
    t.amount_original,
    t.amount_home,
    t.date,
    t.category_id,
    t.account_id,
    t.currency_original,
    t.exchange_rate,
    t.notes,
    t.created_at,
    t.updated_at,
    
    -- Denormalized category information (nullable for uncategorized transactions)
    c.name as category_name,
    c.color as category_color,
    
    -- Denormalized account information
    a.name as account_name,
    a.color as account_color
FROM transactions t
LEFT JOIN categories c ON t.category_id = c.id
INNER JOIN bank_accounts a ON t.account_id = a.id;

-- Grant select permission to authenticated users
GRANT SELECT ON transactions_enriched TO authenticated;

-- Add comment for documentation
COMMENT ON VIEW transactions_enriched IS 
  'Enriched transactions view with pre-joined category and account information. Uses security_invoker to respect RLS policies.';
