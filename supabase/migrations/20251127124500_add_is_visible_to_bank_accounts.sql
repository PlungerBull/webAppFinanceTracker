-- 1. Add the column (Safe to run)
ALTER TABLE bank_accounts 
ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Update the View (Using the NEW Architecture)
DROP VIEW IF EXISTS account_balances;

CREATE OR REPLACE VIEW account_balances AS
SELECT 
    ba.id AS account_id,
    ba.user_id,
    ba.name,
    ba.color,
    ba.is_visible,  -- <--- Added this new column
    ac.currency_code AS currency,
    -- New Logic: Balance is sum of ALL transactions (no starting_balance column)
    COALESCE(SUM(t.amount_original), 0) AS current_balance,
    ba.created_at,
    ba.updated_at
FROM bank_accounts ba
JOIN account_currencies ac ON ba.id = ac.account_id
LEFT JOIN transactions t ON ac.account_id = t.account_id AND ac.currency_code = t.currency_original
GROUP BY 
    ba.id, 
    ba.user_id, 
    ba.name, 
    ba.color, 
    ba.is_visible, -- <--- Added to Group By
    ac.currency_code, 
    ba.created_at, 
    ba.updated_at;
