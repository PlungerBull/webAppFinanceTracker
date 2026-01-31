/**
 * Sync Metadata Manager
 *
 * Manages the sync_metadata table for tracking sync state and tombstone pruning.
 *
 * CTO MANDATES:
 * - Atomic High-Water Mark: Only update after ALL tables succeed
 * - Tombstone Pruning: Physical delete after 30 days (synced + deleted)
 *
 * @module sync/sync-metadata-manager
 */

import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import {
  TABLE_NAMES,
  SYNC_STATUS,
  SyncMetadataModel,
  AccountModel,
  TransactionModel,
  CategoryModel,
  InboxModel,
} from '@/lib/local-db';
import { SYNCABLE_TABLES, DEFAULT_SYNC_CONFIG } from './constants';

/**
 * Result of tombstone pruning operation
 */
export interface PruneResult {
  /** Total records physically deleted */
  pruned: number;
  /** Per-table counts */
  byTable: Record<string, number>;
}

/**
 * Sync Metadata Manager
 *
 * Handles read/write operations for sync_metadata table
 * and tombstone maintenance.
 */
export class SyncMetadataManager {
  constructor(private readonly database: Database) {}

  // ===========================================================================
  // VERSION TRACKING
  // ===========================================================================

  /**
   * Get last synced version for user
   *
   * Returns the MINIMUM lastSyncedVersion across all tables.
   * This is conservative - ensures no changes are missed.
   *
   * @param _userId - User ID (for future multi-user support)
   * @returns The lowest lastSyncedVersion across all sync_metadata records
   */
  async getLastSyncedVersion(_userId: string): Promise<number> {
    const records = await this.database
      .get<SyncMetadataModel>(TABLE_NAMES.SYNC_METADATA)
      .query()
      .fetch();

    if (records.length === 0) {
      return 0;
    }

    // Return minimum version to ensure no changes are missed
    return Math.min(...records.map((r) => r.lastSyncedVersion));
  }

  /**
   * Get last synced version for a specific table
   *
   * @param userId - User ID
   * @param tableName - Table to get version for
   * @returns Last synced version for this table, or 0 if not found
   */
  async getTableLastSyncedVersion(
    userId: string,
    tableName: string
  ): Promise<number> {
    try {
      const record = await this.database
        .get<SyncMetadataModel>(TABLE_NAMES.SYNC_METADATA)
        .find(`${userId}_${tableName}`);
      return record.lastSyncedVersion;
    } catch {
      return 0;
    }
  }

  /**
   * Update last synced version
   *
   * CTO MANDATE: Atomic High-Water Mark
   * This should ONLY be called after ALL tables have successfully synced.
   *
   * Updates all sync_metadata records to the new version.
   *
   * @param userId - User ID
   * @param version - New high-water mark version
   */
  async updateLastSyncedVersion(userId: string, version: number): Promise<void> {
    await this.database.write(async () => {
      await this.updateLastSyncedVersionInTransaction(userId, version);
    });
  }

  /**
   * Update last synced version within an existing transaction
   *
   * Use this when you need to update the version as part of a larger
   * atomic operation (e.g., applying pull changes + updating version).
   *
   * CTO MANDATE: Atomic High-Water Mark - must be in same transaction
   * as pull data application.
   *
   * @param userId - User ID
   * @param version - New high-water mark version
   */
  async updateLastSyncedVersionInTransaction(
    userId: string,
    version: number
  ): Promise<void> {
    const collection = this.database.get<SyncMetadataModel>(
      TABLE_NAMES.SYNC_METADATA
    );

    // Update or create sync_metadata for each syncable table
    for (const tableName of SYNCABLE_TABLES) {
      const id = `${userId}_${tableName}`;

      try {
        const record = await collection.find(id);
        await record.update((r) => {
          r.lastSyncedVersion = version;
          r.syncError = null;
        });
      } catch {
        // Record doesn't exist - create it
        await collection.create((r) => {
          r._raw.id = id;
          r.tableName = tableName;
          r.lastSyncedVersion = version;
          r.syncError = null;
        });
      }
    }
  }

  // ===========================================================================
  // ERROR TRACKING
  // ===========================================================================

  /**
   * Set sync error for debugging
   *
   * @param userId - User ID
   * @param tableName - Table that had the error
   * @param error - Error message
   */
  async setSyncError(
    userId: string,
    tableName: string,
    error: string
  ): Promise<void> {
    const id = `${userId}_${tableName}`;

    await this.database.write(async () => {
      const collection = this.database.get<SyncMetadataModel>(
        TABLE_NAMES.SYNC_METADATA
      );

      try {
        const record = await collection.find(id);
        await record.update((r) => {
          r.syncError = error;
        });
      } catch {
        // Record doesn't exist - create it with error
        await collection.create((r) => {
          r._raw.id = id;
          r.tableName = tableName;
          r.lastSyncedVersion = 0;
          r.syncError = error;
        });
      }
    });
  }

  /**
   * Clear sync errors for all tables
   */
  async clearSyncErrors(): Promise<void> {
    await this.database.write(async () => {
      const records = await this.database
        .get<SyncMetadataModel>(TABLE_NAMES.SYNC_METADATA)
        .query()
        .fetch();

      for (const record of records) {
        if (record.syncError) {
          await record.update((r) => {
            r.syncError = null;
          });
        }
      }
    });
  }

