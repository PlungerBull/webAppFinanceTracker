/**
 * Database Row Schemas — Zod Contracts at the Network Boundary
 *
 * This file is the "Bible" for both Web and the eventual iOS port.
 * Every Supabase response is validated here BEFORE hitting data-transformers.ts.
 *
 * TWO SCHEMA SETS:
 * 1. Table Row Schemas — match database.types.ts (for .from() queries in repositories)
 * 2. Sync Record Schemas — match get_changes_since RPC output (for pull-engine)
 *    The RPC renames columns: amount_original → amount_cents, amount_home → amount_home_cents, etc.
 *
 * CTO MANDATES:
 * - z.number().int() for ALL cents fields (rejects floats like 100.5)
 * - .nullable() for Postgres NULL fields; .optional() only for JSON-absent fields
 * - .passthrough() on sync schemas to tolerate new DB columns
 * - No `any` — full generic type flow via validate.ts helpers
 *
 * @module types/db-row-schemas
 */

import { z } from 'zod';

// ============================================================================
// SHARED FRAGMENTS (DRY Base)
// ============================================================================

const uuid = z.string().uuid();

/** ISO 8601 timestamp string from Postgres */
const timestamptz = z.string();

/** Sync fields added by migration — present on syncable tables */
const BaseSyncFields = {
  version: z.number().int().min(0),
  deleted_at: z.string().nullable(),
};

// ============================================================================
// ENUMS (matching database.types.ts Enums)
// ============================================================================

const AccountTypeEnum = z.enum([
  'checking', 'savings', 'credit_card', 'investment', 'loan', 'cash', 'other',
]);

const TransactionTypeEnum = z.enum([
  'expense', 'income', 'transfer', 'opening_balance', 'adjustment',
]);

const ReconciliationStatusEnum = z.enum(['draft', 'completed']);

// ============================================================================
// TABLE ROW SCHEMAS (snake_case — matching database.types.ts Row types)
// Used by repository/API layers that query via .from()
// ============================================================================

/**
 * bank_accounts table Row
 *
 * Sync fields (version, deleted_at) are now in auto-generated database.types.ts
 * current_balance_cents stores balance in integer cents (Sacred Integer Arithmetic)
 */
export const BankAccountRowSchema = z.object({
  id: uuid,
  group_id: uuid.nullable(),
  user_id: uuid,
  name: z.string(),
  type: AccountTypeEnum,
  currency_code: z.string(),
  color: z.string(),
  is_visible: z.boolean(),
  current_balance_cents: z.number().int(),
  created_at: timestamptz,
  updated_at: timestamptz,
  version: z.number().int().min(0),
  deleted_at: z.string().nullable(),
});

/**
 * bank_accounts with global_currencies JOIN
 * Used by dbAccountViewToDomain via .select('*, global_currencies(symbol)')
 */
export const BankAccountViewRowSchema = BankAccountRowSchema.extend({
  global_currencies: z.object({ symbol: z.string() }).nullable(),
});

/**
 * transactions table Row
 * Has sync fields natively in database.types.ts
 */
export const TransactionRowSchema = z.object({
  id: uuid,
  user_id: uuid,
  account_id: uuid,
  category_id: uuid.nullable(),
  amount_original: z.number().int(),
  amount_home: z.number().int(),
  exchange_rate: z.number(),
  date: z.string(),
  description: z.string().nullable(),
  notes: z.string().nullable(),
  source_text: z.string().nullable(),
  transfer_id: uuid.nullable(),
  inbox_id: uuid.nullable(),
  cleared: z.boolean(),
  reconciliation_id: uuid.nullable(),
  created_at: timestamptz,
  updated_at: timestamptz,
  ...BaseSyncFields,
});

/**
 * categories table Row
 * Sync fields now in auto-generated types/supabase.ts
 */
export const CategoryRowSchema = z.object({
  id: uuid,
  user_id: uuid.nullable(),
  name: z.string(),
  type: TransactionTypeEnum,
  color: z.string(),
  parent_id: uuid.nullable(),
  created_at: timestamptz,
  updated_at: timestamptz,
  // Sync fields — required at boundary (Delta Sync Engine needs defined values)
  ...BaseSyncFields,
});

/**
 * transaction_inbox table Row
 * Sync fields now in auto-generated types/supabase.ts
 */
export const TransactionInboxRowSchema = z.object({
  id: uuid,
  user_id: uuid,
  amount_cents: z.number().nullable(),
  description: z.string().nullable(),
  date: z.string().nullable(),
  source_text: z.string().nullable(),
  account_id: uuid.nullable(),
  category_id: uuid.nullable(),
  exchange_rate: z.number().nullable(),
  notes: z.string().nullable(),
  status: z.string(),
  created_at: timestamptz,
  updated_at: timestamptz,
  // Sync fields — required (now in auto-generated types)
  ...BaseSyncFields,
});

