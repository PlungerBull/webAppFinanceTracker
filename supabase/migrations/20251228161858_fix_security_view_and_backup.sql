-- ============================================================================
-- SECURITY HARDENING: Fix View RLS Bypass & Hide Backup Artifact
-- ============================================================================
--
-- Problem 1: transactions_view uses SECURITY DEFINER (implicit default)
--   - Executes with view creator's privileges, bypassing RLS policies
--   - Allows potential exposure of other users' transactions
--
-- Problem 2: transactions_currency_cleanup_backup exists in public schema
--   - Accessible via API without RLS protection
--   - Contains historical transaction data from Sacred Ledger migration
--
-- Solution:
--   1. ALTER VIEW to enforce security_invoker mode (user-context execution)
--   2. Move backup table to internal schema (removes from API surface)
-- ============================================================================

-- 1. SECURE THE VIEW
-- Switch from SECURITY DEFINER to SECURITY INVOKER.
-- This forces the view to run with the permissions of the querying user,
-- ensuring it respects the RLS policies on the underlying 'transactions' table.
ALTER VIEW public.transactions_view
SET (security_invoker = true);

-- 2. HIDE THE BACKUP ARTIFACT
-- Create a private 'internal' schema if it doesn't exist.
CREATE SCHEMA IF NOT EXISTS internal;

-- Move the backup table out of 'public' so it is no longer exposed via the API.
ALTER TABLE public.transactions_currency_cleanup_backup
SET SCHEMA internal;
