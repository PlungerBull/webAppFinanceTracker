-- ============================================================================
-- Migration: Drop Legacy create_transfer NUMERIC Overloads
-- ============================================================================
-- TODO #9: Code Consistency — ADR 001 (Floating-Point Rejection)
--
-- Context: The S-Tier BIGINT overload (20260202225625) has been verified in
-- production. These legacy NUMERIC overloads are dead code — no frontend
-- caller references them.
--
-- Dropped signatures:
--   1. 9-param NUMERIC  (p_amount, p_amount_received)
--   2. 11-param NUMERIC (p_amount, p_from_currency, p_to_currency, ...)
--
-- Remaining (active):
--   3. 9-param BIGINT   (p_amount_cents, p_amount_received_cents) — S-Tier
-- ============================================================================

-- Drop 9-parameter NUMERIC version (Overload 1)
DROP FUNCTION IF EXISTS public.create_transfer(
  uuid, uuid, uuid, numeric, numeric, numeric,
  timestamptz, text, uuid
);

-- Drop 11-parameter NUMERIC+currency version (Overload 2)
-- This also violated Sacred Ledger (explicit currency_original bypass)
DROP FUNCTION IF EXISTS public.create_transfer(
  uuid, uuid, uuid, numeric, text, text, numeric, numeric,
  timestamptz, text, uuid
);
