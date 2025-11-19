-- Drop old view first
DROP VIEW IF EXISTS account_balances;

-- Create view with color column included
CREATE VIEW account_balances 
WITH (security_invoker = true)
AS
SELECT
    ac.id,
    ba.id as account_id,
    ba.user_id,
    ba.name,
    ba.color, -- Added color column
    ac.currency_code as currency,
    ac.starting_balance,
    COALESCE(SUM(t.amount_original), 0) as transaction_sum,
    ac.starting_balance + COALESCE(SUM(t.amount_original), 0) as current_balance,
    ba.created_at,
    ba.updated_at
FROM account_currencies ac
JOIN bank_accounts ba ON ba.id = ac.account_id
LEFT JOIN transactions t ON t.account_id = ac.account_id AND t.currency_original = ac.currency_code
GROUP BY ac.id, ba.id, ba.user_id, ba.name, ba.color, ac.currency_code, ac.starting_balance, ba.created_at, ba.updated_at;

-- Grant select permission to authenticated users
GRANT SELECT ON account_balances TO authenticated;
