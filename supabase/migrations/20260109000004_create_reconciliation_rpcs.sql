-- ============================================================================
-- MIGRATION: Reconciliation RPC Functions
-- Purpose: Atomic bulk operations for linking/unlinking transactions
-- Date: 2026-01-09
-- ============================================================================

-- ============================================================================
-- FUNCTION: link_transactions_to_reconciliation
-- Purpose: Atomically link multiple transactions to a reconciliation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.link_transactions_to_reconciliation(
    p_reconciliation_id UUID,
    p_transaction_ids UUID[]
) RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
    v_user_id UUID;
    v_reconciliation_account_id UUID;
    v_reconciliation_status public.reconciliation_status;
    v_success_count INTEGER := 0;
    v_error_count INTEGER := 0;
    v_errors JSONB := '[]'::jsonb;
    v_transaction_id UUID;
    v_transaction_account_id UUID;
BEGIN
    -- 1. Get authenticated user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- 2. Verify reconciliation exists and belongs to user
    SELECT account_id, status INTO v_reconciliation_account_id, v_reconciliation_status
    FROM public.reconciliations
    WHERE id = p_reconciliation_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reconciliation not found or access denied';
    END IF;

    -- 3. Loop through each transaction ID and link
    FOREACH v_transaction_id IN ARRAY p_transaction_ids
    LOOP
        BEGIN
            -- Verify transaction belongs to user and same account
            SELECT account_id INTO v_transaction_account_id
            FROM public.transactions
            WHERE id = v_transaction_id AND user_id = v_user_id;

            IF NOT FOUND THEN
                v_error_count := v_error_count + 1;
                v_errors := v_errors || jsonb_build_object(
                    'transactionId', v_transaction_id,
                    'error', 'Transaction not found or access denied'
                );
                CONTINUE;
            END IF;

            -- Verify transaction belongs to same account as reconciliation
            -- NOTE: This check is redundant with the trigger, but provides better error messages in RPC
            IF v_transaction_account_id != v_reconciliation_account_id THEN
                v_error_count := v_error_count + 1;
                v_errors := v_errors || jsonb_build_object(
                    'transactionId', v_transaction_id,
                    'error', 'Transaction belongs to different account than reconciliation'
                );
                CONTINUE;
            END IF;

            -- Link transaction (cleared flag will auto-set via trigger)
            -- Account match is enforced by check_reconciliation_account_match trigger
            UPDATE public.transactions
            SET reconciliation_id = p_reconciliation_id,
                updated_at = NOW()
            WHERE id = v_transaction_id;

            v_success_count := v_success_count + 1;

        EXCEPTION WHEN OTHERS THEN
            v_error_count := v_error_count + 1;
            v_errors := v_errors || jsonb_build_object(
                'transactionId', v_transaction_id,
                'error', SQLERRM
            );
        END;
    END LOOP;

    -- 4. Return result
    RETURN jsonb_build_object(
        'success', v_error_count = 0,
        'successCount', v_success_count,
        'errorCount', v_error_count,
        'errors', v_errors
    );
END;
$$;

-- ============================================================================
-- FUNCTION: unlink_transactions_from_reconciliation
-- Purpose: Atomically unlink multiple transactions from a reconciliation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.unlink_transactions_from_reconciliation(
    p_transaction_ids UUID[]
) RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
    v_user_id UUID;
    v_success_count INTEGER := 0;
    v_error_count INTEGER := 0;
    v_errors JSONB := '[]'::jsonb;
    v_transaction_id UUID;
    v_reconciliation_status public.reconciliation_status;
