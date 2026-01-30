-- ============================================================================
-- MIGRATION: Convert Reconciliations to BIGINT Integer Cents
-- Purpose: S-Tier consistency - eliminate NUMERIC from reconciliation balances
-- Date: 2026-01-30
-- ============================================================================
--
-- S-TIER PRINCIPLE: Reconciliation math compares user-input balances against
-- ledger sums. Both must use BIGINT cents to ensure mathematical determinism.
--
-- This migration:
--   1. Converts beginning_balance and ending_balance to BIGINT cents
--   2. Updates get_reconciliation_summary RPC for BIGINT arithmetic
--   3. Aligns all reconciliation operations with the Sacred Integer Ledger
--
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ADD NEW BIGINT COLUMNS
-- ============================================================================

ALTER TABLE reconciliations
ADD COLUMN IF NOT EXISTS beginning_balance_cents BIGINT,
ADD COLUMN IF NOT EXISTS ending_balance_cents BIGINT;

-- ============================================================================
-- 2. MIGRATE EXISTING DATA (NUMERIC -> BIGINT)
-- ============================================================================

UPDATE reconciliations
SET
  beginning_balance_cents = ROUND(beginning_balance * 100)::BIGINT,
  ending_balance_cents = ROUND(ending_balance * 100)::BIGINT
WHERE beginning_balance IS NOT NULL;

-- ============================================================================
-- 3. DROP OLD COLUMNS
-- ============================================================================

ALTER TABLE reconciliations
DROP COLUMN IF EXISTS beginning_balance,
DROP COLUMN IF EXISTS ending_balance;

-- ============================================================================
-- 4. SET NOT NULL CONSTRAINTS
-- ============================================================================

ALTER TABLE reconciliations
ALTER COLUMN beginning_balance_cents SET NOT NULL,
ALTER COLUMN ending_balance_cents SET NOT NULL;

-- Set defaults for future inserts
ALTER TABLE reconciliations
ALTER COLUMN beginning_balance_cents SET DEFAULT 0,
ALTER COLUMN ending_balance_cents SET DEFAULT 0;

-- ============================================================================
-- 5. UPDATE RPC: get_reconciliation_summary (BIGINT)
-- ============================================================================
-- Uses amount_cents for account-native currency matching
-- All math in integer cents for precision

CREATE OR REPLACE FUNCTION public.get_reconciliation_summary(
    p_reconciliation_id UUID
) RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
    v_user_id UUID;
    v_beginning_balance_cents BIGINT;
    v_ending_balance_cents BIGINT;
    v_linked_sum_cents BIGINT;
    v_difference_cents BIGINT;
    v_linked_count INTEGER;
BEGIN
    -- 1. Get authenticated user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- 2. Get reconciliation balances (now BIGINT cents)
    SELECT beginning_balance_cents, ending_balance_cents
    INTO v_beginning_balance_cents, v_ending_balance_cents
    FROM public.reconciliations
    WHERE id = p_reconciliation_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reconciliation not found or access denied';
    END IF;

    -- 3. Calculate sum of linked transactions (amount_cents = account native currency)
    -- HARDENED: Uses amount_cents (BIGINT) for pure integer arithmetic
    SELECT COALESCE(SUM(amount_cents), 0), COUNT(*)
    INTO v_linked_sum_cents, v_linked_count
    FROM public.transactions
    WHERE reconciliation_id = p_reconciliation_id AND user_id = v_user_id;

    -- 4. Calculate difference: Ending Balance - (Beginning Balance + Linked Sum)
    -- Pure BIGINT arithmetic - no floating-point conversion
    v_difference_cents := v_ending_balance_cents - (v_beginning_balance_cents + v_linked_sum_cents);

    -- 5. Return summary (all values in cents)
    RETURN jsonb_build_object(
        'beginningBalanceCents', v_beginning_balance_cents,
        'endingBalanceCents', v_ending_balance_cents,
        'linkedSumCents', v_linked_sum_cents,
        'linkedCount', v_linked_count,
        'differenceCents', v_difference_cents,
        'isBalanced', v_difference_cents = 0
    );
END;
$$;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

ALTER FUNCTION public.get_reconciliation_summary(UUID) OWNER TO postgres;
GRANT ALL ON FUNCTION public.get_reconciliation_summary(UUID) TO anon;
GRANT ALL ON FUNCTION public.get_reconciliation_summary(UUID) TO authenticated;
GRANT ALL ON FUNCTION public.get_reconciliation_summary(UUID) TO service_role;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN reconciliations.beginning_balance_cents IS
'[HARDENED 2026-01-30] Beginning balance in integer cents (BIGINT). S-Tier: Pure integer arithmetic.';

COMMENT ON COLUMN reconciliations.ending_balance_cents IS
'[HARDENED 2026-01-30] Ending balance in integer cents (BIGINT). S-Tier: Pure integer arithmetic.';

COMMENT ON FUNCTION public.get_reconciliation_summary(UUID) IS
'[HARDENED 2026-01-30] Calculate real-time reconciliation math using BIGINT cents.
Formula: Difference = Ending Balance - (Beginning Balance + Linked Sum)
Returns all values in cents for frontend conversion via fromCents().
Uses amount_cents for account-native currency matching.';

COMMIT;
