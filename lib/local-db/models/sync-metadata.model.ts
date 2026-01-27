/**
 * WatermelonDB Sync Metadata Model
 *
 * Tracks sync state for each table.
 * Used to determine what data needs to be fetched from server.
 *
 * CTO MANDATE: This is a local-only table (not synced to server).
 * It tracks the last version fetched for each syncable table.
 *
 * @module local-db/models/sync-metadata
 */

import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';
import type { TableName } from '../schema';

/**
 * Sync Metadata Entity
 *
 * Domain type for sync tracking.
 */
export interface SyncMetadataEntity {
  /** Table name being tracked */
  tableName: TableName;
  /** Last successfully synced version (from global_transaction_version) */
  lastSyncedVersion: number;
  /** Timestamp of last successful sync */
  lastSyncedAt: string;
  /** Last sync error message (if any) */
  syncError: string | null;
}

/**
 * WatermelonDB Sync Metadata Model
 *
 * Maps to sync_metadata table.
 * One record per syncable table.
 */
export class SyncMetadataModel extends Model {
  static table = 'sync_metadata';

  // Core fields
  @field('table_name') tableName!: string;
  @field('last_synced_version') lastSyncedVersion!: number;
  @readonly @date('last_synced_at') lastSyncedAt!: Date;
  @field('sync_error') syncError!: string | null;

  /**
   * Convert to domain entity
   */
  toDomainEntity(): SyncMetadataEntity {
    return {
      tableName: this.tableName as TableName,
      lastSyncedVersion: this.lastSyncedVersion,
      lastSyncedAt: this.lastSyncedAt.toISOString(),
      syncError: this.syncError,
    };
  }
}
