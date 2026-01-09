-- ============================================================================
-- MIGRATION: Transaction Lock Trigger (Semi-Permeable Lock)
-- Purpose: Prevent updates to Amount/Date/Account when linked to completed reconciliation
--          but allow Category/Description/Notes edits for ongoing classification
-- Date: 2026-01-09
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_transaction_reconciliation_lock()
RETURNS TRIGGER AS $$
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

-- Attach trigger (BEFORE UPDATE)
CREATE TRIGGER trigger_check_transaction_reconciliation_lock
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.check_transaction_reconciliation_lock();

COMMENT ON FUNCTION public.check_transaction_reconciliation_lock() IS
'Semi-Permeable Lock: Prevents updates to amount_original, date, and account_id when transaction is linked to a completed reconciliation. Allows updates to category_id, description, notes, and exchange_rate for ongoing classification work.';
