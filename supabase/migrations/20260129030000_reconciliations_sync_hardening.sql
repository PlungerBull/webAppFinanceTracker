-- ============================================================================
-- MIGRATION: Reconciliations Sync Hardening
-- Purpose: Add versioning and tombstones for Delta Sync Engine compatibility
-- Date: 2026-01-29
-- Architecture: CTO Mandate - Tombstone pattern for distributed sync
-- ============================================================================

-- ============================================================================
-- 1. ADD SYNC COLUMNS
-- ============================================================================
ALTER TABLE "public"."reconciliations"
ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ DEFAULT NULL;

-- ============================================================================
-- 2. CREATE VERSION TRIGGER (Unified Sync Pulse)
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."set_reconciliation_version"()
RETURNS TRIGGER AS $$
BEGIN
  -- Pull from the SAME global sequence as the ledger for unified syncing
  -- This ensures a single "Sync Pulse" across the entire User Profile
  NEW.version := nextval('global_transaction_version');
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trigger_set_reconciliation_version" ON "public"."reconciliations";
CREATE TRIGGER "trigger_set_reconciliation_version"
  BEFORE INSERT OR UPDATE ON "public"."reconciliations"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."set_reconciliation_version"();

-- ============================================================================
-- 3. UPDATE OVERLAP CHECK FUNCTION (Must Exclude Tombstones)
-- ============================================================================
-- CTO Mandate: The "View Filter Trap" - overlap checks must exclude soft-deleted records
-- Otherwise, a deleted reconciliation would still block date ranges forever
CREATE OR REPLACE FUNCTION public.check_reconciliation_date_overlap()
RETURNS TRIGGER AS $$
DECLARE
    v_overlap_count INTEGER;
BEGIN
    -- Only check if date range is specified
    IF NEW.date_start IS NOT NULL AND NEW.date_end IS NOT NULL THEN
        -- Check for overlapping reconciliations on the same account
        -- IMPORTANT: Exclude soft-deleted reconciliations from overlap check
        SELECT COUNT(*) INTO v_overlap_count
        FROM public.reconciliations
        WHERE account_id = NEW.account_id
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
          AND date_start IS NOT NULL
          AND date_end IS NOT NULL
          AND deleted_at IS NULL  -- Tombstone filter: Exclude soft-deleted
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

-- ============================================================================
-- 4. ADD COMMENTS
-- ============================================================================
COMMENT ON COLUMN "public"."reconciliations"."version" IS 'Monotonic version counter for optimistic concurrency control. Uses global_transaction_version sequence for unified sync pulse.';
COMMENT ON COLUMN "public"."reconciliations"."deleted_at" IS 'Tombstone timestamp for soft deletes. NULL = active, timestamp = soft-deleted. Required for distributed sync.';
