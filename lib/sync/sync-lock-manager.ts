/**
 * Sync Lock Manager
 *
 * Prevents race conditions during sync by locking records being pushed.
 *
 * CTO MANDATE: Mutation Locking During Sync
 *
 * Problem: User edits a record while it's being pushed → overwriting race condition.
 * Solution: Lock records during push, buffer any updates, apply after sync completes.
 *
 * Flow:
 * 1. PushEngine calls lockRecords() before sending batch
 * 2. LocalRepository.update() checks isLocked() - if true, buffers update
 * 3. PushEngine calls unlockRecords() after batch completes
 * 4. PushEngine calls flushBuffer() to get buffered updates
 * 5. Buffered records are re-marked as 'pending' for next sync cycle
 *
 * @module sync/sync-lock-manager
 */

import type { BufferedUpdate } from './types';
import type { TableName } from '@/lib/local-db/schema';

/**
 * Sync Lock Manager
 *
 * Thread-safe (single-threaded JS) manager for sync mutation locking.
 */
export class SyncLockManager {
  /**
   * Set of record IDs currently being synced
   */
  private syncingIds = new Set<string>();

  /**
   * Map of buffered updates keyed by record ID
   * If a record is edited while being synced, the update is buffered here.
   */
  private updateBuffer = new Map<string, BufferedUpdate>();

  /**
   * Lock records before pushing
   *
   * Called by PushEngine before sending a batch to the server.
   * While locked, any updates to these records will be buffered.
   *
   * @param ids - Record IDs to lock
   */
  lockRecords(ids: string[]): void {
    for (const id of ids) {
      this.syncingIds.add(id);
    }
  }

  /**
   * Unlock records after push completes
   *
   * Called by PushEngine after a batch succeeds or fails.
   * Does NOT automatically apply buffered updates - call flushBuffer() for that.
   *
   * @param ids - Record IDs to unlock
   */
  unlockRecords(ids: string[]): void {
    for (const id of ids) {
      this.syncingIds.delete(id);
    }
  }

  /**
   * Check if a record is currently being synced
   *
   * Used by LocalRepository.update() to determine if update should be buffered.
   *
   * @param id - Record ID to check
   * @returns true if record is locked (being synced)
   */
  isLocked(id: string): boolean {
    return this.syncingIds.has(id);
  }

  /**
   * Get count of currently locked records
   *
   * Useful for debugging and status display.
   *
   * @returns Number of locked records
   */
  getLockedCount(): number {
    return this.syncingIds.size;
  }

  /**
   * Buffer an update for a locked record
   *
   * Called by LocalRepository when user edits a record that's being synced.
   * The update is queued and will be applied after sync completes.
   *
   * If multiple updates occur for the same record, only the latest is kept.
   *
   * @param id - Record ID
   * @param tableName - Table the record belongs to
   * @param updateData - The update data to apply later
   */
  bufferUpdate(
    id: string,
    tableName: TableName,
    updateData: Record<string, unknown>
  ): void {
    // Always overwrite with latest update (last-write-wins for buffered updates)
    this.updateBuffer.set(id, {
      id,
      tableName,
      updateData,
      timestamp: Date.now(),
    });
  }

  /**
   * Get and clear all buffered updates
   *
   * Called by PushEngine after unlocking records.
   * Returns all buffered updates and clears the buffer.
   *
   * The caller should re-mark these records as 'pending' so they're
   * included in the next sync cycle.
   *
   * @returns Array of buffered updates (empty if none)
   */
  flushBuffer(): BufferedUpdate[] {
    const updates = Array.from(this.updateBuffer.values());
    this.updateBuffer.clear();
    return updates;
  }

  /**
   * Check if there are buffered updates
   *
   * @returns true if there are updates waiting to be applied
   */
  hasBufferedUpdates(): boolean {
    return this.updateBuffer.size > 0;
  }

  /**
   * Get count of buffered updates
   *
   * @returns Number of buffered updates
   */
  getBufferedCount(): number {
    return this.updateBuffer.size;
  }

  /**
   * Check if a specific record has a buffered update
   *
   * @param id - Record ID to check
   * @returns true if record has a buffered update
   */
  hasBufferedUpdate(id: string): boolean {
    return this.updateBuffer.has(id);
  }

  /**
   * Clear all locks (emergency reset)
   *
   * Should only be used in error recovery scenarios.
   * Does NOT clear the update buffer.
   */
  clearAllLocks(): void {
    this.syncingIds.clear();
  }

  /**
   * Clear everything (full reset)
   *
   * Clears both locks and buffered updates.
   * Use with caution - buffered updates will be lost.
   */
  reset(): void {
    this.syncingIds.clear();
    this.updateBuffer.clear();
  }
}

/**
 * Singleton instance for the sync lock manager
 *
 * This ensures all parts of the app use the same lock state.
 */
let singletonInstance: SyncLockManager | null = null;

/**
 * Get the singleton SyncLockManager instance
 *
 * Creates the instance on first call.
 *
 * @returns The singleton SyncLockManager
 */
export function getSyncLockManager(): SyncLockManager {
  if (!singletonInstance) {
    singletonInstance = new SyncLockManager();
  }
  return singletonInstance;
}

/**
 * Reset the singleton (for testing)
 *
 * Clears and recreates the singleton instance.
 */
export function resetSyncLockManager(): void {
  if (singletonInstance) {
    singletonInstance.reset();
  }
  singletonInstance = null;
}

/**
 * Check if record is locked and buffer update if so
 *
 * CTO MANDATE: Standardized lock check for all LocalRepository mutation methods.
 *
 * Usage in repositories:
 * ```typescript
 * const lockResult = checkAndBufferIfLocked(id, 'transactions', updateData);
 * if (lockResult.isLocked) {
 *   const projected = { ...existingRecord, ...updateData };
 *   return { success: true, data: projected, buffered: true };
 * }
 * // Proceed with database.write()
 * ```
 *
 * @param id - Record ID to check
 * @param tableName - Table the record belongs to
 * @param updateData - The update data to buffer if locked
 * @returns Object indicating whether record was locked (and buffered)
 */
export function checkAndBufferIfLocked(
  id: string,
  tableName: TableName,
  updateData: Record<string, unknown>
): { isLocked: true } | { isLocked: false } {
  const lockManager = getSyncLockManager();
  if (lockManager.isLocked(id)) {
    lockManager.bufferUpdate(id, tableName, updateData);
    return { isLocked: true };
  }
  return { isLocked: false };
}
