/**
 * Delta Sync Engine
 *
 * Main orchestrator for bidirectional sync between WatermelonDB and Supabase.
 *
 * CTO MANDATES:
 * - Push MUST use batching (1 request per table, not per record)
 * - Push MUST use two-phase (prune → plant) for Delete-Create race condition
 * - Pull MUST be incremental (only fetch version > lastSyncedVersion)
 * - Pull MUST use atomic high-water mark
 * - Sync MUST NEVER block UI (runs in background)
 *
 * Sync Cycle Order:
 * 1. Push local pending changes (Local → Server) - prune then plant
 * 2. Pull server changes (Server → Local) - atomic commit
 *
 * @module sync/delta-sync-engine
 */

import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database as SupabaseDatabase } from '@/types/supabase';
import type {
  SyncConfig,
  SyncCycleResult,
  PushResult,
  PullResult,
  SyncEngineStatus,
  SyncPhase,
  ConflictRecord,
} from './types';
import { PushEngine, createPushEngine } from './push-engine';
import { PullEngine, createPullEngine } from './pull-engine';
import {
  SyncMetadataManager,
  createSyncMetadataManager,
} from './sync-metadata-manager';
import {
  SyncLockManager,
  getSyncLockManager,
} from './sync-lock-manager';
import { DEFAULT_SYNC_CONFIG, SYNCABLE_TABLES } from './constants';
import { pendingSyncFilter, conflictFilter } from '@/lib/local-db';
import * as Sentry from '@sentry/nextjs';

/**
 * Delta Sync Engine Interface
 */
export interface IDeltaSyncEngine {
  pushPendingChanges(): Promise<PushResult>;
  pullIncrementalChanges(): Promise<PullResult>;
  runFullCycle(): Promise<SyncCycleResult>;
  getSyncStatus(): SyncEngineStatus;
  getSyncStatusAsync(): Promise<SyncEngineStatus>;
  getConflicts(): Promise<ConflictRecord[]>;
  deleteConflictRecord(
    id: string,
    tableName: string
  ): Promise<{ success: boolean; error?: string }>;
  setOnlineStatus(isOnline: boolean): void;
  pruneTombstones(): Promise<{ pruned: number }>;
}

/**
 * Delta Sync Engine
 *
 * Coordinates push and pull operations for offline-first sync.
 */
export class DeltaSyncEngine implements IDeltaSyncEngine {
  private readonly pushEngine: PushEngine;
  private readonly pullEngine: PullEngine;
  private readonly metadataManager: SyncMetadataManager;
  private readonly lockManager: SyncLockManager;
  private readonly config: SyncConfig;

  private currentPhase: SyncPhase = 'idle';
  private lastSyncedAt: string | null = null;
  private lastError: string | null = null;
  private isOnline = true;
  private isSyncing = false;

  constructor(
    private readonly database: Database,
    private readonly supabase: SupabaseClient<SupabaseDatabase>,
    private readonly userId: string,
    config: Partial<SyncConfig> = {}
  ) {
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
    this.lockManager = getSyncLockManager();
    this.metadataManager = createSyncMetadataManager(database);
    this.pushEngine = createPushEngine(
      database,
      supabase,
      this.lockManager,
      this.config
    );
    this.pullEngine = createPullEngine(
      database,
      supabase,
      this.metadataManager,
      this.config
    );
  }

  // ===========================================================================
  // PUSH OPERATION
  // ===========================================================================

