-- ============================================================================
-- MIGRATION: Add Version Checking to Bulk Update RPC
-- Purpose: Extend bulk_update_transactions with optimistic concurrency control
-- Date: 2026-01-11
-- Architecture: Debt Prevention #2 - Version tracking for bulk operations
-- ============================================================================

-- Drop old function
DROP FUNCTION IF EXISTS public.bulk_update_transactions(uuid[], jsonb);

-- Recreate with version parameter
CREATE OR REPLACE FUNCTION public.bulk_update_transactions(
    p_transaction_ids uuid[],
    p_versions integer[], -- NEW: Parallel array of expected versions
    p_updates jsonb
) RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
    v_user_id uuid;
    v_success_count integer := 0;
    v_error_count integer := 0;
    v_errors jsonb := '[]'::jsonb;
    v_transaction_id uuid;
    v_expected_version integer;
    v_current_version integer;
    v_category_id uuid;
    v_account_id uuid;
    v_date timestamptz;
    v_notes text;
    v_updated_ids uuid[] := ARRAY[]::uuid[];
    v_index integer := 1;
BEGIN
    -- 1. Get authenticated user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- 2. Validate arrays have same length
    IF array_length(p_transaction_ids, 1) != array_length(p_versions, 1) THEN
        RAISE EXCEPTION 'Transaction IDs and versions arrays must have same length';
    END IF;

    -- 3. Extract update fields (only present fields will be updated)
    v_category_id := CASE WHEN p_updates ? 'categoryId' THEN (p_updates->>'categoryId')::uuid ELSE NULL END;
    v_account_id := CASE WHEN p_updates ? 'accountId' THEN (p_updates->>'accountId')::uuid ELSE NULL END;
    v_date := CASE WHEN p_updates ? 'date' THEN (p_updates->>'date')::timestamptz ELSE NULL END;
    v_notes := CASE WHEN p_updates ? 'notes' THEN p_updates->>'notes' ELSE NULL END;

    -- 4. Validate category exists if provided (prevent orphaned references)
    IF v_category_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM categories WHERE id = v_category_id AND user_id = v_user_id) THEN
            RAISE EXCEPTION 'Category does not exist or does not belong to user';
        END IF;
    END IF;

    -- 5. Validate account exists if provided (prevent orphaned references)
    IF v_account_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM bank_accounts WHERE id = v_account_id AND user_id = v_user_id) THEN
            RAISE EXCEPTION 'Account does not exist or does not belong to user';
        END IF;
    END IF;

    -- 6. SACRED LEDGER VALIDATION: Prevent wiping mandatory fields
    IF v_date IS NOT NULL AND v_date < '1900-01-01'::date THEN
        RAISE EXCEPTION 'Invalid date provided';
    END IF;

    -- 7. Loop through each transaction ID and apply updates with version checking
    FOREACH v_transaction_id IN ARRAY p_transaction_ids
    LOOP
        BEGIN
            v_expected_version := p_versions[v_index];

            -- Check current version first
            SELECT version INTO v_current_version
            FROM transactions
            WHERE id = v_transaction_id
              AND user_id = v_user_id;

            -- Version conflict check
            IF v_current_version IS NULL THEN
                v_error_count := v_error_count + 1;
                v_errors := v_errors || jsonb_build_object(
                    'transactionId', v_transaction_id,
                    'error', 'Transaction not found or access denied'
                );
            ELSIF v_current_version != v_expected_version THEN
                -- Version mismatch - another user/process modified it
                v_error_count := v_error_count + 1;
                v_errors := v_errors || jsonb_build_object(
                    'transactionId', v_transaction_id,
                    'error', 'version_conflict',
                    'expectedVersion', v_expected_version,
                    'currentVersion', v_current_version,
                    'conflict', true
                );
            ELSE
                -- Version matches - proceed with update
                UPDATE transactions
                SET
                    category_id = CASE WHEN p_updates ? 'categoryId' THEN v_category_id ELSE category_id END,
                    account_id = CASE WHEN p_updates ? 'accountId' THEN v_account_id ELSE account_id END,
                    date = CASE WHEN p_updates ? 'date' THEN v_date ELSE date END,
                    notes = CASE WHEN p_updates ? 'notes' THEN v_notes ELSE notes END,
                    updated_at = NOW()
                    -- version increments automatically via trigger
                WHERE id = v_transaction_id
                  AND user_id = v_user_id
                  AND version = v_expected_version; -- Version guard in WHERE clause

                IF FOUND THEN
                    v_success_count := v_success_count + 1;
                    v_updated_ids := array_append(v_updated_ids, v_transaction_id);
                ELSE
                    v_error_count := v_error_count + 1;
                    v_errors := v_errors || jsonb_build_object(
                        'transactionId', v_transaction_id,
                        'error', 'Concurrent modification detected'
                    );
                END IF;
            END IF;

            v_index := v_index + 1;

        EXCEPTION WHEN OTHERS THEN
            -- Collect error but continue processing other transactions
            v_error_count := v_error_count + 1;
            v_errors := v_errors || jsonb_build_object(
                'transactionId', v_transaction_id,
                'error', SQLERRM
            );
            v_index := v_index + 1;
        END;
    END LOOP;

    -- 8. Return comprehensive result
    RETURN jsonb_build_object(
        'success', v_error_count = 0,
        'successCount', v_success_count,
        'errorCount', v_error_count,
        'updatedIds', v_updated_ids,
        'errors', v_errors
    );
END;
$$;

ALTER FUNCTION public.bulk_update_transactions(uuid[], integer[], jsonb)
OWNER TO postgres;

COMMENT ON FUNCTION public.bulk_update_transactions(uuid[], integer[], jsonb) IS
'BULK UPDATE with VERSION CHECKING: Updates multiple transactions with optimistic concurrency control.

NEW in this version:
- Accepts p_versions array (parallel to p_transaction_ids)
- Checks each transaction version before updating
- Returns version_conflict errors for stale transactions
- Prevents race condition where User A selects 100 transactions, User B edits 1, User A bulk updates all 100

Parameters:
- p_transaction_ids: Array of transaction IDs to update
- p_versions: Array of expected versions (must match array length)
- p_updates: JSONB with fields to update

Returns JSONB:
- success: true if all succeeded
- successCount: Number of successful updates
- errorCount: Number of failed updates
- updatedIds: Array of successfully updated transaction IDs
- errors: Array of error objects with version conflict details';
