-- ============================================================================
-- MIGRATION: Create Reconciliations Table
-- Purpose: High-Integrity Audit Workspace - Contract of Truth tracking
-- Date: 2026-01-09
-- Architecture: Account-scoped reconciliation sessions with immutability enforcement
-- ============================================================================

-- Create reconciliation_status enum
CREATE TYPE public.reconciliation_status AS ENUM ('draft', 'completed');

-- Create reconciliations table
CREATE TABLE public.reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    beginning_balance NUMERIC(15, 2) NOT NULL,
    ending_balance NUMERIC(15, 2) NOT NULL,
    date_start TIMESTAMPTZ,  -- Optional: filter to transactions >= this date
    date_end TIMESTAMPTZ,    -- Optional: filter to transactions <= this date
    status public.reconciliation_status NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT reconciliations_name_not_empty CHECK (char_length(name) > 0),
    CONSTRAINT reconciliations_valid_date_range CHECK (
        (date_start IS NULL AND date_end IS NULL) OR
        (date_start IS NOT NULL AND date_end IS NOT NULL AND date_end >= date_start)
    )
);

-- Create indexes for performance
CREATE INDEX idx_reconciliations_user_id ON public.reconciliations(user_id);
CREATE INDEX idx_reconciliations_account_id ON public.reconciliations(account_id);
CREATE INDEX idx_reconciliations_status ON public.reconciliations(status);
CREATE INDEX idx_reconciliations_user_account ON public.reconciliations(user_id, account_id);

-- Enable RLS
ALTER TABLE public.reconciliations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own reconciliations"
    ON public.reconciliations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reconciliations"
    ON public.reconciliations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reconciliations"
    ON public.reconciliations FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reconciliations"
    ON public.reconciliations FOR DELETE
    USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_reconciliations_updated_at
    BEFORE UPDATE ON public.reconciliations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to check for overlapping date ranges
CREATE OR REPLACE FUNCTION public.check_reconciliation_date_overlap()
RETURNS TRIGGER AS $$
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

-- Attach trigger (BEFORE INSERT OR UPDATE)
CREATE TRIGGER trigger_check_reconciliation_date_overlap
    BEFORE INSERT OR UPDATE OF date_start, date_end, account_id ON public.reconciliations
    FOR EACH ROW
    EXECUTE FUNCTION public.check_reconciliation_date_overlap();

COMMENT ON FUNCTION public.check_reconciliation_date_overlap() IS
'Prevents overlapping reconciliation date ranges for the same account. Ensures each time period is reconciled only once.';

COMMENT ON TABLE public.reconciliations IS
'Reconciliation sessions tracking the "Contract of Truth" between bank statements and ledger. Each reconciliation defines beginning/ending balances and links transactions to prove the math.';

COMMENT ON COLUMN public.reconciliations.status IS
'draft: Reconciliation in progress, transactions can be linked/unlinked. completed: Reconciliation locked, linked transactions become immutable (amount/date/account frozen, but category/notes editable).';
