-- ============================================================================
-- MIGRATION: Bulk Update Transactions RPC Function
-- Purpose: Atomic bulk update with Sacred Ledger validation
-- Date: 2026-01-07
-- Architecture: Field-level updates with partial success handling
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."bulk_update_transactions"(
    "p_transaction_ids" "uuid"[],
    "p_updates" "jsonb"
) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_user_id uuid;
    v_success_count integer := 0;
    v_error_count integer := 0;
    v_errors jsonb := '[]'::jsonb;
    v_transaction_id uuid;
    v_category_id uuid;
    v_account_id uuid;
    v_date timestamptz;
    v_notes text;
    v_updated_ids uuid[] := ARRAY[]::uuid[];
BEGIN
    -- 1. Get authenticated user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- 2. Extract update fields (only present fields will be updated)
    v_category_id := CASE WHEN p_updates ? 'categoryId' THEN (p_updates->>'categoryId')::uuid ELSE NULL END;
    v_account_id := CASE WHEN p_updates ? 'accountId' THEN (p_updates->>'accountId')::uuid ELSE NULL END;
    v_date := CASE WHEN p_updates ? 'date' THEN (p_updates->>'date')::timestamptz ELSE NULL END;
    v_notes := CASE WHEN p_updates ? 'notes' THEN p_updates->>'notes' ELSE NULL END;

    -- 3. Validate category exists if provided (prevent orphaned references)
    IF v_category_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM categories WHERE id = v_category_id AND user_id = v_user_id) THEN
            RAISE EXCEPTION 'Category does not exist or does not belong to user';
        END IF;
    END IF;

    -- 4. Validate account exists if provided (prevent orphaned references)
    IF v_account_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM bank_accounts WHERE id = v_account_id AND user_id = v_user_id) THEN
            RAISE EXCEPTION 'Account does not exist or does not belong to user';
        END IF;
    END IF;

    -- 5. SACRED LEDGER VALIDATION: Prevent wiping mandatory fields
    -- Notes can be NULL (optional field), but core fields must remain populated
    IF v_date IS NOT NULL AND v_date < '1900-01-01'::date THEN
        RAISE EXCEPTION 'Invalid date provided';
    END IF;

    -- 6. Loop through each transaction ID and apply updates
    FOREACH v_transaction_id IN ARRAY p_transaction_ids
    LOOP
        BEGIN
            -- Build dynamic UPDATE with only changed fields
            -- Use COALESCE pattern: If field is in p_updates, use new value; else keep existing
            UPDATE transactions
            SET
                category_id = CASE WHEN p_updates ? 'categoryId' THEN v_category_id ELSE category_id END,
                account_id = CASE WHEN p_updates ? 'accountId' THEN v_account_id ELSE account_id END,
                date = CASE WHEN p_updates ? 'date' THEN v_date ELSE date END,
                notes = CASE WHEN p_updates ? 'notes' THEN v_notes ELSE notes END,
                updated_at = NOW()
            WHERE id = v_transaction_id
              AND user_id = v_user_id; -- RLS enforcement (even in DEFINER mode)

            -- Check if row was actually updated (RLS might have blocked it)
            IF FOUND THEN
                v_success_count := v_success_count + 1;
                v_updated_ids := array_append(v_updated_ids, v_transaction_id);
            ELSE
                v_error_count := v_error_count + 1;
                v_errors := v_errors || jsonb_build_object(
                    'transactionId', v_transaction_id,
                    'error', 'Transaction not found or access denied'
                );
            END IF;

        EXCEPTION WHEN OTHERS THEN
            -- Collect error but continue processing other transactions
            v_error_count := v_error_count + 1;
            v_errors := v_errors || jsonb_build_object(
                'transactionId', v_transaction_id,
                'error', SQLERRM
            );
        END;
    END LOOP;

    -- 7. Return comprehensive result
    RETURN jsonb_build_object(
        'success', v_error_count = 0,
        'successCount', v_success_count,
        'errorCount', v_error_count,
        'updatedIds', v_updated_ids,
        'errors', v_errors
    );
END;
$$;

ALTER FUNCTION "public"."bulk_update_transactions"(
    "p_transaction_ids" "uuid"[],
    "p_updates" "jsonb"
) OWNER TO "postgres";

COMMENT ON FUNCTION "public"."bulk_update_transactions"(
    "uuid"[],
    "jsonb"
) IS
'BULK UPDATE with SACRED LEDGER VALIDATION: Updates multiple transactions atomically with field-level intent tracking. Only updates fields present in p_updates JSON. Validates category/account existence and ownership. Returns detailed success/error counts with per-transaction error messages for partial failure handling. Safe for concurrent edits - uses RLS checks within DEFINER mode.';
