/**
 * Delta Sync Engine Types
 *
 * Type definitions for the bidirectional sync system.
 *
 * CTO MANDATES:
 * - All sync operations are non-blocking (Background Rule)
 * - Push uses batching (no N+1 requests)
 * - Pull uses incremental version-based sync
 * - Per-item error granularity for debugging
 *
 * @module sync/types
 */

import type { SyncStatus, TableName } from '@/lib/local-db/schema';

// ============================================================================
// SYNC CONFIGURATION
// ============================================================================

/**
 * Sync Engine Configuration
 *
 * Controls sync behavior and performance tuning.
 */
export interface SyncConfig {
  /** Sync interval in milliseconds (default: 30000ms = 30s) */
  syncIntervalMs: number;
  /** Maximum records per batch for push (default: 50) */
  pushBatchSize: number;
  /** Maximum records per pull request (default: 500) */
  pullBatchSize: number;
  /** Maximum retry attempts for transient failures */
  maxRetries: number;
  /** Initial retry delay in milliseconds */
  initialRetryDelayMs: number;
  /** Maximum retry delay in milliseconds */
  maxRetryDelayMs: number;
  /** Whether to sync automatically on app focus */
  syncOnFocus: boolean;
  /** Whether to sync automatically on network reconnect */
  syncOnReconnect: boolean;
  /** Days to keep tombstones before physical deletion (default: 30) */
  tombstonePruneDays: number;
  /** Maximum records to pull per table before stopping (safety limit). Default: 10000 */
  maxPullRecordsPerTable: number;
}

// ============================================================================
// SYNC PHASES
// ============================================================================

/**
 * Current sync operation phase
 *
 * CTO MANDATE: Two-phase push (prune → plant) + pull
 */
export type SyncPhase = 'idle' | 'pruning' | 'planting' | 'pulling' | 'error';

// ============================================================================
// PENDING RECORDS (Local → Server)
// ============================================================================

/**
 * Pending record ready for push
 *
 * Includes sync metadata for conflict detection.
 */
export interface PendingRecord {
  /** Record UUID (mirrors Supabase ID) */
  id: string;
  /** Table this record belongs to */
  tableName: TableName;
  /** Current sync status */
  localSyncStatus: SyncStatus;
  /** Version for optimistic concurrency */
  version: number;
  /** Tombstone timestamp (null = active, number = soft-deleted) */
  deletedAt: number | null;
  /** Whether this is a delete operation (for pruning phase) */
  isDelete: boolean;
  /** Serialized record data for server (null if validation failed) */
  data: Record<string, unknown> | null;
}

/**
 * Batch of pending records grouped by table
 *
 * CTO MANDATE: Batching - Push all records of one table in one request.
 */
export interface PendingBatch {
  tableName: TableName;
  records: PendingRecord[];
}

// ============================================================================
// SERVER RESPONSE TYPES
// ============================================================================

/**
 * Result of a single table batch push operation
 *
 * CTO MANDATE: Per-item error granularity (SAVEPOINT per record)
 */
export interface TableBatchResult {
  /** IDs that were successfully synced */
  synced_ids: string[];
  /** IDs that had version conflicts (409) */
  conflict_ids: string[];
  /** Per-item errors: id → error message */
  error_map: Record<string, string>;
}

/**
 * Processed result for a single table batch
 */
export interface BatchPushResult {
  tableName: TableName;
  successCount: number;
  conflictCount: number;
  errorCount: number;
  /** IDs that were successfully synced */
  syncedIds: string[];
  /** IDs that had version conflicts */
  conflictIds: string[];
  /** IDs that failed for other reasons */
  failedIds: Array<{ id: string; error: string }>;
  /** Server versions returned for successful syncs */
  serverVersions: Map<string, number>;
}

// ============================================================================
// SERVER CHANGE RECORDS (Server → Local)
// ============================================================================

/**
 * Server change record from pull
 */
export interface ServerChangeRecord {
  id: string;
  version: number;
  deletedAt: string | null;
  data: Record<string, unknown>;
}

