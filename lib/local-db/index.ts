/**
 * Local Database Module
 *
 * WatermelonDB integration for offline-first data persistence.
 *
 * CTO MANDATES:
 * - SSR Isolation: All exports handle server-side gracefully
 * - ID Mirror Strategy: UUIDs are identical between local and server
 * - Integer Cents: All monetary amounts are integers
 * - Tombstone Pattern: All queries filter deleted_at
 * - ID Generation Ownership: Repository Layer generates UUIDs
 *
 * @module local-db
 */

// Database singleton
export {
  getLocalDatabase,
  resetLocalDatabase,
  getLocalDatabaseError,
  isLocalDatabaseReady,
} from './database';

// Schema
export { schema, SCHEMA_VERSION, TABLE_NAMES, SYNC_STATUS } from './schema';
export type { SyncStatus, TableName } from './schema';

// Migrations
export { migrations } from './migrations';

// Models
export {
  AccountModel,
  TransactionModel,
  CategoryModel,
  InboxModel,
  CurrencyModel,
  SyncMetadataModel,
  modelClasses,
} from './models';
export type {
  AccountType,
  CategoryType,
  InboxStatus,
  SyncMetadataEntity,
} from './models';

// Query Helpers (CTO Guardrails)
export {
  // Tombstone Pattern
  activeTombstoneFilter,
  includeDeletedFilter,
  deletedOnlyFilter,
  // Sync Status Filters
  pendingSyncFilter,
  conflictFilter,
  syncedFilter,
  // Delta Sync
  changesSinceVersionFilter,
  // ID Generation (Birth Certificate Rule)
  generateEntityId,
  // Sync Status State Machine
  getInitialSyncStatus,
  getSyncStatusFromResponse,
} from './query-helpers';

// React Hooks
export { useLocalDatabase, useLocalDatabaseInstance } from './hooks';
