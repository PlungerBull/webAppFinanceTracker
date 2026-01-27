/**
 * Pull Engine
 *
 * Handles Server → Local incremental synchronization.
 *
 * CTO MANDATES:
 * - MUST be incremental (only fetch version > lastSyncedVersion)
 * - MUST use atomic high-water mark (all tables or none)
 * - MUST handle tombstones (records with deleted_at)
 * - Quick check for 10ms early-exit optimization
 *
 * Atomic High-Water Mark:
 * If the app crashes after pulling Accounts but before Transactions,
 * we'd have orphaned foreign key references. Solution: Only update
 * lastSyncedVersion after ALL tables have successfully applied changes.
 *
 * @module sync/pull-engine
 */

import type { Database } from '@nozbe/watermelondb';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database as SupabaseDatabase } from '@/types/supabase';
import type {
  PullResult,
  TableChanges,
  ServerChangeRecord,
  SyncChangesSummary,
  ChangesResponse,
  SyncConfig,
} from './types';
import {
  SyncMetadataManager,
  createSyncMetadataManager,
} from './sync-metadata-manager';
import { TABLE_NAMES, SYNC_STATUS } from '@/lib/local-db';
import {
  PULL_ORDER,
  DEFAULT_SYNC_CONFIG,
  type SyncableTableName,
} from './constants';

/**
 * Internal result with pagination metadata
 */
interface FetchResult extends TableChanges {
  hitSafetyLimit: boolean;
}

/**
 * Pull Engine
 *
 * Fetches incremental changes from server and merges into local database.
 * Uses atomic high-water mark to ensure data consistency.
 */
export class PullEngine {
  private readonly metadataManager: SyncMetadataManager;
  private readonly config: SyncConfig;

  constructor(
    private readonly database: Database,
    private readonly supabase: SupabaseClient<SupabaseDatabase>,
    metadataManager?: SyncMetadataManager,
    config: Partial<SyncConfig> = {}
  ) {
    this.metadataManager =
      metadataManager ?? createSyncMetadataManager(database);
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
  }

  // ===========================================================================
  // MAIN PULL OPERATION
  // ===========================================================================

  /**
   * Pull incremental changes from server
   *
   * CTO MANDATE: Incremental & Atomic
   * 1. Get lastSyncedVersion from local sync_metadata
   * 2. Quick check: if no changes, exit in ~10ms
   * 3. Fetch all table changes into memory
   * 4. Apply ALL changes in single database.write() transaction
   * 5. Update high-water mark ONLY after all tables succeed
   *
   * @param userId - User ID for sync operations
   * @returns Pull result with stats
   */
  async pullIncrementalChanges(userId: string): Promise<PullResult> {
    const startTime = Date.now();
    const tableStats: PullResult['tableStats'] = [];

    try {
      // Get last synced version
      const lastSyncedVersion =
        await this.metadataManager.getLastSyncedVersion(userId);

      // OPTIMIZATION: Quick check with latest_server_version (~10ms)
      const summary = await this.checkForChanges(userId, lastSyncedVersion);

      // Early exit if no changes
      if (!summary.has_changes) {
        return {
          success: true,
          noChanges: true,
          tableStats: [],
          newHighWaterMark: lastSyncedVersion,
          durationMs: Date.now() - startTime,
        };
      }

      // If local is already at server version, skip
      if (summary.latest_server_version === lastSyncedVersion) {
        return {
          success: true,
          noChanges: true,
          tableStats: [],
          newHighWaterMark: lastSyncedVersion,
          durationMs: Date.now() - startTime,
        };
      }

      // Collect ALL changes before applying (for atomic commit)
      const allChanges = new Map<SyncableTableName, TableChanges>();
      let maxVersionSeen = lastSyncedVersion;
      let anyTableHitLimit = false;

      for (const tableName of PULL_ORDER) {
        const changes = await this.fetchTableChanges(
          userId,
          tableName,
          lastSyncedVersion
        );

        // Track if any table hit the safety limit
        if (changes.hitSafetyLimit) {
          anyTableHitLimit = true;
        }

        if (changes.upserts.length > 0 || changes.tombstones.length > 0) {
          allChanges.set(tableName, changes);
          tableStats.push({
            tableName,
            upsertCount: changes.upserts.length,
            tombstoneCount: changes.tombstones.length,
          });

          // Track highest version seen
          const tableMaxVersion = this.getMaxVersion(changes);
          if (tableMaxVersion > maxVersionSeen) {
            maxVersionSeen = tableMaxVersion;
          }
        }
      }

      // No changes to apply
      if (allChanges.size === 0) {
        return {
          success: true,
          noChanges: true,
          tableStats: [],
          newHighWaterMark: lastSyncedVersion,
          durationMs: Date.now() - startTime,
        };
      }

      // ATOMIC: Apply all changes in single database.write()
      await this.database.write(async () => {
        for (const [tableName, changes] of allChanges) {
          await this.applyChanges(tableName, changes);
        }

        // ATOMIC: Update high-water mark ONLY after all tables succeed
        await this.metadataManager.updateLastSyncedVersionInTransaction(
          userId,
          maxVersionSeen
        );
      });

      return {
        success: true,
        tableStats,
        newHighWaterMark: maxVersionSeen,
        durationMs: Date.now() - startTime,
        hasMore: anyTableHitLimit,
      };
    } catch (error) {
      console.error('[PullEngine] Pull failed:', error);
      return {
        success: false,
        tableStats,
        newHighWaterMark: 0,
        durationMs: Date.now() - startTime,
      };
    }
  }

