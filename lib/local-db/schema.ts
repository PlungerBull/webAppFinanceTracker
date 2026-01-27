/**
 * WatermelonDB Schema Definition
 *
 * Mirrors the Supabase tables for offline-first sync.
 *
 * CTO MANDATES:
 * - ID Mirror Strategy: `id` is the client-generated UUID (crypto.randomUUID())
 *   Same ID used in both WatermelonDB and Supabase. NO separate server_id.
 * - Integer Cents: All monetary amounts use `type: 'number'` (integers)
 * - Version Sync: Each table has `version` field for optimistic concurrency
 * - Tombstones: Each table has `deleted_at` for distributed sync
 * - Sync Status: 'synced' | 'pending' | 'conflict'
 *
 * CTO GUARDRAILS:
 * - `version` and `updated_at` MUST be indexed for Delta Sync performance
 * - All queries MUST filter `deleted_at` (Tombstone Pattern)
 *
 * @module local-db/schema
 */

import { appSchema, tableSchema } from '@nozbe/watermelondb';

/**
 * Sync Status State Machine
 *
 * CTO MANDATE: Strict transition logic to prevent sync bugs.
 *
 * Transitions:
 * - `pending`: Set for EVERY create/update originating on the client
 * - `synced`: ONLY set by Sync Engine after successful 200/201 from Supabase
 * - `conflict`: Set when server returns 409 Version Conflict
 *
 * UI Requirement:
 * - Records with `pending` status MUST show a "clock" or "syncing" icon
 * - Records with `conflict` status MUST show a "Resolve Conflict" button
 */
export type SyncStatus = 'synced' | 'pending' | 'conflict';

/**
 * Sync Status Constants
 */
export const SYNC_STATUS = {
  /** Matches server state - no pending changes */
  SYNCED: 'synced' as const,
  /** Local changes awaiting push to server */
  PENDING: 'pending' as const,
  /** Server rejected (409), needs manual resolution */
  CONFLICT: 'conflict' as const,
} as const;

/**
 * Current schema version
 * Increment this and add migration when schema changes
 */
export const SCHEMA_VERSION = 1;

/**
 * WatermelonDB App Schema
 *
 * Tables:
 * - bank_accounts: User's financial accounts
 * - transactions: Ledger transactions
 * - categories: Income/expense categories
 * - transaction_inbox: Staging area for unprocessed transactions
 * - global_currencies: Read-only currency reference
 * - sync_metadata: Tracks last synced version per table
 */
