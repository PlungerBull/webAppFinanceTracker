/**
 * Push Engine
 *
 * Handles Local → Server synchronization with two-phase batching.
 *
 * CTO MANDATES:
 * - Two-Phase Push: Prune (deletes) → Plant (upserts)
 * - MUST use batching (1 request per table, not per record)
 * - MUST handle 409 conflicts (mark as 'conflict')
 * - MUST use mutation locking to prevent overwrite race conditions
 * - Per-item error granularity (1 bad record doesn't fail 49 good ones)
 *
 * Delete-Create Race Condition Fix:
 * By processing deletes BEFORE creates, we avoid unique constraint violations
 * when a user deletes an account and creates a new one with the same name.
 *
 * @module sync/push-engine
 */

import type { Database, Model } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database as SupabaseDatabase, Json } from '@/types/supabase';
import type {
  PendingRecord,
  BatchPushResult,
  PushResult,
  PhaseResult,
  TableBatchResult,
  BufferedUpdate,
} from './types';
import {
  TABLE_NAMES,
  SYNC_STATUS,
  pendingSyncFilter,
  deletedOnlyFilter,
  activeTombstoneFilter,
} from '@/lib/local-db';
import type { SyncStatus, TableName } from '@/lib/local-db';
import {
  PRUNE_ORDER,
  PLANT_ORDER,
  BATCH_UPSERT_RPC_NAMES,
  DEFAULT_SYNC_CONFIG,
  type SyncableTableName,
  type BatchUpsertRpcName,
} from './constants';
import type { SyncConfig } from './types';
import { SyncLockManager, getSyncLockManager } from './sync-lock-manager';
import {
  assertIntegerCents,
  isCentsField,
  type SyncableModelFields,
} from './type-utils';

/**
 * Push Engine
 *
 * Orchestrates pushing local pending changes to Supabase.
 * Uses two-phase approach: prune (deletes) first, then plant (upserts).
 */
export class PushEngine {
  private readonly lockManager: SyncLockManager;
  private readonly config: SyncConfig;

  constructor(
    private readonly database: Database,
    private readonly supabase: SupabaseClient<SupabaseDatabase>,
    lockManager?: SyncLockManager,
    config: Partial<SyncConfig> = {}
  ) {
    this.lockManager = lockManager ?? getSyncLockManager();
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
  }

  // ===========================================================================
  // MAIN PUSH OPERATION
  // ===========================================================================

