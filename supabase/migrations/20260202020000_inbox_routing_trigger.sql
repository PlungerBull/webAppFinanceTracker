-- ============================================================================
-- MIGRATION: Inbox Routing Trigger
-- Purpose: Auto-route orphaned transactions to inbox instead of crashing
-- Date: 2026-02-02
--
-- CTO MANDATE: The database enforces business rules.
-- Orphaned data belongs in inbox, not the Sacred Ledger.
--
-- This is the ultimate safety net - if somehow a transaction with NULL
-- account_id makes it past all the application-layer guards (Push Engine,
-- RPC validation), the database will catch it and route to inbox.
-- ============================================================================

-- Create the routing function
CREATE OR REPLACE FUNCTION route_orphan_to_inbox()
RETURNS TRIGGER AS $$
BEGIN
  -- If transaction has no account_id, it belongs in inbox
  IF NEW.account_id IS NULL THEN
    -- Insert into inbox instead
    -- ON CONFLICT handles sync retries (idempotent)
    INSERT INTO transaction_inbox (
      id,
      user_id,
      amount_cents,
      description,
      date,
      source_text,
      category_id,
      status,
      notes,
      exchange_rate,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.user_id,
      NEW.amount_cents,
      COALESCE(NEW.description, 'Orphaned transaction'),
      NEW.date,
      NEW.source_text,
      NEW.category_id,
      'pending',
      COALESCE(NEW.notes, 'Auto-routed: Missing account_id'),
      COALESCE(NEW.exchange_rate, 1.0),
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;  -- Idempotent: handle sync retries

    -- Log for debugging (visible in Supabase logs)
    RAISE WARNING '[InboxRouter] Redirected orphan transaction % to inbox (missing account_id)', NEW.id;

    -- Prevent INSERT into transactions table
    RETURN NULL;
  END IF;

  -- Normal case: allow INSERT
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Attach trigger to transactions table
-- BEFORE INSERT ensures we intercept before constraints are checked
DROP TRIGGER IF EXISTS tr_route_orphan_to_inbox ON transactions;

CREATE TRIGGER tr_route_orphan_to_inbox
  BEFORE INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION route_orphan_to_inbox();

-- Document the trigger
COMMENT ON FUNCTION route_orphan_to_inbox() IS
'Safety net trigger function: Routes transactions with NULL account_id to transaction_inbox.
This is the database-level enforcement of the "Permissive Schema, Strict Ledger" strategy.
CTO Mandate: Orphaned data belongs in inbox, not the Sacred Ledger.';

COMMENT ON TRIGGER tr_route_orphan_to_inbox ON transactions IS
'Automatically routes transactions with NULL account_id to transaction_inbox.
This is the ultimate safety net - the database enforces the business rule.
Uses ON CONFLICT (id) DO NOTHING for idempotency during sync retries.';
