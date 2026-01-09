-- ============================================================================
-- MIGRATION: Add Reconciliation Fields to Transactions
-- Purpose: Link transactions to reconciliations with auto-clearing
-- Date: 2026-01-09
-- ============================================================================

-- Add reconciliation_id and cleared fields
ALTER TABLE public.transactions
ADD COLUMN reconciliation_id UUID REFERENCES public.reconciliations(id) ON DELETE SET NULL,
ADD COLUMN cleared BOOLEAN NOT NULL DEFAULT FALSE;

-- Create indexes
CREATE INDEX idx_transactions_reconciliation_id ON public.transactions(reconciliation_id);
CREATE INDEX idx_transactions_cleared ON public.transactions(cleared);

-- Create trigger function to auto-set cleared flag
CREATE OR REPLACE FUNCTION public.auto_set_cleared_flag()
RETURNS TRIGGER AS $$
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

-- Attach trigger (BEFORE INSERT OR UPDATE)
CREATE TRIGGER trigger_auto_set_cleared
    BEFORE INSERT OR UPDATE OF reconciliation_id ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_set_cleared_flag();

COMMENT ON COLUMN public.transactions.reconciliation_id IS
'Links transaction to a reconciliation session. When set, cleared flag auto-sets to TRUE. When reconciliation.status=completed, this transaction becomes semi-permeable locked.';

-- Create function to validate reconciliation account match
CREATE OR REPLACE FUNCTION public.check_reconciliation_account_match()
RETURNS TRIGGER AS $$
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

-- Attach trigger (BEFORE INSERT OR UPDATE)
CREATE TRIGGER trigger_check_reconciliation_account_match
    BEFORE INSERT OR UPDATE OF reconciliation_id, account_id ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.check_reconciliation_account_match();

COMMENT ON FUNCTION public.check_reconciliation_account_match() IS
'Sacred Ledger Hard Gate: Enforces that a transaction can only be linked to a reconciliation for the SAME bank account. Prevents mathematically impossible balance states.';

COMMENT ON COLUMN public.transactions.reconciliation_id IS
'Links transaction to a reconciliation session. When set, cleared flag auto-sets to TRUE. When reconciliation.status=completed, this transaction becomes semi-permeable locked.';

COMMENT ON COLUMN public.transactions.cleared IS
'Auto-managed flag (do not set manually). TRUE when linked to reconciliation, FALSE otherwise. Used for UI indicators.';