  // ===========================================================================
  // QUICK CHECK (10ms Optimization)
  // ===========================================================================

  /**
   * Quick check if there are any changes to pull
   *
   * CTO MANDATE: 10ms early-exit optimization
   * Returns has_changes and latest_server_version for comparison.
   */
  private async checkForChanges(
    userId: string,
    sinceVersion: number
  ): Promise<SyncChangesSummary> {
    const { data, error } = await this.supabase.rpc(
      'get_sync_changes_summary_v2',
      {
        p_user_id: userId,
        p_since_version: sinceVersion,
      }
    );

    if (error) {
      console.warn('[PullEngine] Failed to check changes summary:', error);
      // Assume changes exist if check fails
      return {
        has_changes: true,
        latest_server_version: sinceVersion + 1,
        since_version: sinceVersion,
      };
    }

    return data as unknown as SyncChangesSummary;
  }

  // ===========================================================================
  // FETCH CHANGES
  // ===========================================================================

  /**
   * Fetch ALL changes for a specific table since version
   *
   * CTO MANDATE: Incremental - only fetch version > sinceVersion
   *
   * Uses cursor-based pagination to fetch all records when batch limit is hit.
   * Cursor = max version from previous batch.
   */
  private async fetchTableChanges(
    userId: string,
    tableName: SyncableTableName,
    sinceVersion: number
  ): Promise<FetchResult> {
    const allUpserts: ServerChangeRecord[] = [];
    const allTombstones: ServerChangeRecord[] = [];

    let cursor = sinceVersion;
    let hasMore = true;
    let batchCount = 0;
    const maxBatches = Math.ceil(
      this.config.maxPullRecordsPerTable / this.config.pullBatchSize
    );

    while (hasMore && batchCount < maxBatches) {
      const { data, error } = await this.supabase.rpc('get_changes_since', {
        p_user_id: userId,
        p_table_name: tableName,
        p_since_version: cursor,
        p_limit: this.config.pullBatchSize,
      });

      if (error) {
        throw new Error(
          `Failed to fetch changes for ${tableName}: ${error.message}`
        );
      }

      const result = data as unknown as ChangesResponse;
      const records = result.records || [];

      // No records = done
      if (records.length === 0) {
        hasMore = false;
        break;
      }

      // Track max version for cursor
      let batchMaxVersion = cursor;

      for (const record of records) {
        const serverRecord: ServerChangeRecord = {
          id: record.id as string,
          version: record.version as number,
          deletedAt: record.deleted_at as string | null,
          data: record,
        };

        // Track max version for next cursor
        if (serverRecord.version > batchMaxVersion) {
          batchMaxVersion = serverRecord.version;
        }

        if (serverRecord.deletedAt) {
          allTombstones.push(serverRecord);
        } else {
          allUpserts.push(serverRecord);
        }
      }

      batchCount++;

      // Check if we hit the batch limit (more records may exist)
      hasMore = records.length === this.config.pullBatchSize;

      // Move cursor to max version from this batch for next iteration
      cursor = batchMaxVersion;
    }

    const hitSafetyLimit = batchCount >= maxBatches && hasMore;

    // Warn if we hit the safety limit
    if (hitSafetyLimit) {
      console.warn(
        `[PullEngine] ${tableName}: Hit safety limit of ` +
          `${this.config.maxPullRecordsPerTable} records. Will continue next cycle.`
      );
    }

    return {
      tableName,
      upserts: allUpserts,
      tombstones: allTombstones,
      hitSafetyLimit,
    };
  }

  // ===========================================================================
  // APPLY CHANGES
  // ===========================================================================

  /**
   * Apply changes to local database
   *
   * Called within database.write() transaction for atomicity.
   */
  private async applyChanges(
    tableName: SyncableTableName,
    changes: TableChanges
  ): Promise<void> {
    // Apply upserts
    for (const record of changes.upserts) {
      await this.upsertRecord(tableName, record);
    }

    // Apply tombstones
    for (const record of changes.tombstones) {
      await this.applyTombstone(tableName, record);
    }
  }

