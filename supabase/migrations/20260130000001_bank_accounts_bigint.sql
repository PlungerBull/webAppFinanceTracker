-- ============================================================================
-- MIGRATION: Convert bank_accounts to BIGINT Integer Cents
-- Purpose: Complete the BIGINT ledger standardization for account balances
-- Date: 2026-01-30
-- ============================================================================
--
-- S-TIER PRINCIPLE: Once you move to BIGINT (cents), NEVER convert back to
-- NUMERIC for core balance storage. This migration completes the ledger
-- standardization by converting bank_accounts.current_balance to BIGINT.
--
-- This migration:
--   1. Adds current_balance_cents (BIGINT) to bank_accounts
--   2. Migrates data from current_balance (NUMERIC) to current_balance_cents
--   3. Updates update_account_balance_ledger trigger for pure BIGINT arithmetic
--   4. Updates reconcile_account_balance function for BIGINT
--   5. Drops old current_balance (NUMERIC) column
--
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ADD NEW BIGINT COLUMN
-- ============================================================================

ALTER TABLE bank_accounts
ADD COLUMN IF NOT EXISTS current_balance_cents BIGINT DEFAULT 0;

-- ============================================================================
-- 2. MIGRATE EXISTING DATA (NUMERIC -> BIGINT)
-- ============================================================================
-- Note: current_balance may not exist if this is a fresh install
-- Using dynamic check to handle both scenarios

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_accounts' AND column_name = 'current_balance'
  ) THEN
    UPDATE bank_accounts
    SET current_balance_cents = ROUND(current_balance * 100)::BIGINT
    WHERE current_balance IS NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- 3. UPDATE TRIGGER: update_account_balance_ledger (PURE BIGINT)
-- ============================================================================
-- S-TIER: Uses amount_cents directly without any NUMERIC conversion

CREATE OR REPLACE FUNCTION public.update_account_balance_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Handle DELETES (Subtract old amount in integer cents)
    IF (TG_OP = 'DELETE') THEN
        UPDATE bank_accounts
        SET current_balance_cents = current_balance_cents - OLD.amount_cents
        WHERE id = OLD.account_id;
        RETURN OLD;

    -- Handle INSERTS (Add new amount in integer cents)
    ELSIF (TG_OP = 'INSERT') THEN
        UPDATE bank_accounts
        SET current_balance_cents = current_balance_cents + NEW.amount_cents
        WHERE id = NEW.account_id;
        RETURN NEW;

    -- Handle UPDATES (Subtract old, Add new in integer cents)
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.amount_cents <> NEW.amount_cents) OR (OLD.account_id <> NEW.account_id) THEN
            -- Revert old impact
            UPDATE bank_accounts
            SET current_balance_cents = current_balance_cents - OLD.amount_cents
            WHERE id = OLD.account_id;

            -- Apply new impact
            UPDATE bank_accounts
            SET current_balance_cents = current_balance_cents + NEW.amount_cents
            WHERE id = NEW.account_id;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$;

-- ============================================================================
-- 4. UPDATE FUNCTION: reconcile_account_balance (BIGINT)
-- ============================================================================
-- Accepts NUMERIC input for user convenience, converts to cents internally

CREATE OR REPLACE FUNCTION public.reconcile_account_balance(
  p_account_id uuid,
  p_new_balance numeric,
  p_date timestamp with time zone DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_current_balance_cents BIGINT;
    v_new_balance_cents BIGINT;
    v_delta_cents BIGINT;
    v_txn_id uuid;
    v_account_currency text;
    v_user_id uuid;
BEGIN
    -- Convert input to cents
    v_new_balance_cents := ROUND(p_new_balance * 100)::BIGINT;

    -- 1. Get current state (now in cents)
    SELECT current_balance_cents, currency_code, user_id
    INTO v_current_balance_cents, v_account_currency, v_user_id
    FROM bank_accounts
    WHERE id = p_account_id;

    -- 2. Calculate the difference in cents
    v_delta_cents := v_new_balance_cents - v_current_balance_cents;

    -- 3. If no change, do nothing
    IF v_delta_cents = 0 THEN
        RETURN NULL;
    END IF;

    -- 4. Create the Adjustment Transaction (BIGINT cents)
    INSERT INTO transactions (
        user_id,
        account_id,
        date,
        description,
        amount_cents,
        amount_home_cents,
        exchange_rate,
        category_id
    ) VALUES (
        v_user_id,
        p_account_id,
        p_date,
        'Manual Balance Reconciliation',
        v_delta_cents,
        v_delta_cents,  -- Same currency, rate = 1
        1.0,
        NULL
    ) RETURNING id INTO v_txn_id;

    RETURN v_txn_id;
END;
$$;

-- ============================================================================
-- 5. DROP OLD COLUMN (Point of no return)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_accounts' AND column_name = 'current_balance'
  ) THEN
    ALTER TABLE bank_accounts DROP COLUMN current_balance;
  END IF;
END $$;

-- ============================================================================
-- 6. SET NOT NULL CONSTRAINT
-- ============================================================================

ALTER TABLE bank_accounts
ALTER COLUMN current_balance_cents SET NOT NULL;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

ALTER FUNCTION public.update_account_balance_ledger() OWNER TO postgres;

ALTER FUNCTION public.reconcile_account_balance(uuid, numeric, timestamp with time zone) OWNER TO postgres;
GRANT ALL ON FUNCTION public.reconcile_account_balance(uuid, numeric, timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.reconcile_account_balance(uuid, numeric, timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.reconcile_account_balance(uuid, numeric, timestamp with time zone) TO service_role;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN bank_accounts.current_balance_cents IS
'[HARDENED 2026-01-30] Account balance in integer cents (BIGINT). S-Tier: Pure integer arithmetic, no NUMERIC conversion.';

COMMENT ON FUNCTION public.update_account_balance_ledger() IS
'[HARDENED 2026-01-30] Maintains bank_accounts.current_balance_cents using pure BIGINT arithmetic.
Uses amount_cents directly without any NUMERIC conversion. Part of Sacred Integer Ledger.';

COMMENT ON FUNCTION public.reconcile_account_balance(uuid, numeric, timestamp with time zone) IS
'[HARDENED 2026-01-30] Reconciles account balance to target value using BIGINT cents.
Accepts NUMERIC input for user convenience, converts to cents internally via ROUND(val * 100)::BIGINT.';

COMMIT;
