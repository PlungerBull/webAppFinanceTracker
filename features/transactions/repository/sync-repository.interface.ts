/**
 * Transaction Sync Repository Interface
 *
 * DOMAIN ISOLATION: Separated from ITransactionRepository to maintain clean
 * interface boundaries. Sync operations are Phase 2 (offline-first) features
 * that iOS can skip in initial implementation.
 *
 * Ghost Prop Audit (2026-02-01): Moved from ITransactionRepository to reduce
 * interface surface area and improve Swift protocol mapping clarity.
 *
 * Swift Note: iOS WatermelonDB sync may use its own sync engine. These methods
 * are primarily for web delta sync and admin operations.
 *
 * @module sync-repository-interface
 */

import type { DataResult, SyncResponse, TransactionChanges } from '../domain/types';

/**
 * Sync Repository Interface
 *
 * Phase 2 (Offline-First) operations for delta sync and admin functions.
 * Separated from main ITransactionRepository to:
 * 1. Keep user-facing interface minimal
 * 2. Allow iOS to skip sync methods in initial port
 * 3. Enable independent versioning of sync protocol
 *
 * Swift Mirror:
 * ```swift
 * protocol TransactionSyncRepositoryProtocol {
 *     // iOS typically uses WatermelonDB sync instead
 *     // These methods are web-specific
 * }
 * ```
 */
export interface ISyncRepository {
  /**
   * Get all changes since a specific version (Delta Sync)
   *
   * @beta Phase 2 - Offline-First Architecture
   *
   * Returns transactions created, updated, or deleted since the given version.
   * Used for incremental sync - client sends lastSyncVersion, gets only changes.
   *
   * CTO Mandate #2: Version-Based Sync
   * - Uses global monotonic version counter
   * - Clock-independent (no timestamp drift issues)
   * - Supports offline clients reconnecting after days/weeks
   *
   * @param userId - User ID (UUID)
   * @param sinceVersion - Version number (get changes after this version)
   * @returns DataResult with sync response (all changes + currentServerVersion)
   *
   * @example
   * ```typescript
   * const result = await syncRepo.getChangesSince(userId, lastSyncVersion);
   * if (result.success) {
   *   const { created, updated, deleted } = result.data.data;
   *   // Apply to local cache
   *   created.forEach(txn => localCache.insert(txn));
   *   updated.forEach(txn => localCache.update(txn));
   *   deleted.forEach(txn => localCache.remove(txn.id));
   * }
   * ```
   */
  getChangesSince(
    userId: string,
    sinceVersion: number
  ): Promise<DataResult<SyncResponse<TransactionChanges>>>;

  /**
   * Permanently delete transaction (physical DELETE)
   *
   * @internal ADMIN ONLY
   *
   * Removes record from database permanently.
   * Normal delete operations should use soft delete (ITransactionRepository.delete).
   *
   * Use cases:
   * - GDPR data deletion requests
   * - Admin cleanup of test data
   * - Purging old tombstones after retention period
   *
   * @param userId - User ID (UUID)
   * @param id - Transaction ID (UUID)
   * @returns DataResult with void or error
   */
  permanentlyDelete(userId: string, id: string): Promise<DataResult<void>>;
}