  /**
   * Push all pending local changes to server
   *
   * CTO MANDATE: Two-phase batched push
   * 1. Prune phase: All deletes first
   * 2. Plant phase: All creates/updates second
   */
  async pushPendingChanges(): Promise<PushResult> {
    if (this.isSyncing) {
      return {
        success: false,
        results: [],
        totalPushed: 0,
        totalConflicts: 0,
        totalFailures: 0,
        durationMs: 0,
      };
    }

    if (!this.isOnline) {
      return {
        success: false,
        results: [],
        totalPushed: 0,
        totalConflicts: 0,
        totalFailures: 0,
        durationMs: 0,
      };
    }

    try {
      this.isSyncing = true;
      this.currentPhase = 'pruning';
      this.lastError = null;

      const result = await this.pushEngine.pushPendingChanges(this.userId);

      if (!result.success) {
        this.lastError = 'Push failed';
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.lastError = message;
      Sentry.captureException(error, {
        tags: {
          'sync.phase': 'push',
          domain: 'sync',
        },
      });

      return {
        success: false,
        results: [],
        totalPushed: 0,
        totalConflicts: 0,
        totalFailures: 0,
        durationMs: 0,
      };
    } finally {
      this.currentPhase = 'idle';
      this.isSyncing = false;
    }
  }

  // ===========================================================================
  // PULL OPERATION
  // ===========================================================================

  /**
   * Pull incremental changes from server
   *
   * CTO MANDATE: Incremental with atomic high-water mark
   * Only fetch records with version > lastSyncedVersion.
   * Update lastSyncedVersion only after ALL tables succeed.
   */
  async pullIncrementalChanges(): Promise<PullResult> {
    if (this.isSyncing) {
      return {
        success: false,
        tableStats: [],
        newHighWaterMark: 0,
        durationMs: 0,
      };
    }

    if (!this.isOnline) {
      return {
        success: false,
        tableStats: [],
        newHighWaterMark: 0,
        durationMs: 0,
      };
    }

    try {
      this.isSyncing = true;
      this.currentPhase = 'pulling';
      this.lastError = null;

      const result = await this.pullEngine.pullIncrementalChanges(this.userId);

      if (!result.success) {
        this.lastError = 'Pull failed';
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.lastError = message;
      Sentry.captureException(error, {
        tags: {
          'sync.phase': 'pull',
          domain: 'sync',
        },
      });

      return {
        success: false,
        tableStats: [],
        newHighWaterMark: 0,
        durationMs: 0,
      };
    } finally {
      this.currentPhase = 'idle';
      this.isSyncing = false;
    }
  }

  // ===========================================================================
  // FULL SYNC CYCLE
  // ===========================================================================

  /**
   * Run a full sync cycle (push then pull)
   *
   * Order matters:
   * 1. Push first - ensures local changes reach server
   * 2. Pull second - gets any server changes (including from other devices)
   */
  async runFullCycle(): Promise<SyncCycleResult> {
    const startTime = Date.now();

    if (this.isSyncing) {
      return {
        success: false,
        pushResult: null,
        pullResult: null,
        durationMs: 0,
        error: new Error('Sync already in progress'),
      };
    }

    if (!this.isOnline) {
      return {
        success: false,
        pushResult: null,
        pullResult: null,
        durationMs: 0,
        error: new Error('Device is offline'),
      };
    }

    try {
      this.isSyncing = true;
      this.lastError = null;

      // Phase 1: Push (prune then plant)
      this.currentPhase = 'pruning';
      const pushResult = await this.pushEngine.pushPendingChanges(this.userId);
      this.currentPhase = 'planting';

      // Phase 2: Pull
      this.currentPhase = 'pulling';
      const pullResult = await this.pullEngine.pullIncrementalChanges(
        this.userId
      );

      // If more records exist (safety limit hit), schedule immediate re-sync
      if (pullResult.hasMore) {
        console.log(
          '[DeltaSyncEngine] More records available, scheduling immediate re-sync'
        );
        queueMicrotask(() => this.runFullCycle());
      }

      // Update last synced time
      const success = pushResult.success && pullResult.success;
      if (success) {
        this.lastSyncedAt = new Date().toISOString();
      } else {
        this.lastError = 'Sync cycle had failures';
      }

      return {
        success,
        pushResult,
        pullResult,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.lastError = message;
      this.currentPhase = 'error';

      Sentry.captureException(error, {
        tags: {
          'sync.phase': this.currentPhase,
          domain: 'sync',
        },
        extra: {
          durationMs: Date.now() - startTime,
        },
      });

      return {
        success: false,
        pushResult: null,
        pullResult: null,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error : new Error(message),
      };
    } finally {
      this.currentPhase = 'idle';
      this.isSyncing = false;
    }
  }

  // ===========================================================================
  // STATUS
  // ===========================================================================

  /**
   * Get current sync status (synchronous)
   *
   * Returns cached counts - use getSyncStatusAsync for live counts.
   */
  getSyncStatus(): SyncEngineStatus {
    return {
      phase: this.currentPhase,
      lastSyncedAt: this.lastSyncedAt,
      lastError: this.lastError,
      pendingCount: 0, // Use getSyncStatusAsync for actual count
      conflictCount: 0, // Use getSyncStatusAsync for actual count
      isOnline: this.isOnline,
    };
  }

  /**
   * Get current sync status with live counts (async)
   */
  async getSyncStatusAsync(): Promise<SyncEngineStatus> {
    const pendingCount = await this.getPendingCount();
    const conflictCount = await this.getConflictCount();

    return {
      phase: this.currentPhase,
      lastSyncedAt: this.lastSyncedAt,
      lastError: this.lastError,
      pendingCount,
      conflictCount,
      isOnline: this.isOnline,
    };
  }

  /**
   * Check if sync is currently in progress
   */
  isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  // ===========================================================================
  // CONFLICTS
  // ===========================================================================

  /**
   * Get all conflict records for resolution UI
   */
  async getConflicts(): Promise<ConflictRecord[]> {
    const conflicts: ConflictRecord[] = [];

    for (const tableName of SYNCABLE_TABLES) {
      const records = await this.database
        .get(tableName)
        .query(Q.where('user_id', this.userId), ...conflictFilter())
        .fetch();

      for (const record of records) {
        const raw = record._raw as Record<string, unknown>;
        conflicts.push({
          id: record.id,
          tableName,
          localData: raw,
          serverData: null, // Would need separate fetch from server
          localVersion: raw.version as number,
          serverVersion: 0, // Would need separate fetch from server
          detectedAt: new Date().toISOString(),
        });
      }
    }

    return conflicts;
  }

  /**
   * Delete a conflict record permanently from local WatermelonDB
   *
   * Used when user chooses to discard local changes in favor of server version.
   *
   * CTO REQUIREMENT: IDEMPOTENT
   * Returns success if record is already deleted (race condition safe).
   */
  async deleteConflictRecord(
    id: string,
    tableName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const collection = this.database.get(tableName);

      let record;
      try {
        record = await collection.find(id);
      } catch (findError) {
        // RACE CONDITION PROTECTION: Record already deleted by concurrent call
        // Return success for idempotent behavior
        if (
          findError instanceof Error &&
          findError.message.toLowerCase().includes('not found')
        ) {
          return { success: true };
        }
        throw findError;
      }

      // Safety: Only allow deletion of conflict records
      const raw = record._raw as Record<string, unknown>;
      if (raw.local_sync_status !== 'conflict') {
        return {
          success: false,
          error: `Record is not in conflict state (status: ${raw.local_sync_status})`,
        };
      }

      await this.database.write(async () => {
        await record.destroyPermanently();
      });

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Sentry.captureException(error, {
        tags: { operation: 'deleteConflictRecord', tableName },
        extra: { recordId: id },
      });
      return {
        success: false,
        error: message,
      };
    }
  }

  // ===========================================================================
  // ONLINE STATUS
  // ===========================================================================

  /**
   * Set online status
   *
   * Called by the hook when network status changes.
   */
  setOnlineStatus(isOnline: boolean): void {
    this.isOnline = isOnline;
  }

  // ===========================================================================
  // TOMBSTONE PRUNING
  // ===========================================================================

  /**
   * Prune old tombstones
   *
   * CTO MANDATE: Tombstone Pruning
   * Physically deletes records that are deleted, synced, and > 30 days old.
   */
  async pruneTombstones(): Promise<{ pruned: number }> {
    const result = await this.metadataManager.pruneTombstones(
      this.config.tombstonePruneDays
    );
    return { pruned: result.pruned };
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Get count of pending records
   */
  private async getPendingCount(): Promise<number> {
    let count = 0;

    for (const tableName of SYNCABLE_TABLES) {
      const tableCount = await this.database
        .get(tableName)
        .query(Q.where('user_id', this.userId), ...pendingSyncFilter())
        .fetchCount();
      count += tableCount;
    }

    return count;
  }

  /**
   * Get count of conflict records
   */
  private async getConflictCount(): Promise<number> {
    let count = 0;

    for (const tableName of SYNCABLE_TABLES) {
      const tableCount = await this.database
        .get(tableName)
        .query(Q.where('user_id', this.userId), ...conflictFilter())
        .fetchCount();
      count += tableCount;
    }

    return count;
  }
}

/**
 * Factory function to create DeltaSyncEngine
 */
export function createDeltaSyncEngine(
  database: Database,
  supabase: SupabaseClient<SupabaseDatabase>,
  userId: string,
  config?: Partial<SyncConfig>
): IDeltaSyncEngine {
  return new DeltaSyncEngine(database, supabase, userId, config);
}