/**
 * Changes from server for a specific table
 */
export interface TableChanges {
  tableName: TableName;
  /** Records to upsert (deleted_at = null) */
  upserts: ServerChangeRecord[];
  /** Records to soft-delete locally (deleted_at != null) */
  tombstones: ServerChangeRecord[];
}

// ============================================================================
// SYNC RESULTS
// ============================================================================

/**
 * Result of a single phase (prune or plant)
 */
export interface PhaseResult {
  success: boolean;
  results: BatchPushResult[];
  totalProcessed: number;
  totalConflicts: number;
  totalFailures: number;
}

/**
 * Result of push phase (both prune and plant)
 */
export interface PushResult {
  success: boolean;
  /** Per-table results */
  results: BatchPushResult[];
  /** Total records pushed */
  totalPushed: number;
  /** Total conflicts detected */
  totalConflicts: number;
  /** Total failures */
  totalFailures: number;
  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * Result of pull phase
 */
export interface PullResult {
  success: boolean;
  /** Whether there were no changes to pull */
  noChanges?: boolean;
  /** Per-table stats */
  tableStats: Array<{
    tableName: TableName;
    upsertCount: number;
    tombstoneCount: number;
  }>;
  /** New highest version after pull */
  newHighWaterMark: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Whether more records exist (safety limit hit) - triggers immediate re-sync */
  hasMore?: boolean;
}

/**
 * Result of full sync cycle
 */
export interface SyncCycleResult {
  success: boolean;
  pushResult: PushResult | null;
  pullResult: PullResult | null;
  /** Total duration in milliseconds */
  durationMs: number;
  /** Error if sync failed */
  error?: Error;
}

// ============================================================================
// CONFLICT HANDLING
// ============================================================================

/**
 * Conflict record for UI resolution
 */
export interface ConflictRecord {
  id: string;
  tableName: TableName;
  /** Local version of the data */
  localData: Record<string, unknown>;
  /** Server version of the data (fetched on conflict) */
  serverData: Record<string, unknown> | null;
  /** Local version number */
  localVersion: number;
  /** Server version number */
  serverVersion: number;
  /** When conflict was detected */
  detectedAt: string;
}

/**
 * Conflict resolution choice
 */
export type ConflictResolution = 'keep_local' | 'keep_server' | 'manual_merge';

// ============================================================================
// SYNC STATUS
// ============================================================================

/**
 * Current sync engine status
 */
export interface SyncEngineStatus {
  phase: SyncPhase;
  lastSyncedAt: string | null;
  lastError: string | null;
  pendingCount: number;
  conflictCount: number;
  isOnline: boolean;
}

// ============================================================================
// SYNC LOCK MANAGER TYPES
// ============================================================================

/**
 * Buffered update (queued while record is being synced)
 *
 * CTO MANDATE: Mutation Locking prevents overwrite race conditions.
 */
export interface BufferedUpdate {
  id: string;
  tableName: TableName;
  updateData: Record<string, unknown>;
  timestamp: number;
}

/**
 * Result of a local repository mutation with sync-aware buffering
 *
 * CTO MANDATE: When a record is locked during sync, the mutation is buffered
 * and the projected data is returned for optimistic UI updates.
 *
 * @template T - The entity type being mutated
 */
export type MutationResult<T> =
  | { success: true; data: T; buffered: false }
  | { success: true; data: T; buffered: true } // Projected data for optimistic UI
  | { success: false; data: null; error: Error };

// ============================================================================
// SYNC SUMMARY (Server RPC Response)
// ============================================================================

/**
 * Response from get_sync_changes_summary_v2 RPC
 *
 * CTO MANDATE: Quick check for 10ms early-exit optimization.
 */
export interface SyncChangesSummary {
  has_changes: boolean;
  latest_server_version: number;
  since_version: number;
}

/**
 * Response from get_changes_since RPC
 */
export interface ChangesResponse {
  records: Array<Record<string, unknown>>;
}