  /**
   * Push all pending changes to server
   *
   * CTO MANDATE: Two-phase push
   * 1. PRUNE PHASE: Process all deletes first (in dependency order)
   * 2. PLANT PHASE: Process all creates/updates second (in dependency order)
   *
   * This order prevents Delete-Create race conditions.
   *
   * @param userId - User ID for sync operations
   * @returns Push result with per-table breakdown
   */
  async pushPendingChanges(userId: string): Promise<PushResult> {
    const startTime = Date.now();
    const allResults: BatchPushResult[] = [];
    let totalPushed = 0;
    let totalConflicts = 0;
    let totalFailures = 0;

    try {
      // PHASE 1: PRUNING (Deletes First)
      const pruneResult = await this.runPruningPhase(userId);
      allResults.push(...pruneResult.results);
      totalPushed += pruneResult.totalProcessed;
      totalConflicts += pruneResult.totalConflicts;
      totalFailures += pruneResult.totalFailures;

      // PHASE 2: PLANTING (Creates/Updates Second)
      const plantResult = await this.runPlantingPhase(userId);
      allResults.push(...plantResult.results);
      totalPushed += plantResult.totalProcessed;
      totalConflicts += plantResult.totalConflicts;
      totalFailures += plantResult.totalFailures;

      // Handle buffered updates (user edited while sync was in progress)
      await this.processBufferedUpdates();

      return {
        success: totalFailures === 0,
        results: allResults,
        totalPushed,
        totalConflicts,
        totalFailures,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[PushEngine] Push failed:', error);
      return {
        success: false,
        results: allResults,
        totalPushed,
        totalConflicts,
        totalFailures,
        durationMs: Date.now() - startTime,
      };
    }
  }

  // ===========================================================================
  // PRUNING PHASE (Deletes)
  // ===========================================================================

  /**
   * Run the pruning phase - process all deletes
   *
   * CTO MANDATE: Delete-Create Race Condition Fix
   * Deletes must be processed BEFORE creates to avoid unique constraint violations.
   *
   * Order: accounts → categories → transactions → inbox
   */
  private async runPruningPhase(userId: string): Promise<PhaseResult> {
    const results: BatchPushResult[] = [];
    let totalProcessed = 0;
    let totalConflicts = 0;
    let totalFailures = 0;

    for (const tableName of PRUNE_ORDER) {
      // Get records: deleted_at IS NOT NULL AND local_sync_status = 'pending'
      const deletes = await this.getDeletePending(userId, tableName);
      if (deletes.length === 0) continue;

      // Lock records to prevent concurrent edits during push
      const ids = deletes.map((r) => r.id);
      this.lockManager.lockRecords(ids);

      try {
        const result = await this.pushBatch(userId, tableName, deletes);
        results.push(result);
        totalProcessed += result.successCount;
        totalConflicts += result.conflictCount;
        totalFailures += result.errorCount;
      } finally {
        this.lockManager.unlockRecords(ids);
      }
    }

    return {
      success: totalFailures === 0,
      results,
      totalProcessed,
      totalConflicts,
      totalFailures,
    };
  }

  // ===========================================================================
  // PLANTING PHASE (Creates/Updates)
  // ===========================================================================

  /**
   * Run the planting phase - process all creates and updates
   *
   * Order: accounts → categories → transactions → inbox
   * (Parent tables first, then dependent tables)
   */
  private async runPlantingPhase(userId: string): Promise<PhaseResult> {
    const results: BatchPushResult[] = [];
    let totalProcessed = 0;
    let totalConflicts = 0;
    let totalFailures = 0;

    for (const tableName of PLANT_ORDER) {
      // Get records: deleted_at IS NULL AND local_sync_status = 'pending'
      const upserts = await this.getUpsertPending(userId, tableName);
      if (upserts.length === 0) continue;

      // Lock records to prevent concurrent edits during push
      const ids = upserts.map((r) => r.id);
      this.lockManager.lockRecords(ids);

      try {
        const result = await this.pushBatch(userId, tableName, upserts);
        results.push(result);
        totalProcessed += result.successCount;
        totalConflicts += result.conflictCount;
        totalFailures += result.errorCount;
      } finally {
        this.lockManager.unlockRecords(ids);
      }
    }

    return {
      success: totalFailures === 0,
      results,
      totalProcessed,
      totalConflicts,
      totalFailures,
    };
  }

  // ===========================================================================
  // QUERY PENDING RECORDS
  // ===========================================================================

  /**
   * Get pending delete records for a table
   *
   * Returns records where:
   * - deleted_at IS NOT NULL (soft-deleted)
   * - local_sync_status = 'pending'
   */
  private async getDeletePending(
    userId: string,
    tableName: SyncableTableName
  ): Promise<PendingRecord[]> {
    const records = await this.database
      .get(tableName)
      .query(
        Q.where('user_id', userId),
        ...deletedOnlyFilter(),
        ...pendingSyncFilter()
      )
      .fetch();

    return records.map((record: Model) =>
      this.toPendingRecord(tableName, this.extractModelRaw(record), true)
    );
  }

  /**
   * Get pending upsert records for a table
   *
   * Returns records where:
   * - deleted_at IS NULL (active)
   * - local_sync_status = 'pending'
   */
  private async getUpsertPending(
    userId: string,
    tableName: SyncableTableName
  ): Promise<PendingRecord[]> {
    const records = await this.database
      .get(tableName)
      .query(
        Q.where('user_id', userId),
        ...activeTombstoneFilter(),
        ...pendingSyncFilter()
      )
      .fetch();

    return records.map((record: Model) =>
      this.toPendingRecord(tableName, this.extractModelRaw(record), false)
    );
  }

  /**
   * Extract raw data from WatermelonDB model
   *
   * WatermelonDB stores data in _raw property. We extract it for type-safe access.
   */
  private extractModelRaw(model: Model): Record<string, unknown> {
    const raw = (model as unknown as { _raw: Record<string, unknown> })._raw;
    return { id: model.id, ...raw };
  }

  // ===========================================================================
  // BATCH PUSH TO SERVER
  // ===========================================================================

  /**
   * Push a batch of records to the server
   *
   * CTO MANDATE: Single request for all records in batch.
   * Uses table-specific batch_upsert RPC function.
   */
  private async pushBatch(
    userId: string,
    tableName: SyncableTableName,
    records: PendingRecord[]
  ): Promise<BatchPushResult> {
    const syncedIds: string[] = [];
    const conflictIds: string[] = [];
    const failedIds: Array<{ id: string; error: string }> = [];
    const serverVersions = new Map<string, number>();

    try {
      // Get the RPC function name for this table
      const rpcName = BATCH_UPSERT_RPC_NAMES[tableName] as BatchUpsertRpcName;

      // Call batch upsert RPC with properly typed arguments
      const { data, error } = await this.supabase.rpc(rpcName, {
        p_user_id: userId,
        p_records: records.map((r) => r.data) as Json[],
      });

      if (error) {
        // RPC failed entirely - mark all as failed but still pending for retry
        console.error(`[PushEngine] RPC ${rpcName} failed:`, error);
        records.forEach((r) =>
          failedIds.push({ id: r.id, error: error.message })
        );
        return this.buildBatchResult(
          tableName,
          syncedIds,
          conflictIds,
          failedIds,
          serverVersions
        );
      }

      // Process RPC result
      const result = data as unknown as TableBatchResult;

      // Update local records based on result
      await this.database.write(async () => {
        // Handle synced records
        for (const id of result.synced_ids || []) {
          syncedIds.push(id);
          // Note: Server returns new_version in the synced record
          // For now, we mark as synced - version tracking handled separately
          await this.updateRecordSyncStatus(tableName, id, SYNC_STATUS.SYNCED);
        }

        // Handle conflicts (409)
        for (const id of result.conflict_ids || []) {
          conflictIds.push(id);
          await this.updateRecordSyncStatus(tableName, id, SYNC_STATUS.CONFLICT);
        }

        // Handle per-item errors (remain pending for retry)
        for (const [id, errorMsg] of Object.entries(result.error_map || {})) {
          failedIds.push({ id, error: errorMsg });
          // Don't update status - stays 'pending' for retry
        }
      });
    } catch (error) {
      // Unexpected error - mark all as failed
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[PushEngine] Unexpected error pushing ${tableName}:`, error);
      records.forEach((r) => failedIds.push({ id: r.id, error: message }));
    }

    return this.buildBatchResult(
      tableName,
      syncedIds,
      conflictIds,
      failedIds,
      serverVersions
    );
  }

  // ===========================================================================
  // LOCAL RECORD UPDATES
  // ===========================================================================

  /**
   * Update a single record's sync status
   */
  private async updateRecordSyncStatus(
    tableName: TableName,
    id: string,
    status: SyncStatus,
    serverVersion?: number
  ): Promise<void> {
    try {
      const record = await this.database.get(tableName).find(id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- WatermelonDB callback type
      await record.update((r: any) => {
        r.localSyncStatus = status;
        if (serverVersion !== undefined) {
          r.version = serverVersion;
        }
      });
    } catch (error) {
      console.error(
        `[PushEngine] Failed to update sync status for ${tableName}/${id}:`,
        error
      );
    }
  }

  // ===========================================================================
  // BUFFERED UPDATES
  // ===========================================================================

  /**
   * Process buffered updates from during sync
   *
   * If a user edited a record while it was being synced, the update was
   * buffered. Now we apply those updates and re-mark as 'pending'.
   */
  private async processBufferedUpdates(): Promise<void> {
    const buffered = this.lockManager.flushBuffer();
    if (buffered.length === 0) return;

    console.log(
      `[PushEngine] Processing ${buffered.length} buffered updates`
    );

    await this.database.write(async () => {
      for (const update of buffered) {
        try {
          const record = await this.database
            .get(update.tableName)
            .find(update.id);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- WatermelonDB callback type
          await record.update((r: any) => {
            // Apply the buffered update data with cents validation
            for (const [key, value] of Object.entries(update.updateData)) {
              // CTO MANDATE: Validate cents fields at sync boundary
              if (isCentsField(key) && typeof value === 'number') {
                r[key] = assertIntegerCents(value, key);
              } else {
                r[key] = value;
              }
            }
            // Re-mark as pending for next sync cycle
            r.localSyncStatus = SYNC_STATUS.PENDING;
          });
        } catch (error) {
          console.error(
            `[PushEngine] Failed to apply buffered update for ${update.tableName}/${update.id}:`,
            error
          );
        }
      }
    });
  }

  // ===========================================================================
  // RECORD TRANSFORMATION
  // ===========================================================================

  /**
   * Convert WatermelonDB record to PendingRecord
   */
  private toPendingRecord(
    tableName: SyncableTableName,
    record: Record<string, unknown>,
    isDelete: boolean
  ): PendingRecord {
    return {
      id: record.id as string,
      tableName,
      localSyncStatus: record.localSyncStatus as SyncStatus,
      version: record.version as number,
      deletedAt: record.deletedAt as number | null,
      isDelete,
      data: this.extractRecordData(tableName, record),
    };
  }

  /**
   * Extract serializable data from WatermelonDB record for server
   */
  private extractRecordData(
    tableName: SyncableTableName,
    record: Record<string, unknown>
  ): Record<string, unknown> {
    // Common fields
    const baseData: Record<string, unknown> = {
      id: record.id,
      user_id: record.userId,
      version: record.version,
      deleted_at: record.deletedAt
        ? new Date(record.deletedAt as number).toISOString()
        : null,
      created_at: record.createdAt
        ? new Date(record.createdAt as number).toISOString()
        : new Date().toISOString(),
      updated_at: record.updatedAt
        ? new Date(record.updatedAt as number).toISOString()
        : new Date().toISOString(),
    };

    // Table-specific fields
    switch (tableName) {
      case TABLE_NAMES.BANK_ACCOUNTS:
        return {
          ...baseData,
          group_id: record.groupId,
          name: record.name,
          type: record.type,
          currency_code: record.currencyCode,
          color: record.color,
          is_visible: record.isVisible,
          current_balance_cents: record.currentBalanceCents,
        };

      case TABLE_NAMES.TRANSACTIONS:
        return {
          ...baseData,
          account_id: record.accountId,
          category_id: record.categoryId,
          amount_cents: record.amountCents,
          amount_home_cents: record.amountHomeCents,
          exchange_rate: record.exchangeRate,
          date: record.date
            ? new Date(record.date as number).toISOString()
            : null,
          description: record.description,
          notes: record.notes,
          source_text: record.sourceText,
          transfer_id: record.transferId,
          inbox_id: record.inboxId,
          cleared: record.cleared,
          reconciliation_id: record.reconciliationId,
        };

      case TABLE_NAMES.CATEGORIES:
        return {
          ...baseData,
          name: record.name,
          type: record.type,
          color: record.color,
          parent_id: record.parentId,
        };

      case TABLE_NAMES.TRANSACTION_INBOX:
        return {
          ...baseData,
          amount_cents: record.amountCents,
          description: record.description,
          date: record.date
            ? new Date(record.date as number).toISOString()
            : null,
          source_text: record.sourceText,
          account_id: record.accountId,
          category_id: record.categoryId,
          exchange_rate: record.exchangeRate,
          notes: record.notes,
          status: record.status,
        };

      default:
        return baseData;
    }
  }

  // ===========================================================================
  // RESULT BUILDING
  // ===========================================================================

  /**
   * Build BatchPushResult from component arrays
   */
  private buildBatchResult(
    tableName: TableName,
    syncedIds: string[],
    conflictIds: string[],
    failedIds: Array<{ id: string; error: string }>,
    serverVersions: Map<string, number>
  ): BatchPushResult {
    return {
      tableName,
      successCount: syncedIds.length,
      conflictCount: conflictIds.length,
      errorCount: failedIds.length,
      syncedIds,
      conflictIds,
      failedIds,
      serverVersions,
    };
  }
}

/**
 * Factory function to create PushEngine
 */
export function createPushEngine(
  database: Database,
  supabase: SupabaseClient<SupabaseDatabase>,
  lockManager?: SyncLockManager,
  config?: Partial<SyncConfig>
): PushEngine {
  return new PushEngine(database, supabase, lockManager, config);
}
