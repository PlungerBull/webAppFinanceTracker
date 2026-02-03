-- ============================================================================
-- Migration: create_transfer BIGINT Cents Overload
-- ============================================================================
-- CTO Mandate: Sacred Integer Arithmetic (ADR 001)
--
-- Problem: The existing create_transfer RPC uses NUMERIC (floating-point)
-- for amount parameters, violating the Floating-Point Rejection policy.
--
-- Solution: Add new BIGINT (integer cents) overload that matches the S-Tier
-- pattern already established in create_transfer_transaction.
--
-- Data Flow (S-Tier):
--   Domain (cents) → RPC (BIGINT cents) → DB (numeric, but integer values)
--
-- NOTE: The transactions.amount_original column is NUMERIC(20,4), but we
-- INSERT integer cent values. INTEGER → NUMERIC is lossless and acceptable
-- because the source of truth (application) maintains integer precision.
-- ============================================================================

-- Add new BIGINT overload for create_transfer
-- This signature takes cents directly, no floating-point conversion needed
CREATE OR REPLACE FUNCTION create_transfer(
  p_user_id UUID,
  p_from_account_id UUID,
  p_to_account_id UUID,
  p_amount_cents BIGINT,           -- Integer cents (S-Tier: Sacred Integer Arithmetic)
  p_amount_received_cents BIGINT,  -- Integer cents (S-Tier: Sacred Integer Arithmetic)
  p_exchange_rate NUMERIC,         -- Exchange rate is metadata, float is acceptable
  p_date TIMESTAMPTZ,
  p_description TEXT,
  p_category_id UUID DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_transfer_id UUID;
  v_transaction_from_id UUID;
  v_transaction_to_id UUID;
BEGIN
  -- Generate a transfer ID to link the transactions
  v_transfer_id := gen_random_uuid();

  -- Create Outbound Transaction (Source)
  -- SACRED LEDGER: Currency derived from account via trigger
  INSERT INTO transactions (
    user_id,
    account_id,
    category_id,
    amount_original,
    description,
    notes,
    date,
    transfer_id,
    exchange_rate
  ) VALUES (
    p_user_id,
    p_from_account_id,
    p_category_id,
    -p_amount_cents,  -- Negative for outgoing, INTEGER cents
    p_description,
    'Transfer Out',
    p_date,
    v_transfer_id,
    1.0
  ) RETURNING id INTO v_transaction_from_id;

  -- Create Inbound Transaction (Destination)
  -- SACRED LEDGER: Currency derived from account via trigger
  INSERT INTO transactions (
    user_id,
    account_id,
    category_id,
    amount_original,
    description,
    notes,
    date,
    transfer_id,
    exchange_rate
  ) VALUES (
    p_user_id,
    p_to_account_id,
    p_category_id,
    p_amount_received_cents,  -- Positive for incoming, INTEGER cents
    p_description,
    'Transfer In: ' || p_exchange_rate::TEXT,
    p_date,
    v_transfer_id,
    1.0
  ) RETURNING id INTO v_transaction_to_id;

  RETURN json_build_object(
    'transfer_id', v_transfer_id,
    'from_transaction_id', v_transaction_from_id,
    'to_transaction_id', v_transaction_to_id
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_transfer(
  UUID, UUID, UUID, BIGINT, BIGINT, NUMERIC, TIMESTAMPTZ, TEXT, UUID
) TO authenticated;

-- Add comment documenting S-Tier compliance
COMMENT ON FUNCTION create_transfer(
  UUID, UUID, UUID, BIGINT, BIGINT, NUMERIC, TIMESTAMPTZ, TEXT, UUID
) IS 'S-TIER: Creates a transfer between two accounts using INTEGER CENTS (ADR 001 compliant). Currency is automatically derived from each account via trigger. This is the preferred signature - avoid the legacy NUMERIC overloads.';

-- ============================================================================
-- IMPORTANT: Legacy NUMERIC signatures are NOT dropped in this migration.
-- They will be dropped in a follow-up migration after verifying the BIGINT
-- overload works correctly in production.
-- ============================================================================
