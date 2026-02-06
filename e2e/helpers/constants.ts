/**
 * E2E Test Constants
 *
 * Test user ID, record fixtures, and sync error messages
 * for deterministic conflict resolution testing.
 *
 * CTO MANDATE: UUID must match supabase/seed.sql exactly.
 *
 * @module e2e/helpers/constants
 */

/**
 * Test user UUID — matches seed.sql auth.users insert
 */
export const TEST_USER_ID = 'e2e00000-0000-0000-0000-000000000001';

/**
 * Test user credentials — matches seed.sql password
 */
export const TEST_USER = {
  email: 'e2e-test@financetracker.local',
  password: 'TestPassword123!',
} as const;

/**
 * Sync error messages — mirror of lib/sync/constants.ts SYNC_ERROR_MESSAGES
 *
 * Duplicated here to avoid transitive WatermelonDB imports in Playwright context.
 */
export const SYNC_ERROR_MESSAGES = {
  VERSION_MISMATCH:
    'Version conflict: Another device modified this record. Review and retry.',
  VALIDATION_FAILED: 'Validation failed: Record has invalid or missing fields.',
} as const;

/**
 * Pre-built record fixtures for conflict seeding
 *
 * Each fixture provides all required WatermelonDB fields for its table.
 * Sync fields (version, local_sync_status, sync_error, timestamps) are
 * added by the harness — these only provide domain data.
 */
export const TEST_RECORDS = {
  CONFLICTED_ACCOUNT: {
    id: 'e2e-conflict-acct-0000-000000000001',
    name: 'Test Checking Account',
    type: 'checking',
    currency_code: 'USD',
    color: '#3B82F6',
    is_visible: true,
    current_balance_cents: 100000,
    group_id: '',
  },
  CONFLICTED_TRANSACTION: {
    id: 'e2e-conflict-txn-0000-0000-00000001',
    account_id: 'e2e-conflict-acct-0000-000000000001',
    amount_cents: -5000,
    amount_home_cents: -5000,
    exchange_rate: 1,
    description: 'Conflicted Grocery Purchase',
    cleared: false,
    notes: '',
    source_text: '',
    transfer_id: '',
    inbox_id: '',
  },
} as const;

/**
 * Batch upsert RPC names — mirror of lib/sync/constants.ts
 *
 * Used for RPC interception in Layer 2 seeding.
 */
export const BATCH_UPSERT_RPC_NAMES = {
  bank_accounts: 'batch_upsert_accounts',
  transactions: 'batch_upsert_transactions',
  categories: 'batch_upsert_categories',
  transaction_inbox: 'batch_upsert_inbox',
} as const;
