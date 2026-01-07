-- Drop temporary backup table from account balance currency fix migration
-- Original migration: 20251229015648_fix_account_balance_currency_bug.sql
-- This backup served its purpose (validation/rollback safety) and is no longer needed
-- Resolves RLS security warning: table in public schema without RLS policies

DROP TABLE IF EXISTS public.account_balance_currency_fix_backup;
