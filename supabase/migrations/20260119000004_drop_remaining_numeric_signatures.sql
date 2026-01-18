-- ============================================================================
-- MIGRATION: Drop Remaining NUMERIC Function Signatures (Comprehensive)
-- Purpose: Remove ALL legacy create_transfer variations with NUMERIC parameters
-- Date: 2026-01-19
-- ============================================================================

BEGIN;

-- Drop create_transfer with p_from_currency and p_to_currency (very old signature)
DROP FUNCTION IF EXISTS "public"."create_transfer"(
  "uuid", "uuid", "uuid", numeric, "text", "text", numeric, numeric, timestamp with time zone, "text", "uuid"
);

-- Drop create_transfer without currency but with NUMERIC amounts (more recent)
DROP FUNCTION IF EXISTS "public"."create_transfer"(
  "uuid", "uuid", "uuid", numeric, numeric, numeric, timestamp with time zone, "text", "uuid"
);

-- Drop any 7-parameter version
DROP FUNCTION IF EXISTS "public"."create_transfer"(
  "uuid", "uuid", "uuid", numeric, "text", timestamp with time zone, "uuid"
);

COMMIT;
