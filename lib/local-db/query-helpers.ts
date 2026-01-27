/**
 * WatermelonDB Query Helpers
 *
 * Utility functions for building WatermelonDB queries with enforced patterns.
 *
 * CTO MANDATES:
 * - Tombstone Pattern: ALL queries MUST filter deleted_at
 * - ID Generation Ownership: Repository Layer generates UUIDs
 *
 * @module local-db/query-helpers
 */

import { Q } from '@nozbe/watermelondb';
import { SYNC_STATUS, type SyncStatus } from './schema';

// ============================================================================
// TOMBSTONE PATTERN
// ============================================================================

/**
 * Tombstone Filter
 *
 * CTO MANDATE: Every WatermelonDB query MUST include this filter.
 * We are switching from "Physical Deletion" to "Logical Deletion".
 *
 * Usage:
 * ```typescript
 * const accounts = await database
 *   .get<AccountModel>('bank_accounts')
 *   .query(
 *     ...activeTombstoneFilter(),
 *     Q.where('user_id', userId)
 *   )
 *   .fetch();
 * ```
 *
 * @returns Query clause that filters out soft-deleted records
 */
export function activeTombstoneFilter(): Q.Clause[] {
  return [Q.where('deleted_at', Q.eq(null))];
}

/**
 * Include Deleted Filter
 *
 * Use ONLY when you need to include soft-deleted records
 * (e.g., sync engine pushing tombstones to server).
 *
 * @returns Empty array (no filter applied)
 */
export function includeDeletedFilter(): Q.Clause[] {
  return [];
}

/**
 * Deleted Only Filter
 *
 * Use for cleanup operations or sync of tombstones.
 *
 * @returns Query clause that returns ONLY soft-deleted records
 */
export function deletedOnlyFilter(): Q.Clause[] {
  return [Q.where('deleted_at', Q.notEq(null))];
}

// ============================================================================
// SYNC STATUS FILTERS
// ============================================================================

/**
 * Pending Sync Filter
 *
 * Returns records that need to be pushed to server.
 *
 * @returns Query clause for pending records
 */
export function pendingSyncFilter(): Q.Clause[] {
  return [Q.where('local_sync_status', SYNC_STATUS.PENDING)];
}

/**
 * Conflict Filter
 *
 * Returns records that have sync conflicts needing resolution.
 *
 * @returns Query clause for conflicted records
 */
export function conflictFilter(): Q.Clause[] {
  return [Q.where('local_sync_status', SYNC_STATUS.CONFLICT)];
}

/**
 * Synced Filter
 *
 * Returns records that are in sync with server.
 *
 * @returns Query clause for synced records
 */
export function syncedFilter(): Q.Clause[] {
  return [Q.where('local_sync_status', SYNC_STATUS.SYNCED)];
}

// ============================================================================
// DELTA SYNC HELPERS
// ============================================================================

/**
 * Changes Since Version Filter
 *
 * CTO GUARDRAIL: Uses indexed `version` field for efficient Delta Sync.
 * Returns all records with version > sinceVersion.
 *
 * @param sinceVersion - The last synced version
 * @returns Query clause for records changed since version
 */
export function changesSinceVersionFilter(sinceVersion: number): Q.Clause[] {
  return [Q.where('version', Q.gt(sinceVersion))];
}

// ============================================================================
// ID GENERATION (Birth Certificate Rule)
// ============================================================================

/**
 * Generate Entity ID
 *
 * CTO MANDATE: ID Generation Ownership
 *
 * The "Birth Certificate" Rule:
 * - ID generation is STRICTLY owned by the Repository Layer
 * - Every LocalRepository.create() must check if ID exists in DTO
 * - If not, generate UUID BEFORE the first write to WatermelonDB
 * - This ensures the "Birth Certificate" is consistent from local to cloud
 *
 * Why Repository Layer?
 * - UI generating ID = Prop Drilling debt
 * - Database generating ID = Can't track "Pending" states easily
 * - Repository Layer = Single point of control, consistent IDs
 *
 * Usage in LocalRepository.create():
 * ```typescript
 * async create(dto: CreateAccountDTO): Promise<Account> {
 *   const id = dto.id ?? generateEntityId();
 *   // ... create with this ID
 * }
 * ```
 *
 * @returns A new UUID v4 string
 */
export function generateEntityId(): string {
  return crypto.randomUUID();
}

// ============================================================================
// SYNC STATUS TRANSITIONS
// ============================================================================

/**
 * Get Initial Sync Status
 *
 * CTO MANDATE: Local changes start as 'pending'.
 *
 * @returns The initial sync status for new local records
 */
export function getInitialSyncStatus(): SyncStatus {
  return SYNC_STATUS.PENDING;
}

/**
 * Determine Sync Status After Server Response
 *
 * CTO MANDATE: State Machine Transitions
 * - 200/201 → 'synced'
 * - 409 → 'conflict'
 * - Other errors → remains 'pending' (will retry)
 *
 * @param httpStatus - The HTTP status code from server
 * @returns The new sync status
 */
export function getSyncStatusFromResponse(httpStatus: number): SyncStatus {
  if (httpStatus === 200 || httpStatus === 201) {
    return SYNC_STATUS.SYNCED;
  }
  if (httpStatus === 409) {
    return SYNC_STATUS.CONFLICT;
  }
  // Network errors, 5xx, etc. - stay pending for retry
  return SYNC_STATUS.PENDING;
}