/**
 * transaction_inbox_view Row (with JOINed display fields)
 */
export const TransactionInboxViewRowSchema = z.object({
  id: z.string().nullable(),
  user_id: z.string().nullable(),
  currency_original: z.string().nullable(),
  description: z.string().nullable(),
  date: z.string().nullable(),
  source_text: z.string().nullable(),
  account_id: z.string().nullable(),
  account_name: z.string().nullable(),
  category_id: z.string().nullable(),
  category_name: z.string().nullable(),
  category_color: z.string().nullable(),
  category_type: TransactionTypeEnum.nullable(),
  account_color: z.string().nullable(),
  exchange_rate: z.number().nullable(),
  notes: z.string().nullable(),
  status: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  amount_cents: z.number().int().nullable(),
  version: z.number().int().nullable(),
  deleted_at: z.string().nullable(),
});

/**
 * transactions_view Row (with JOINed display fields)
 */
export const TransactionsViewRowSchema = z.object({
  id: z.string().nullable(),
  user_id: z.string().nullable(),
  account_id: z.string().nullable(),
  account_name: z.string().nullable(),
  account_color: z.string().nullable(),
  category_id: z.string().nullable(),
  category_name: z.string().nullable(),
  category_color: z.string().nullable(),
  category_type: TransactionTypeEnum.nullable(),
  amount_original: z.number().nullable(),
  amount_home: z.number().nullable(),
  currency_original: z.string().nullable(),
  exchange_rate: z.number().nullable(),
  date: z.string().nullable(),
  description: z.string().nullable(),
  notes: z.string().nullable(),
  source_text: z.string().nullable(),
  transfer_id: z.string().nullable(),
  inbox_id: z.string().nullable(),
  cleared: z.boolean().nullable(),
  reconciliation_id: z.string().nullable(),
  reconciliation_status: ReconciliationStatusEnum.nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
  version: z.number().nullable(),
  amount_cents: z.number().int().nullable(),
  amount_home_cents: z.number().int().nullable(),
});

/**
 * user_settings table Row
 */
export const UserSettingsRowSchema = z.object({
  user_id: uuid,
  main_currency: z.string().nullable(),
  start_of_week: z.number().int().nullable(),
  theme: z.string().nullable(),
  transaction_sort_preference: z.string(),
  created_at: timestamptz,
  updated_at: timestamptz,
});

/**
 * reconciliations table Row
 *
 * SYNC FIELDS (Phase 2a):
 * - version: Optimistic concurrency control via global_transaction_version
 * - deleted_at: Tombstone pattern for distributed sync
 */
export const ReconciliationRowSchema = z.object({
  id: uuid,
  user_id: uuid,
  account_id: uuid,
  name: z.string(),
  beginning_balance_cents: z.number().int(),  // HARDENED: BIGINT cents
  ending_balance_cents: z.number().int(),     // HARDENED: BIGINT cents
  date_start: z.string().nullable(),
  date_end: z.string().nullable(),
  status: ReconciliationStatusEnum,
  created_at: timestamptz,
  updated_at: timestamptz,
  ...BaseSyncFields,
});

/**
 * global_currencies table Row
 *
 * Reference data for currency codes, names, symbols, and flags.
 * Used by currenciesApi for display purposes.
 */
export const GlobalCurrencyRowSchema = z.object({
  code: z.string(),             // ISO 4217 code (e.g., "USD", "EUR")
  name: z.string(),             // Human-readable name (e.g., "US Dollar")
  symbol: z.string(),           // Currency symbol (e.g., "$", "€")
  flag: z.string().nullable(),  // Emoji flag or null
});

/**
 * parent_categories_with_counts view Row
 */
