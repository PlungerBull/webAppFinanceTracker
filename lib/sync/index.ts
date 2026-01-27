/**
 * Sync Module
 *
 * Handles data synchronization between WatermelonDB (local) and Supabase (remote).
 *
 * CTO MANDATES:
 * - Initial Hydration: One-shot bootstrap from server to local
 * - Delta Sync: Incremental sync for ongoing changes
 * - Two-Phase Push: Prune (deletes) → Plant (upserts)
 * - Atomic High-Water Mark: Only update after ALL tables succeed
 * - Mutation Locking: Prevent overwrite during sync
 * - Tombstone Pruning: Physical delete after 30 days
 *
 * @module sync
 */

// ============================================================================
// INITIAL HYDRATION (Phase 2c)
// ============================================================================

export {
  InitialHydrationService,
  createInitialHydrationService,
} from './initial-hydration-service';
export type {
  IInitialHydrationService,
  HydrationResult,
  HydrationStatus,
} from './initial-hydration-service';

// ============================================================================
// DELTA SYNC ENGINE (Phase 2d)
// ============================================================================

// Main Orchestrator
export {
  DeltaSyncEngine,
  createDeltaSyncEngine,
} from './delta-sync-engine';
export type { IDeltaSyncEngine } from './delta-sync-engine';

// Push Engine (Local → Server)
export { PushEngine, createPushEngine } from './push-engine';

// Pull Engine (Server → Local)
export { PullEngine, createPullEngine } from './pull-engine';

// Sync Metadata Manager
export {
  SyncMetadataManager,
  createSyncMetadataManager,
} from './sync-metadata-manager';
export type { PruneResult } from './sync-metadata-manager';

// Sync Lock Manager (Mutation Locking)
export {
  SyncLockManager,
  getSyncLockManager,
  resetSyncLockManager,
} from './sync-lock-manager';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

export type {
  // Configuration
  SyncConfig,
  SyncPhase,
  // Records
  PendingRecord,
  PendingBatch,
  ServerChangeRecord,
  TableChanges,
  // Results
  TableBatchResult,
  BatchPushResult,
  PhaseResult,
  PushResult,
  PullResult,
  SyncCycleResult,
  // Conflicts
  ConflictRecord,
  ConflictResolution,
  // Status
  SyncEngineStatus,
  // Buffering
  BufferedUpdate,
  // Server Responses
  SyncChangesSummary,
  ChangesResponse,
} from './types';

export {
  // Configuration
  DEFAULT_SYNC_CONFIG,
  // Table Order
  PRUNE_ORDER,
  PLANT_ORDER,
  PULL_ORDER,
  SYNCABLE_TABLES,
  // RPC Names
  BATCH_UPSERT_RPC_NAMES,
  GET_CHANGES_SINCE_RPC,
  GET_SYNC_SUMMARY_RPC,
  // Timing
  IDLE_CALLBACK_TIMEOUT_MS,
  MIN_SYNC_INTERVAL_MS,
} from './constants';
export type { SyncableTableName } from './constants';

// ============================================================================
// REACT HOOKS
// ============================================================================

// Initial Hydration Hook
export { useInitialHydration } from './hooks/use-initial-hydration';

// Delta Sync Hook
export { useDeltaSync, useSyncTrigger } from './hooks/use-delta-sync';
export type {
  UseDeltaSyncOptions,
  UseDeltaSyncReturn,
  SyncContextValue,
} from './hooks/use-delta-sync';
