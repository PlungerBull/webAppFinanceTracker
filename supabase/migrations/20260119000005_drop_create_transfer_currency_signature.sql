-- ============================================================================
-- MIGRATION: Drop create_transfer Old Currency Signature
-- Purpose: Remove the old 11-parameter create_transfer with p_from_currency/p_to_currency
-- Date: 2026-01-19
-- ============================================================================
--
-- CONTEXT: The TypeScript types show TWO create_transfer overloads:
-- 1. OLD: 11 parameters including p_from_currency, p_to_currency (NUMERIC amounts)
-- 2. NEW: 9 parameters with p_amount_cents, p_amount_received_cents (BIGINT)
--
-- This migration drops the OLD signature to eliminate function overloading.
-- ============================================================================

BEGIN;

-- Drop the old create_transfer with currency parameters
-- Signature from TypeScript types:
-- (p_user_id, p_from_account_id, p_to_account_id, p_amount, p_from_currency,
--  p_to_currency, p_amount_received, p_exchange_rate, p_date, p_description, p_category_id)
DROP FUNCTION IF EXISTS "public"."create_transfer"(
  "uuid",                      -- p_user_id
  "uuid",                      -- p_from_account_id
  "uuid",                      -- p_to_account_id
  numeric,                     -- p_amount (OLD NUMERIC)
  "text",                      -- p_from_currency
  "text",                      -- p_to_currency
  numeric,                     -- p_amount_received (OLD NUMERIC)
  numeric,                     -- p_exchange_rate
  timestamp with time zone,    -- p_date
  "text",                      -- p_description
  "uuid"                       -- p_category_id
);

COMMENT ON SCHEMA public IS '[CLEANUP 2026-01-19] Removed create_transfer old currency signature - only BIGINT version remains';

COMMIT;
