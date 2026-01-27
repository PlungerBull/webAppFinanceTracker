/**
 * Delta Sync Engine Constants
 *
 * Configuration defaults and table ordering for sync operations.
 *
 * CTO MANDATES:
 * - Table Dependency Hierarchy for push ordering
 * - Two-phase push: Prune (deletes) → Plant (upserts)
 *
 * @module sync/constants
 */

import type { SyncConfig } from './types';
import {
  TABLE_NAMES,
  DERIVED_SYNC_ORDER,
  type SyncableTable,
} from '@/lib/local-db/schema';

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default sync configuration
 *
 * Performance targets:
 * - Push: < 300ms round-trip
 * - Pull: < 100ms fetch
 * - Quick check: < 10ms
 */
export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  syncIntervalMs: 30_000, // 30 seconds
  pushBatchSize: 50, // 50 records per batch
  pullBatchSize: 500, // 500 records per pull request
  maxRetries: 3, // 3 retry attempts
  initialRetryDelayMs: 1_000, // 1 second initial delay
  maxRetryDelayMs: 30_000, // 30 second max delay
  syncOnFocus: true, // Sync when app gains focus
  syncOnReconnect: true, // Sync when network reconnects
  tombstonePruneDays: 30, // Physical delete after 30 days
  maxPullRecordsPerTable: 10_000, // Safety limit: 20x batch size
};

// ============================================================================
// TABLE SYNC ORDER (Derived from TABLE_DEPENDENCIES in schema.ts)
// ============================================================================

/**
 * Table sync order for PRUNING phase (deletes first)
 *
 * CTO MANDATE: Delete-Create Race Condition Fix
 * Derived from TABLE_DEPENDENCIES via topological sort.
 *
 * Order: Parent tables first, then dependent tables
 * This ensures foreign key constraints aren't violated when
 * a user deletes an account and creates a new one with the same name.
 */
export const PRUNE_ORDER: readonly SyncableTable[] = DERIVED_SYNC_ORDER;

/**
 * Table sync order for PLANTING phase (creates/updates second)
 *
 * CTO MANDATE: Dependency-aware ordering
 * Derived from TABLE_DEPENDENCIES via topological sort.
 *
 * Order: Parent tables first (accounts, categories), then dependent (transactions, inbox)
 * This ensures foreign keys exist before referencing records are created.
 */
export const PLANT_ORDER: readonly SyncableTable[] = DERIVED_SYNC_ORDER;

/**
 * Table sync order for PULL phase
 *
 * Same as plant order - parent tables first.
 * Derived from TABLE_DEPENDENCIES via topological sort.
 */
export const PULL_ORDER: readonly SyncableTable[] = DERIVED_SYNC_ORDER;

/**
 * Tables that support sync
 *
 * Derived from TABLE_DEPENDENCIES keys.
 * Excludes:
 * - global_currencies (read-only reference)
 * - sync_metadata (local-only tracking)
 */
export const SYNCABLE_TABLES: readonly SyncableTable[] = DERIVED_SYNC_ORDER;

export type SyncableTableName = SyncableTable;

// ============================================================================
// RPC FUNCTION NAMES
// ============================================================================

/**
 * Union type for batch upsert RPC function names
 */
export type BatchUpsertRpcName =
  | 'batch_upsert_accounts'
  | 'batch_upsert_categories'
  | 'batch_upsert_inbox'
  | 'batch_upsert_transactions';

/**
 * Batch upsert RPC function names by table
 */
export const BATCH_UPSERT_RPC_NAMES: Record<SyncableTableName, BatchUpsertRpcName> = {
  [TABLE_NAMES.BANK_ACCOUNTS]: 'batch_upsert_accounts',
  [TABLE_NAMES.TRANSACTIONS]: 'batch_upsert_transactions',
  [TABLE_NAMES.CATEGORIES]: 'batch_upsert_categories',
  [TABLE_NAMES.TRANSACTION_INBOX]: 'batch_upsert_inbox',
};

/**
 * RPC function for incremental pull
 */
export const GET_CHANGES_SINCE_RPC = 'get_changes_since';

/**
 * RPC function for quick sync summary check
 *
 * CTO MANDATE: Returns has_changes + latest_server_version for 10ms early-exit
 */
export const GET_SYNC_SUMMARY_RPC = 'get_sync_changes_summary_v2';

// ============================================================================
// TIMING CONSTANTS
// ============================================================================

/**
 * requestIdleCallback timeout for Safari fallback
 */
export const IDLE_CALLBACK_TIMEOUT_MS = 5_000;

/**
 * Minimum time between sync cycles (debounce)
 */
export const MIN_SYNC_INTERVAL_MS = 5_000;