BEGIN
    -- 1. Get authenticated user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- 2. Loop through each transaction ID and unlink
    FOREACH v_transaction_id IN ARRAY p_transaction_ids
    LOOP
        BEGIN
            -- Get reconciliation status (if linked)
            SELECT r.status INTO v_reconciliation_status
            FROM public.transactions t
            JOIN public.reconciliations r ON t.reconciliation_id = r.id
            WHERE t.id = v_transaction_id AND t.user_id = v_user_id;

            -- Prevent unlinking if reconciliation is completed
            IF v_reconciliation_status = 'completed' THEN
                v_error_count := v_error_count + 1;
                v_errors := v_errors || jsonb_build_object(
                    'transactionId', v_transaction_id,
                    'error', 'Cannot unlink: reconciliation is completed. Revert to draft first.'
                );
                CONTINUE;
            END IF;

            -- Unlink transaction (cleared flag will auto-clear via trigger)
            UPDATE public.transactions
            SET reconciliation_id = NULL,
                updated_at = NOW()
            WHERE id = v_transaction_id AND user_id = v_user_id;

            IF FOUND THEN
                v_success_count := v_success_count + 1;
            ELSE
                v_error_count := v_error_count + 1;
                v_errors := v_errors || jsonb_build_object(
                    'transactionId', v_transaction_id,
                    'error', 'Transaction not found or access denied'
                );
            END IF;

        EXCEPTION WHEN OTHERS THEN
            v_error_count := v_error_count + 1;
            v_errors := v_errors || jsonb_build_object(
                'transactionId', v_transaction_id,
                'error', SQLERRM
            );
        END;
    END LOOP;

    -- 3. Return result
    RETURN jsonb_build_object(
        'success', v_error_count = 0,
        'successCount', v_success_count,
        'errorCount', v_error_count,
        'errors', v_errors
    );
END;
$$;

-- ============================================================================
-- FUNCTION: get_reconciliation_summary
-- Purpose: Calculate real-time reconciliation math for a reconciliation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_reconciliation_summary(
    p_reconciliation_id UUID
) RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
    v_user_id UUID;
    v_beginning_balance NUMERIC(15, 2);
    v_ending_balance NUMERIC(15, 2);
    v_linked_sum NUMERIC(15, 2);
    v_difference NUMERIC(15, 2);
    v_linked_count INTEGER;
BEGIN
    -- 1. Get authenticated user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- 2. Get reconciliation balances
    SELECT beginning_balance, ending_balance
    INTO v_beginning_balance, v_ending_balance
    FROM public.reconciliations
    WHERE id = p_reconciliation_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reconciliation not found or access denied';
    END IF;

    -- 3. Calculate sum of linked transactions (use amount_home for consistency)
    SELECT COALESCE(SUM(amount_home), 0), COUNT(*)
    INTO v_linked_sum, v_linked_count
    FROM public.transactions
    WHERE reconciliation_id = p_reconciliation_id AND user_id = v_user_id;

    -- 4. Calculate difference: Ending Balance - (Beginning Balance + Linked Sum)
    v_difference := v_ending_balance - (v_beginning_balance + v_linked_sum);

    -- 5. Return summary
    RETURN jsonb_build_object(
        'beginningBalance', v_beginning_balance,
        'endingBalance', v_ending_balance,
        'linkedSum', v_linked_sum,
        'linkedCount', v_linked_count,
        'difference', v_difference,
        'isBalanced', v_difference = 0
    );
END;
$$;

-- Grant permissions
ALTER FUNCTION public.link_transactions_to_reconciliation(UUID, UUID[]) OWNER TO postgres;
ALTER FUNCTION public.unlink_transactions_from_reconciliation(UUID[]) OWNER TO postgres;
ALTER FUNCTION public.get_reconciliation_summary(UUID) OWNER TO postgres;

COMMENT ON FUNCTION public.link_transactions_to_reconciliation IS
'Atomically link multiple transactions to a reconciliation. Validates account match and user ownership. Auto-sets cleared flag via trigger. Relies on check_reconciliation_account_match trigger for Sacred Ledger enforcement.';

COMMENT ON FUNCTION public.unlink_transactions_from_reconciliation IS
'Atomically unlink multiple transactions from a reconciliation. Prevents unlinking if reconciliation is completed. Auto-clears cleared flag via trigger.';

COMMENT ON FUNCTION public.get_reconciliation_summary IS
'Calculate real-time reconciliation math: Difference = Ending Balance - (Beginning Balance + Linked Sum). Returns full summary for HUD display. Uses amount_home for accurate multi-currency support.';
