-- Fix: Clear User Data - Sacred Ledger Implementation
-- This migration fixes the clear_user_data function to:
-- 1. Add identity verification hard-gate for security
-- 2. Include transaction_inbox deletion (was missing)
-- 3. Optimize deletion order using CASCADE performance optimization
-- 4. Preserve user_settings table (environment preservation)

CREATE OR REPLACE FUNCTION public.clear_user_data(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_authenticated_user_id uuid;
BEGIN
  -- === HARD-GATE: Identity Verification ===
  -- Get the currently authenticated user from session
  v_authenticated_user_id := auth.uid();

  -- Security check: Verify requesting user matches authenticated session
  -- This prevents unauthorized data wipes even if endpoint is exposed
  IF v_authenticated_user_id IS NULL OR v_authenticated_user_id != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: User can only clear their own data';
  END IF;

  -- === SEQUENTIAL DEPENDENCY PURGE ===
  -- Order is critical to avoid FK constraint violations and maximize performance

  -- 1. The Scratchpad (Inbox): Delete all pending transaction inbox items
  --    Must go first: has FK refs to categories and accounts (no CASCADE)
  DELETE FROM transaction_inbox WHERE user_id = p_user_id;

  -- 2. The Foundation (Bank Accounts): CASCADE Performance Optimization
  --    Deleting accounts auto-deletes ALL transactions via CASCADE
  --    Balance update triggers become no-ops (account already gone)
  --    This is the "Sacred Ledger" optimization - one delete, thousands free
  DELETE FROM bank_accounts WHERE user_id = p_user_id;

  -- 3. Hierarchical Structure Cleanup: Untie the category knot
  --    categories_parent_id_fkey uses ON DELETE RESTRICT
  --    Must delete children before parents to avoid constraint violation
  DELETE FROM categories WHERE user_id = p_user_id AND parent_id IS NOT NULL;
  DELETE FROM categories WHERE user_id = p_user_id AND parent_id IS NULL;

  -- === PRESERVATION OF USER ENVIRONMENT ===
  -- user_settings table is NEVER touched here
  -- Theme, main_currency, start_of_week remain intact
  -- User returns to "Fresh Start" with their familiar environment

END;
$$;
