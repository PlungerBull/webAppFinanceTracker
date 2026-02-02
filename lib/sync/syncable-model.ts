/**
 * Syncable Model Interface
 *
 * Provides type-safe abstractions for WatermelonDB models that support sync.
 * Eliminates the need for `as any` type assertions in sync engine code.
 *
 * CTO MANDATE: Type safety is non-negotiable. The compiler must catch errors.
 *
 * @module sync/syncable-model
 */

import type { SyncStatus } from '@/lib/local-db/schema';

/**
 * Interface for any WatermelonDB model that supports sync.
 *
 * All syncable models MUST implement these fields:
 * - AccountModel
 * - TransactionModel
 * - CategoryModel
 * - InboxModel
 *
 * This interface enables type-safe sync operations without `as any`.
 */
export interface SyncableModel {
  /** Optimistic concurrency version - incremented on each server sync */
  version: number;

  /** Soft delete timestamp (null = active, number = deleted Unix timestamp) */
  deletedAt: number | null;

  /** Current sync state machine position */
  localSyncStatus: SyncStatus;
}

/**
 * Type for WatermelonDB record.update() callbacks.
 *
 * Use this instead of `any` for type-safe model mutations.
 * Combines SyncableModel fields with dynamic field access for
 * table-specific properties.
 *
 * @example
 * ```typescript
 * await record.update((r) => {
 *   (r as SyncableModelMutation).localSyncStatus = SYNC_STATUS.CONFLICT;
 * });
 * ```
 */
export type SyncableModelMutation = SyncableModel & Record<string, unknown>;

/**
 * Type guard to check if an object implements SyncableModel.
 *
 * Useful for runtime validation when working with unknown model types.
 */
export function isSyncableModel(obj: unknown): obj is SyncableModel {
  if (typeof obj !== 'object' || obj === null) return false;

  const model = obj as Record<string, unknown>;
  return (
    typeof model.version === 'number' &&
    (model.deletedAt === null || typeof model.deletedAt === 'number') &&
    typeof model.localSyncStatus === 'string'
  );
}