export const ParentCategoryWithCountRowSchema = z.object({
  id: z.string().nullable(),
  user_id: z.string().nullable(),
  name: z.string().nullable(),
  type: TransactionTypeEnum.nullable(),
  color: z.string().nullable(),
  parent_id: z.string().nullable(),
  transaction_count: z.number().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

// ============================================================================
// RPC RESPONSE SCHEMAS (Custom JSONB returns)
// ============================================================================

/**
 * get_reconciliation_summary RPC response
 * Returns camelCase JSONB (not snake_case)
 * HARDENED: All amounts in integer cents (BIGINT)
 */
export const ReconciliationSummaryRpcSchema = z.object({
  beginningBalanceCents: z.number().int(),  // HARDENED: BIGINT cents
  endingBalanceCents: z.number().int(),     // HARDENED: BIGINT cents
  linkedSumCents: z.number().int(),         // HARDENED: BIGINT cents
  linkedCount: z.number().int(),
  differenceCents: z.number().int(),        // HARDENED: BIGINT cents
  isBalanced: z.boolean(),
});

/**
 * link_transactions_to_reconciliation / unlink_transactions_from_reconciliation RPC response
 */
export const LinkUnlinkRpcSchema = z.object({
  success: z.boolean(),
  successCount: z.number().int(),
  errorCount: z.number().int(),
  errors: z.array(z.object({
    transactionId: z.string(),
    error: z.string(),
  })),
});

/**
 * import_transactions RPC response
 */
export const ImportResultRpcSchema = z.object({
  success: z.number().int().min(0),
  failed: z.number().int().min(0),
  errors: z.array(z.string()),
});

/**
 * get_monthly_spending_by_category RPC response row
 * Used by dashboardApi for financial overview
 */
export const MonthlySpendingRpcRowSchema = z.object({
  category_id: uuid,
  category_name: z.string(),
  category_color: z.string(),
  month_key: z.string(),
  total_amount: z.number(),
});

// ============================================================================
// SYNC RPC SCHEMAS (for pull-engine.ts)
// The get_changes_since RPC returns renamed columns:
//   amount_original → amount_cents
//   amount_home → amount_home_cents
//   current_balance → current_balance_cents
// ============================================================================

/**
 * get_sync_changes_summary_v2 RPC response
 */
export const SyncChangesSummarySchema = z.object({
  has_changes: z.boolean(),
  latest_server_version: z.number().int(),
  since_version: z.number().int(),
});

/**
 * get_changes_since RPC envelope
 */
export const ChangesResponseSchema = z.object({
  records: z.array(z.record(z.string(), z.unknown())),
});

/**
 * Per-table sync record schemas for pull-engine validation.
 * These use .passthrough() to tolerate new DB columns without breaking.
 *
 * IMPORTANT: Field names match the get_changes_since RPC output,
 * NOT the raw table column names. The RPC renames:
 * - amount_original → amount_cents
 * - amount_home → amount_home_cents
 * - current_balance → current_balance_cents
 */
export const SyncRecordSchemas = {
  bank_accounts: z.object({
    id: uuid,
    group_id: uuid.nullable(),
    user_id: uuid,
    name: z.string(),
    type: AccountTypeEnum,
    currency_code: z.string(),
    color: z.string(),
    is_visible: z.boolean(),
    current_balance_cents: z.number().int(),
    created_at: timestamptz,
    updated_at: timestamptz,
    ...BaseSyncFields,
  }).passthrough(),

  transactions: z.object({
    id: uuid,
    user_id: uuid,
    account_id: uuid,
    category_id: uuid.nullable(),
    amount_cents: z.number().int(),
    amount_home_cents: z.number().int(),
    exchange_rate: z.number(),
    date: z.string(),
    description: z.string().nullable(),
    notes: z.string().nullable(),
    source_text: z.string().nullable(),
    transfer_id: uuid.nullable(),
    inbox_id: uuid.nullable(),
    cleared: z.boolean(),
    reconciliation_id: uuid.nullable(),
    created_at: timestamptz,
    updated_at: timestamptz,
    ...BaseSyncFields,
  }).passthrough(),

  categories: z.object({
    id: uuid,
    user_id: uuid.nullable(),
    name: z.string(),
    type: TransactionTypeEnum,
    color: z.string(),
    parent_id: uuid.nullable(),
    created_at: timestamptz,
    updated_at: timestamptz,
    ...BaseSyncFields,
  }).passthrough(),

  transaction_inbox: z.object({
    id: uuid,
    user_id: uuid,
    amount_cents: z.number().nullable(),
    description: z.string().nullable(),
    date: z.string().nullable(),
    source_text: z.string().nullable(),
    account_id: uuid.nullable(),
    category_id: uuid.nullable(),
    exchange_rate: z.number().nullable(),
    notes: z.string().nullable(),
    status: z.string(),
    created_at: timestamptz,
    updated_at: timestamptz,
    ...BaseSyncFields,
  }).passthrough(),
} as const;

/**
 * Table batch result from batch_upsert_* RPCs (push-engine)
 */
export const TableBatchResultSchema = z.object({
  synced_ids: z.array(z.string()),
  conflict_ids: z.array(z.string()),
  error_map: z.record(z.string(), z.string()),
});