export const schema = appSchema({
  version: SCHEMA_VERSION,
  tables: [
    // =========================================================================
    // BANK ACCOUNTS
    // =========================================================================
    tableSchema({
      name: 'bank_accounts',
      columns: [
        // CTO MANDATE: id is used as-is (UUID from crypto.randomUUID())
        { name: 'group_id', type: 'string' },
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'type', type: 'string' }, // 'checking' | 'savings' | 'credit_card' | etc.
        { name: 'currency_code', type: 'string' },
        { name: 'color', type: 'string' },
        { name: 'is_visible', type: 'boolean' },
        { name: 'current_balance_cents', type: 'number' }, // INTEGER CENTS
        // Sync fields (CTO: version & updated_at MUST be indexed for Delta Sync)
        { name: 'version', type: 'number', isIndexed: true },
        { name: 'deleted_at', type: 'number', isOptional: true }, // Tombstone: null = active
        { name: 'local_sync_status', type: 'string' }, // State machine: synced | pending | conflict
        // Timestamps (updated_at indexed for Delta Sync queries)
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number', isIndexed: true },
      ],
    }),

    // =========================================================================
    // TRANSACTIONS
    // =========================================================================
    tableSchema({
      name: 'transactions',
      columns: [
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'account_id', type: 'string', isIndexed: true },
        { name: 'category_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'amount_cents', type: 'number' }, // INTEGER CENTS
        { name: 'amount_home_cents', type: 'number' }, // INTEGER CENTS (home currency)
        { name: 'exchange_rate', type: 'number' },
        { name: 'date', type: 'number', isIndexed: true }, // Timestamp for efficient range queries
        { name: 'description', type: 'string', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'source_text', type: 'string', isOptional: true },
        { name: 'transfer_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'inbox_id', type: 'string', isOptional: true }, // Birth certificate link
        { name: 'cleared', type: 'boolean' },
        { name: 'reconciliation_id', type: 'string', isOptional: true, isIndexed: true },
        // Sync fields (CTO: version & updated_at MUST be indexed for Delta Sync)
        { name: 'version', type: 'number', isIndexed: true },
        { name: 'deleted_at', type: 'number', isOptional: true }, // Tombstone: null = active
        { name: 'local_sync_status', type: 'string' }, // State machine: synced | pending | conflict
        // Timestamps (updated_at indexed for Delta Sync queries)
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number', isIndexed: true },
      ],
    }),

    // =========================================================================
    // CATEGORIES
    // =========================================================================
    tableSchema({
      name: 'categories',
      columns: [
        { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'type', type: 'string' }, // 'income' | 'expense'
        { name: 'color', type: 'string' },
        { name: 'parent_id', type: 'string', isOptional: true, isIndexed: true },
        // Sync fields (CTO: version & updated_at MUST be indexed for Delta Sync)
        { name: 'version', type: 'number', isIndexed: true },
        { name: 'deleted_at', type: 'number', isOptional: true }, // Tombstone: null = active
        { name: 'local_sync_status', type: 'string' }, // State machine: synced | pending | conflict
        // Timestamps (updated_at indexed for Delta Sync queries)
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number', isIndexed: true },
      ],
    }),

    // =========================================================================
    // TRANSACTION INBOX (Staging Area)
    // =========================================================================
    tableSchema({
      name: 'transaction_inbox',
      columns: [
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'amount_cents', type: 'number', isOptional: true }, // INTEGER CENTS
        { name: 'description', type: 'string', isOptional: true },
        { name: 'date', type: 'number', isOptional: true }, // Timestamp
        { name: 'source_text', type: 'string', isOptional: true },
        { name: 'account_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'category_id', type: 'string', isOptional: true },
        { name: 'exchange_rate', type: 'number', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'status', type: 'string' }, // 'pending' | 'processed' | 'ignored'
        // Sync fields (CTO: version & updated_at MUST be indexed for Delta Sync)
        { name: 'version', type: 'number', isIndexed: true },
        { name: 'deleted_at', type: 'number', isOptional: true }, // Tombstone: null = active
        { name: 'local_sync_status', type: 'string' }, // State machine: synced | pending | conflict
        // Timestamps (updated_at indexed for Delta Sync queries)
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number', isIndexed: true },
      ],
    }),

    // =========================================================================
    // GLOBAL CURRENCIES (Read-Only Reference)
    // =========================================================================
    tableSchema({
      name: 'global_currencies',
      columns: [
        // Note: 'id' in WatermelonDB, but we'll store currency 'code' as the id
        { name: 'code', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'symbol', type: 'string' },
        { name: 'flag', type: 'string', isOptional: true },
        // No sync fields - this is a read-only reference table
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // =========================================================================
    // SYNC METADATA (Tracks Sync State)
    // =========================================================================
    tableSchema({
      name: 'sync_metadata',
      columns: [
        { name: 'table_name', type: 'string', isIndexed: true },
        { name: 'last_synced_version', type: 'number' },
        { name: 'last_synced_at', type: 'number' },
        { name: 'sync_error', type: 'string', isOptional: true },
      ],
    }),
  ],
});

/**
 * Table names enum for type-safe table access
 */
export const TABLE_NAMES = {
  BANK_ACCOUNTS: 'bank_accounts',
  TRANSACTIONS: 'transactions',
  CATEGORIES: 'categories',
  TRANSACTION_INBOX: 'transaction_inbox',
  GLOBAL_CURRENCIES: 'global_currencies',
  SYNC_METADATA: 'sync_metadata',
} as const;

export type TableName = (typeof TABLE_NAMES)[keyof typeof TABLE_NAMES];

// =============================================================================
// TABLE DEPENDENCY GRAPH (CTO Mandate: Single Source of Truth)
// =============================================================================

/**
 * Syncable table names (excludes read-only and metadata tables)
 */
export type SyncableTable =
  | typeof TABLE_NAMES.BANK_ACCOUNTS
  | typeof TABLE_NAMES.TRANSACTIONS
  | typeof TABLE_NAMES.CATEGORIES
  | typeof TABLE_NAMES.TRANSACTION_INBOX;

/**
 * Table Dependency Graph
 *
 * CTO MANDATE: Central source of truth for sync ordering.
 * When adding new tables (Goals, Budgets, etc.), add them here ONLY.
 * The sync engine derives PRUNE_ORDER and PLANT_ORDER from this graph.
 *
 * Each table lists its foreign key dependencies.
 * - Empty array = no dependencies (parent table)
 * - Non-empty array = depends on listed tables (child table)
 *
 * Example: transactions depends on accounts and categories
 * because it has account_id and category_id foreign keys.
 */
export const TABLE_DEPENDENCIES: Record<SyncableTable, readonly SyncableTable[]> = {
  [TABLE_NAMES.BANK_ACCOUNTS]: [],
  [TABLE_NAMES.CATEGORIES]: [],
  [TABLE_NAMES.TRANSACTIONS]: [TABLE_NAMES.BANK_ACCOUNTS, TABLE_NAMES.CATEGORIES],
  [TABLE_NAMES.TRANSACTION_INBOX]: [TABLE_NAMES.BANK_ACCOUNTS, TABLE_NAMES.CATEGORIES],
} as const;

/**
 * Derive sync order from dependency graph using topological sort
 *
 * Returns tables in dependency order:
 * - Parent tables first (no dependencies)
 * - Child tables after their dependencies
 *
 * @returns Array of table names in dependency order
 */
export function deriveSyncOrder(): SyncableTable[] {
  const visited = new Set<SyncableTable>();
  const result: SyncableTable[] = [];

  function visit(table: SyncableTable): void {
    if (visited.has(table)) return;
    visited.add(table);

    // Visit dependencies first
    for (const dep of TABLE_DEPENDENCIES[table]) {
      visit(dep);
    }

    result.push(table);
  }

  // Visit all tables
  for (const table of Object.keys(TABLE_DEPENDENCIES) as SyncableTable[]) {
    visit(table);
  }

  return result;
}

/**
 * Cached sync orders (computed once at module load)
 *
 * PLANT_ORDER: Parent tables first (accounts, categories → transactions, inbox)
 * PRUNE_ORDER: Same as plant order for consistency
 *              (deletes are sent in same order, server handles FK constraints)
 */
export const DERIVED_SYNC_ORDER = deriveSyncOrder();
