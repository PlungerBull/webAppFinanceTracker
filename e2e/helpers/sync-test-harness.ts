/**
 * Sync Test Harness — Layered Conflict Seeding
 *
 * CTO MANDATE: Deterministic collision = Local Truth + Remote Truth.
 *
 * Layer 1 (Direct WatermelonDB Injection):
 *   Sets local state via page.evaluate() + db.write().
 *   The client "believes" it has version N with amount X.
 *
 * Layer 2 (RPC Interception):
 *   Mocks Supabase RPC responses via page.route().
 *   The server "claims" version N+1 with amount Y.
 *   CTO: Only used for negative tests (500, 429, latency).
 *
 * Combined: The push engine detects the mismatch and transitions
 * the record to 'conflict' status, triggering the UI flow.
 *
 * @module e2e/helpers/sync-test-harness
 */

import type { Page } from '@playwright/test';
import { TEST_USER_ID, SYNC_ERROR_MESSAGES } from './constants';

// ============================================================================
// LAYER 1: Direct WatermelonDB Injection (Local Truth)
// ============================================================================

/**
 * Inject a record into WatermelonDB via page.evaluate()
 *
 * Creates a new record in the specified table with all provided fields.
 * The record is written directly to the local database, bypassing the
 * sync engine entirely.
 *
 * @param page - Playwright page instance
 * @param table - WatermelonDB table name (e.g., 'bank_accounts', 'transactions')
 * @param record - Record data including id and all required fields
 */
export async function injectLocalRecord(
  page: Page,
  table: string,
  record: Record<string, unknown>,
): Promise<void> {
  await page.evaluate(
    async ({ table, record }) => {
      const db = (window as Window & { __watermelondb?: { write: Function; get: Function } })
        .__watermelondb;
      if (!db) {
        throw new Error(
          'WatermelonDB not exposed on window. Is NEXT_PUBLIC_E2E=true?',
        );
      }

      await db.write(async () => {
        const collection = db.get(table);
        await (collection as { create: Function }).create((rec: { _raw: Record<string, unknown> }) => {
          Object.entries(record).forEach(([key, value]) => {
            rec._raw[key] = value;
          });
        });
      });
    },
    { table, record },
  );
}

/**
 * Update an existing WatermelonDB record to conflict status
 *
 * @param page - Playwright page instance
 * @param table - WatermelonDB table name
 * @param id - Record ID to mark as conflicted
 * @param syncError - Error message to set
 */
export async function markRecordAsConflict(
  page: Page,
  table: string,
  id: string,
  syncError: string,
): Promise<void> {
  await page.evaluate(
    async ({ table, id, syncError }) => {
      const db = (window as Window & { __watermelondb?: { write: Function; get: Function } })
        .__watermelondb;
      if (!db) {
        throw new Error('WatermelonDB not exposed on window.');
      }

      const record = await (db.get(table) as { find: Function }).find(id);
      await db.write(async () => {
        await (record as { update: Function }).update((r: { _raw: Record<string, unknown> }) => {
          r._raw.local_sync_status = 'conflict';
          r._raw.sync_error = syncError;
        });
      });
    },
    { table, id, syncError },
  );
}

/**
 * Read a record's sync status from WatermelonDB
 *
 * Useful for asserting that retry/delete operations changed the record state.
 */
export async function getRecordSyncStatus(
  page: Page,
  table: string,
  id: string,
): Promise<{ localSyncStatus: string; syncError: string | null } | null> {
  return page.evaluate(
    async ({ table, id }) => {
      const db = (window as Window & { __watermelondb?: { get: Function } })
        .__watermelondb;
      if (!db) return null;

      try {
        const record = await (db.get(table) as { find: Function }).find(id);
        const raw = (record as { _raw: Record<string, unknown> })._raw;
        return {
          localSyncStatus: raw.local_sync_status as string,
          syncError: (raw.sync_error as string) || null,
        };
      } catch {
        return null; // Record deleted or not found
      }
    },
    { table, id },
  );
}

// ============================================================================
// LAYER 2: RPC Interception (Remote Truth — Negative Tests Only)
// ============================================================================

/**
 * Intercept a batch_upsert RPC to return conflict IDs
 *
 * CTO MANDATE: Only use for negative/edge-case testing.
 * Happy-path tests should use real Supabase.
 *
 * @param page - Playwright page instance
 * @param rpcName - RPC function name (e.g., 'batch_upsert_transactions')
 * @param conflictIds - IDs to return as conflicted
 */
export async function interceptBatchUpsertWithConflict(
  page: Page,
  rpcName: string,
  conflictIds: string[],
): Promise<void> {
  await page.route(`**/rest/v1/rpc/${rpcName}`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        synced_ids: [],
        conflict_ids: conflictIds,
        error_map: {},
      }),
    });
  });
}

/**
 * Intercept a batch_upsert RPC to return a 500 server error
 *
 * CTO MANDATE: Approved for negative tests only.
 */
export async function interceptBatchUpsertWithServerError(
  page: Page,
  rpcName: string,
): Promise<void> {
  await page.route(`**/rest/v1/rpc/${rpcName}`, (route) => {
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'Internal Server Error',
        code: 'PGRST500',
      }),
    });
  });
}

/**
 * Intercept the sync summary RPC to force a sync cycle
 *
 * Returns has_changes: true to ensure the engine attempts a full push/pull.
 */
export async function interceptSyncSummaryWithChanges(page: Page): Promise<void> {
  await page.route('**/rest/v1/rpc/get_sync_changes_summary_v2', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        has_changes: true,
        latest_server_version: 999,
        since_version: 0,
      }),
    });
  });
}

// ============================================================================
// COMBINED: Deterministic Collision Factory
// ============================================================================

interface SeedConflictOptions {
  /** WatermelonDB table name */
  table: 'bank_accounts' | 'transactions' | 'categories' | 'transaction_inbox';
  /** Record UUID */
  recordId: string;
  /** Domain-specific fields (name, amount_cents, etc.) */
  localData: Record<string, unknown>;
  /** Sync error message (defaults to VERSION_MISMATCH) */
  syncError?: string;
  /** Local version number (defaults to 1) */
  version?: number;
  /** Server version number for display (defaults to version + 1) */
  serverVersion?: number;
}

/**
 * Seed a complete conflict record in WatermelonDB
 *
 * Injects a record with all required sync fields pre-set to 'conflict' status.
 * This is the primary helper for most E2E conflict tests.
 *
 * @example
 * ```typescript
 * await seedConflictScenario(page, {
 *   table: 'bank_accounts',
 *   recordId: TEST_RECORDS.CONFLICTED_ACCOUNT.id,
 *   localData: TEST_RECORDS.CONFLICTED_ACCOUNT,
 * });
 * ```
 */
export async function seedConflictScenario(
  page: Page,
  options: SeedConflictOptions,
): Promise<void> {
  const {
    table,
    recordId,
    localData,
    syncError = SYNC_ERROR_MESSAGES.VERSION_MISMATCH,
    version = 1,
  } = options;

  const now = Date.now();

  await injectLocalRecord(page, table, {
    id: recordId,
    user_id: TEST_USER_ID,
    version,
    local_sync_status: 'conflict',
    sync_error: syncError,
    deleted_at: null,
    created_at: now,
    updated_at: now,
    ...localData,
  });
}
