-- Categories Feature Hardening: Sync Foundation
-- 1. Add versioning and tombstones to categories
-- 2. Use global_transaction_version for unified sync pulse
-- 3. Update categories_with_counts view to filter tombstones

-- ============================================================================
-- 1. ADD COLUMNS
-- ============================================================================
ALTER TABLE "public"."categories"
ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ DEFAULT NULL;

-- ============================================================================
-- 2. CREATE TRIGGERS (Unified Sync Pulse)
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."set_category_version"()
RETURNS TRIGGER AS $$
BEGIN
  -- Pull from the SAME global sequence as the ledger for unified syncing
  -- This ensures a single "Sync Pulse" across the entire User Profile
  NEW.version := nextval('global_transaction_version');
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trigger_set_category_version" ON "public"."categories";
CREATE TRIGGER "trigger_set_category_version"
  BEFORE INSERT OR UPDATE ON "public"."categories"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."set_category_version"();

-- ============================================================================
-- 3. UPDATE VIEW (Filter Tombstones)
-- ============================================================================
-- CTO Mandate: The "View Filter Trap" - all views must exclude soft-deleted records
DROP VIEW IF EXISTS "public"."categories_with_counts";

CREATE OR REPLACE VIEW "public"."categories_with_counts"
WITH (security_invoker = true)
AS
SELECT
  c.id,
  c.name,
  c.type,
  c.parent_id,
  c.color,
  c.user_id,
  c.created_at,
  c.updated_at,
  -- Sync fields
  c.version,
  c.deleted_at,
  -- Transaction count (only count non-deleted transactions)
  COUNT(t.id) FILTER (WHERE t.deleted_at IS NULL) AS transaction_count
FROM "public"."categories" c
LEFT JOIN "public"."transactions" t ON c.id = t.category_id
WHERE c.deleted_at IS NULL  -- Tombstone filtering: Only show active categories
GROUP BY c.id, c.name, c.type, c.parent_id, c.color, c.user_id, c.created_at, c.updated_at, c.version, c.deleted_at;

COMMENT ON VIEW "public"."categories_with_counts" IS 'Denormalized category view with sync fields (version, deleted_at) and transaction counts. Filters out soft-deleted categories and transactions.';

-- ============================================================================
-- 4. ADD COMMENTS
-- ============================================================================
COMMENT ON COLUMN "public"."categories"."version" IS 'Monotonic version counter for optimistic concurrency control. Uses global_transaction_version sequence for unified sync pulse.';
COMMENT ON COLUMN "public"."categories"."deleted_at" IS 'Tombstone timestamp for soft deletes. NULL = active, timestamp = soft-deleted. Required for distributed sync.';
