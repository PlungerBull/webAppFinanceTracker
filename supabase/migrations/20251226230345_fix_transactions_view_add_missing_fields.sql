-- Fix transactions_view to include missing fields needed for editing
--
-- Problem: The view only had display names (account_name, category_name)
-- but not the IDs (account_id, category_id) needed for editing transactions
-- in the detail panel.
--
-- This migration adds all missing fields from the transactions table
-- and additional joined fields for better UI display.

-- Drop the existing view first (PostgreSQL won't let us change column order)
DROP VIEW IF EXISTS transactions_view;

-- Recreate with all necessary fields
CREATE VIEW transactions_view AS
SELECT
  -- Core transaction fields
  t.id,
  t.user_id,
  t.account_id,         -- ADDED: Required for editing
  t.category_id,        -- ADDED: Required for editing
  t.description,
  t.amount_original,
  t.amount_home,
  t.currency_original,
  t.exchange_rate,      -- ADDED: Required for editing/display
  t.date,
  t.notes,              -- ADDED: Required for editing
  t.transfer_id,        -- ADDED: For transfer identification
  t.created_at,         -- ADDED: Audit trail
  t.updated_at,         -- ADDED: Audit trail

  -- Joined account fields (for display)
  a.name AS account_name,
  a.currency_code AS account_currency,
  a.color AS account_color,     -- ADDED: For UI color indicators

  -- Joined category fields (for display)
  c.name AS category_name,
  c.color AS category_color,    -- ADDED: For UI color indicators
  c.type AS category_type
FROM transactions t
LEFT JOIN bank_accounts a ON t.account_id = a.id
LEFT JOIN categories c ON t.category_id = c.id;