  /**
   * Get all sync errors
   *
   * @returns Map of tableName → error message
   */
  async getSyncErrors(): Promise<Record<string, string>> {
    const records = await this.database
      .get<SyncMetadataModel>(TABLE_NAMES.SYNC_METADATA)
      .query(Q.where('sync_error', Q.notEq(null)))
      .fetch();

    const errors: Record<string, string> = {};
    for (const record of records) {
      if (record.syncError) {
        errors[record.tableName] = record.syncError;
      }
    }
    return errors;
  }

  // ===========================================================================
  // TOMBSTONE PRUNING
  // ===========================================================================

  /**
   * Prune old tombstones
   *
   * CTO MANDATE: Tombstone Pruning
   *
   * Physically deletes records that are:
   * 1. Soft-deleted (deleted_at IS NOT NULL)
   * 2. Already synced (local_sync_status = 'synced')
   * 3. Older than the specified days
   *
   * This prevents IndexedDB from growing forever.
   *
   * @param olderThanDays - Delete tombstones older than this many days (default: 30)
   * @returns Result with counts of pruned records
   */
  async pruneTombstones(
    olderThanDays: number = DEFAULT_SYNC_CONFIG.tombstonePruneDays
  ): Promise<PruneResult> {
    const cutoffMs = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    const byTable: Record<string, number> = {};
    let totalPruned = 0;

    await this.database.write(async () => {
      // Prune accounts
      const accountsToPrune = await this.database
        .get<AccountModel>(TABLE_NAMES.BANK_ACCOUNTS)
        .query(
          Q.where('deleted_at', Q.lt(cutoffMs)),
          Q.where('local_sync_status', SYNC_STATUS.SYNCED)
        )
        .fetch();

      for (const record of accountsToPrune) {
        await record.destroyPermanently();
      }
      byTable[TABLE_NAMES.BANK_ACCOUNTS] = accountsToPrune.length;
      totalPruned += accountsToPrune.length;

      // Prune transactions
      const transactionsToPrune = await this.database
        .get<TransactionModel>(TABLE_NAMES.TRANSACTIONS)
        .query(
          Q.where('deleted_at', Q.lt(cutoffMs)),
          Q.where('local_sync_status', SYNC_STATUS.SYNCED)
        )
        .fetch();

      for (const record of transactionsToPrune) {
        await record.destroyPermanently();
      }
      byTable[TABLE_NAMES.TRANSACTIONS] = transactionsToPrune.length;
      totalPruned += transactionsToPrune.length;

      // Prune categories
      const categoriesToPrune = await this.database
        .get<CategoryModel>(TABLE_NAMES.CATEGORIES)
        .query(
          Q.where('deleted_at', Q.lt(cutoffMs)),
          Q.where('local_sync_status', SYNC_STATUS.SYNCED)
        )
        .fetch();

      for (const record of categoriesToPrune) {
        await record.destroyPermanently();
      }
      byTable[TABLE_NAMES.CATEGORIES] = categoriesToPrune.length;
      totalPruned += categoriesToPrune.length;

      // Prune inbox
      const inboxToPrune = await this.database
        .get<InboxModel>(TABLE_NAMES.TRANSACTION_INBOX)
        .query(
          Q.where('deleted_at', Q.lt(cutoffMs)),
          Q.where('local_sync_status', SYNC_STATUS.SYNCED)
        )
        .fetch();

      for (const record of inboxToPrune) {
        await record.destroyPermanently();
      }
      byTable[TABLE_NAMES.TRANSACTION_INBOX] = inboxToPrune.length;
      totalPruned += inboxToPrune.length;
    });

    return {
      pruned: totalPruned,
      byTable,
    };
  }

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  /**
   * Initialize sync metadata for a user
   *
   * Creates sync_metadata records for all syncable tables if they don't exist.
   * Used after initial hydration to set the starting point for delta sync.
   *
   * @param userId - User ID
   * @param initialVersion - Starting version (usually from get_max_version_for_user)
   */
  async initializeForUser(userId: string, initialVersion: number): Promise<void> {
    await this.database.write(async () => {
      const collection = this.database.get<SyncMetadataModel>(
        TABLE_NAMES.SYNC_METADATA
      );

      for (const tableName of SYNCABLE_TABLES) {
        const id = `${userId}_${tableName}`;

        try {
          // Check if already exists
          await collection.find(id);
          // Record exists, don't overwrite
        } catch {
          // Doesn't exist - create it
          await collection.create((r) => {
            r._raw.id = id;
            r.tableName = tableName;
            r.lastSyncedVersion = initialVersion;
            r.syncError = null;
          });
        }
      }
    });
  }

  /**
   * Get all sync metadata records
   *
   * Useful for debugging and status display.
   *
   * @returns All sync_metadata records
   */
  async getAllMetadata(): Promise<
    Array<{
      id: string;
      tableName: string;
      lastSyncedVersion: number;
      syncError: string | null;
    }>
  > {
    const records = await this.database
      .get<SyncMetadataModel>(TABLE_NAMES.SYNC_METADATA)
      .query()
      .fetch();

    return records.map((r) => ({
      id: r.id,
      tableName: r.tableName,
      lastSyncedVersion: r.lastSyncedVersion,
      syncError: r.syncError,
    }));
  }
}

/**
 * Factory function to create SyncMetadataManager
 *
 * @param database - WatermelonDB database instance
 * @returns New SyncMetadataManager instance
 */
export function createSyncMetadataManager(
  database: Database
): SyncMetadataManager {
  return new SyncMetadataManager(database);
}