  /**
   * Upsert a single record into local database
   */
  private async upsertRecord(
    tableName: SyncableTableName,
    record: ServerChangeRecord
  ): Promise<void> {
    const collection = this.database.get(tableName);

    try {
      // Try to find existing record
      const existing = await collection.find(record.id);

      // Update existing record
      // Using 'as any' for WatermelonDB model callback type compatibility
      await existing.update((r: any) => {
        this.mapServerDataToModel(tableName, record.data, r);
        r.version = record.version;
        r.localSyncStatus = SYNC_STATUS.SYNCED;
        r.deletedAt = null;
      });
    } catch {
      // Record doesn't exist, create it
      // Using 'as any' for WatermelonDB model callback type compatibility
      await collection.create((r: any) => {
        // Set the ID to match server
        r._raw.id = record.id;
        this.mapServerDataToModel(tableName, record.data, r);
        r.version = record.version;
        r.localSyncStatus = SYNC_STATUS.SYNCED;
        r.deletedAt = null;
      });
    }
  }

  /**
   * Apply tombstone (soft delete) to local record
   */
  private async applyTombstone(
    tableName: SyncableTableName,
    record: ServerChangeRecord
  ): Promise<void> {
    const collection = this.database.get(tableName);

    try {
      const existing = await collection.find(record.id);

      // Using 'as any' for WatermelonDB model callback type compatibility
      await existing.update((r: any) => {
        r.deletedAt = record.deletedAt
          ? new Date(record.deletedAt).getTime()
          : Date.now();
        r.version = record.version;
        r.localSyncStatus = SYNC_STATUS.SYNCED;
      });
    } catch {
      // Record doesn't exist locally - this is fine for tombstones
      // The record may have been created and deleted server-side
      // before we synced. No action needed.
    }
  }

  // ===========================================================================
  // DATA MAPPING
  // ===========================================================================

  /**
   * Map server data to WatermelonDB model fields
   *
   * CTO MANDATE: Strict ISO 8601 date parsing
   */
  private mapServerDataToModel(
    tableName: SyncableTableName,
    data: Record<string, unknown>,
    model: Record<string, unknown>
  ): void {
    switch (tableName) {
      case TABLE_NAMES.BANK_ACCOUNTS:
        model.groupId = data.group_id;
        model.userId = data.user_id;
        model.name = data.name;
        model.type = data.type;
        model.currencyCode = data.currency_code;
        model.color = data.color;
        model.isVisible = data.is_visible;
        model.currentBalanceCents = Number(data.current_balance_cents ?? 0);
        model.createdAt = this.parseDate(data.created_at);
        model.updatedAt = this.parseDate(data.updated_at);
        break;

      case TABLE_NAMES.TRANSACTIONS:
        model.userId = data.user_id;
        model.accountId = data.account_id;
        model.categoryId = data.category_id;
        model.amountCents = Number(data.amount_cents ?? 0);
        model.amountHomeCents = Number(data.amount_home_cents ?? 0);
        model.exchangeRate = Number(data.exchange_rate ?? 1);
        model.date = this.parseDate(data.date);
        model.description = data.description;
        model.notes = data.notes;
        model.sourceText = data.source_text;
        model.transferId = data.transfer_id;
        model.inboxId = data.inbox_id;
        model.cleared = data.cleared ?? false;
        model.reconciliationId = data.reconciliation_id;
        model.createdAt = this.parseDate(data.created_at);
        model.updatedAt = this.parseDate(data.updated_at);
        break;

      case TABLE_NAMES.CATEGORIES:
        model.userId = data.user_id;
        model.name = data.name;
        model.type = data.type;
        model.color = data.color;
        model.parentId = data.parent_id;
        model.createdAt = this.parseDate(data.created_at);
        model.updatedAt = this.parseDate(data.updated_at);
        break;

      case TABLE_NAMES.TRANSACTION_INBOX:
        model.userId = data.user_id;
        model.amountCents = data.amount_cents ? Number(data.amount_cents) : null;
        model.description = data.description;
        model.date = this.parseDate(data.date);
        model.sourceText = data.source_text;
        model.accountId = data.account_id;
        model.categoryId = data.category_id;
        model.exchangeRate = data.exchange_rate
          ? Number(data.exchange_rate)
          : null;
        model.notes = data.notes;
        model.status = data.status;
        model.createdAt = this.parseDate(data.created_at);
        model.updatedAt = this.parseDate(data.updated_at);
        break;
    }
  }

  /**
   * Parse ISO 8601 date string to timestamp
   *
   * CTO MANDATE: Strict ISO 8601 date parsing
   */
  private parseDate(value: unknown): number | null {
    if (!value) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const timestamp = new Date(value).getTime();
      return isNaN(timestamp) ? null : timestamp;
    }
    return null;
  }

  // ===========================================================================
  // UTILITIES
  // ===========================================================================

  /**
   * Get maximum version from changes
   */
  private getMaxVersion(changes: TableChanges): number {
    let max = 0;
    for (const record of [...changes.upserts, ...changes.tombstones]) {
      if (record.version > max) {
        max = record.version;
      }
    }
    return max;
  }
}

/**
 * Factory function to create PullEngine
 */
export function createPullEngine(
  database: Database,
  supabase: SupabaseClient<SupabaseDatabase>,
  metadataManager?: SyncMetadataManager,
  config?: Partial<SyncConfig>
): PullEngine {
  return new PullEngine(database, supabase, metadataManager, config);
}
