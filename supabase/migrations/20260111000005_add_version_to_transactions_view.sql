-- Migration: Add version column to transactions_view
-- Description: Update transactions_view to include version column for optimistic concurrency control
-- Date: 2026-01-11

-- Drop and recreate the view with version column included
CREATE OR REPLACE VIEW "public"."transactions_view" WITH ("security_invoker"='true') AS
 SELECT "t"."id",
    "t"."user_id",
    "t"."account_id",
    "t"."category_id",
    "t"."description",
    "t"."amount_original",
    "t"."amount_home",
    "t"."exchange_rate",
    "t"."date",
    "t"."notes",
    "t"."source_text",
    "t"."inbox_id",
    "t"."transfer_id",
    "t"."reconciliation_id",
    "t"."cleared",
    "t"."created_at",
    "t"."updated_at",
    "t"."version", -- NEW: Optimistic concurrency control version
    "a"."name" AS "account_name",
    "a"."currency_code" AS "currency_original",
    "a"."currency_code" AS "account_currency",
    "a"."color" AS "account_color",
    "c"."name" AS "category_name",
    "c"."color" AS "category_color",
    "c"."type" AS "category_type"
   FROM (("public"."transactions" "t"
     LEFT JOIN "public"."bank_accounts" "a" ON (("t"."account_id" = "a"."id")))
     LEFT JOIN "public"."categories" "c" ON (("t"."category_id" = "c"."id")));

COMMENT ON VIEW "public"."transactions_view" IS 'Enriched transaction view with joined account and category display data. Includes version for optimistic concurrency control, reconciliation_id and cleared flag for audit workspace. Uses security_invoker = true to enforce RLS policies.';
