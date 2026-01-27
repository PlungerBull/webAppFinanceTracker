-- Accounts Feature Hardening: Sync Foundation
-- 1. Add versioning and tombstones to bank_accounts
-- 2. Use global_transaction_version for unified sync pulse
-- 3. Enable optimistic concurrency control for account operations

-- ============================================================================
-- 1. ADD COLUMNS
-- ============================================================================
ALTER TABLE "public"."bank_accounts"
ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ DEFAULT NULL;

-- ============================================================================
-- 2. CREATE TRIGGERS (Unified Sync Pulse)
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."set_account_version"()
RETURNS TRIGGER AS $$
BEGIN
  -- Pull from the SAME global sequence as the ledger for unified syncing
  -- This ensures a single "Sync Pulse" across the entire User Profile
  NEW.version := nextval('global_transaction_version');
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trigger_set_account_version" ON "public"."bank_accounts";
CREATE TRIGGER "trigger_set_account_version"
  BEFORE INSERT OR UPDATE ON "public"."bank_accounts"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."set_account_version"();

-- ============================================================================
-- 3. ADD COMMENTS
-- ============================================================================
COMMENT ON COLUMN "public"."bank_accounts"."version" IS 'Monotonic version counter for optimistic concurrency control. Uses global_transaction_version sequence for unified sync pulse.';
COMMENT ON COLUMN "public"."bank_accounts"."deleted_at" IS 'Tombstone timestamp for soft deletes. NULL = active, timestamp = soft-deleted. Required for distributed sync.';
