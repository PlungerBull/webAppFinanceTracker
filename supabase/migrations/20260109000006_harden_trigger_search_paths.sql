-- ============================================================================
-- MIGRATION: Harden Trigger Function Search Paths
-- Purpose: Fix Supabase Security Advisor warnings for Search Path Hijacking
-- Date: 2026-01-09
-- Security: Add explicit search_path to prevent schema shadowing attacks
-- ============================================================================

-- Function 1: check_reconciliation_date_overlap()
-- Prevents overlapping reconciliation date ranges for the same account
CREATE OR REPLACE FUNCTION public.check_reconciliation_date_overlap()
RETURNS TRIGGER
SET search_path TO ''
AS $$
DECLARE
    v_overlap_count INTEGER;
BEGIN
    -- Only check if date range is specified
    IF NEW.date_start IS NOT NULL AND NEW.date_end IS NOT NULL THEN
        -- Check for overlapping reconciliations on the same account
        SELECT COUNT(*) INTO v_overlap_count
        FROM public.reconciliations
        WHERE account_id = NEW.account_id
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
          AND date_start IS NOT NULL
          AND date_end IS NOT NULL
          AND (
              -- Check if date ranges overlap
              (NEW.date_start, NEW.date_end) OVERLAPS (date_start, date_end)
          );

        IF v_overlap_count > 0 THEN
            RAISE EXCEPTION 'Reconciliation date range conflict: Another reconciliation for this account overlaps with the period % to %.',
                NEW.date_start::DATE,
                NEW.date_end::DATE
                USING HINT = 'Each reconciliation period should be distinct for the same account.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.check_reconciliation_date_overlap() IS
'Prevents overlapping reconciliation date ranges for the same account. Ensures each time period is reconciled only once. Hardened with SET search_path to prevent schema hijacking.';


-- Function 2: auto_set_cleared_flag()
-- Auto-manages the cleared flag when reconciliation_id changes
CREATE OR REPLACE FUNCTION public.auto_set_cleared_flag()
RETURNS TRIGGER
SET search_path TO ''
AS $$
BEGIN
    -- Auto-set cleared=TRUE when reconciliation_id is set
    IF NEW.reconciliation_id IS NOT NULL THEN
        NEW.cleared := TRUE;
    ELSIF NEW.reconciliation_id IS NULL THEN
        NEW.cleared := FALSE;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.auto_set_cleared_flag() IS
'Auto-manages cleared flag (do not set manually). TRUE when linked to reconciliation, FALSE otherwise. Hardened with SET search_path to prevent schema hijacking.';


-- Function 3: check_reconciliation_account_match()
-- Sacred Ledger Hard Gate: Enforces transaction-reconciliation account match
CREATE OR REPLACE FUNCTION public.check_reconciliation_account_match()
RETURNS TRIGGER
SET search_path TO ''
AS $$
DECLARE
    v_reconciliation_account_id UUID;
BEGIN
    -- Only check if transaction is linked to a reconciliation
    IF NEW.reconciliation_id IS NOT NULL THEN
        -- Get the account_id from the reconciliation
        SELECT account_id INTO v_reconciliation_account_id
        FROM public.reconciliations
        WHERE id = NEW.reconciliation_id;

        -- Enforce hard gate: transaction.account_id MUST match reconciliation.account_id
        IF NEW.account_id != v_reconciliation_account_id THEN
            RAISE EXCEPTION 'Sacred Ledger Violation: Transaction account (%) does not match reconciliation account (%). Cannot link transaction to reconciliation from different account.',
                NEW.account_id,
                v_reconciliation_account_id
                USING HINT = 'Transactions can only be linked to reconciliations for the same bank account.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.check_reconciliation_account_match() IS
'Sacred Ledger Hard Gate: Enforces that a transaction can only be linked to a reconciliation for the SAME bank account. Prevents mathematically impossible balance states. Hardened with SET search_path to prevent schema hijacking.';


-- Function 4: check_transaction_reconciliation_lock()
-- Semi-permeable lock preventing amount/date/account edits on completed reconciliations
CREATE OR REPLACE FUNCTION public.check_transaction_reconciliation_lock()
RETURNS TRIGGER
SET search_path TO ''
AS $$
DECLARE
    v_reconciliation_status public.reconciliation_status;
BEGIN
    -- Only check if transaction is linked to a reconciliation
    IF NEW.reconciliation_id IS NOT NULL THEN
        -- Get reconciliation status
        SELECT status INTO v_reconciliation_status
        FROM public.reconciliations
        WHERE id = NEW.reconciliation_id;

        -- If reconciliation is completed, enforce semi-permeable lock
        IF v_reconciliation_status = 'completed' THEN
            -- Block changes to: amount_original, date, account_id
            IF OLD.amount_original IS DISTINCT FROM NEW.amount_original THEN
                RAISE EXCEPTION 'Cannot modify amount_original: transaction is linked to completed reconciliation (%).',
                    NEW.reconciliation_id
                    USING HINT = 'To modify this transaction, first unlink it from the reconciliation or revert reconciliation to draft status.';
            END IF;

            IF OLD.date IS DISTINCT FROM NEW.date THEN
                RAISE EXCEPTION 'Cannot modify date: transaction is linked to completed reconciliation (%).',
                    NEW.reconciliation_id
                    USING HINT = 'To modify this transaction, first unlink it from the reconciliation or revert reconciliation to draft status.';
            END IF;

            IF OLD.account_id IS DISTINCT FROM NEW.account_id THEN
                RAISE EXCEPTION 'Cannot modify account_id: transaction is linked to completed reconciliation (%).',
                    NEW.reconciliation_id
                    USING HINT = 'To modify this transaction, first unlink it from the reconciliation or revert reconciliation to draft status.';
            END IF;

            -- Allow changes to: category_id, description, notes, exchange_rate
            -- (These are classification/metadata fields that don't affect reconciliation math)
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.check_transaction_reconciliation_lock() IS
'Semi-Permeable Lock: Prevents updates to amount_original, date, and account_id when transaction is linked to a completed reconciliation. Allows updates to category_id, description, notes, and exchange_rate for ongoing classification work. Hardened with SET search_path to prevent schema hijacking.';
