-- Migration: Harden promote_inbox_item Signatures
-- Date: 2026-02-05
--
-- CTO Directive: Cauterize the "Numeric Shadow"
--
-- Problem: Two 8-parameter overloads exist with different amount types:
--   - STALE: (uuid, uuid, uuid, text, timestamptz, NUMERIC, numeric, integer) from 20260125000001
--   - CURRENT: (uuid, uuid, uuid, text, timestamptz, BIGINT, numeric, integer) from 20260203000000
--
-- When the client sends a JSON number, Postgres can implicitly cast to either
-- numeric or bigint. With both signatures accepting 8 params, the engine halts
-- with a function ambiguity error rather than guessing wrong.
--
-- Additionally, the 7-parameter BIGINT overload (without p_expected_version)
-- from 20260119000002 is dropped to enforce that all promotion calls must
-- include optimistic concurrency versioning.

-- 1. Drop the stale 8-param NUMERIC overload (The "Ambiguity Culprit")
--    Source: 20260125000001_inbox_promote_version_check.sql
DROP FUNCTION IF EXISTS public.promote_inbox_item(
    uuid, uuid, uuid, text, timestamptz, numeric, numeric, integer
);

-- 2. Drop the 7-param BIGINT overload (Enforce mandatory versioning)
--    Source: 20260119000002_harden_all_ledger_rpcs.sql
--    Without this, version-less calls succeed silently, bypassing OCC.
DROP FUNCTION IF EXISTS public.promote_inbox_item(
    uuid, uuid, uuid, text, timestamptz, bigint, numeric
);

-- 3. Document the sole surviving signature
COMMENT ON FUNCTION public.promote_inbox_item(uuid, uuid, uuid, text, timestamptz, bigint, numeric, integer)
IS 'S-Tier: The only valid promotion path. Requires BIGINT cents and optimistic concurrency versioning.';
