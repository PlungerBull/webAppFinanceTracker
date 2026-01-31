/**
 * Local Inbox Repository Implementation
 *
 * Implements IInboxRepository using WatermelonDB for offline-first storage.
 *
 * CTO MANDATES:
 * - Tombstone Pattern: ALL queries filter deleted_at using activeTombstoneFilter()
 * - ID Generation Ownership: Repository generates UUIDs via generateEntityId()
 * - Integer Cents: All amounts are integers
 * - Sync Status State Machine: All writes start as 'pending'
 *
 * @module local-inbox-repository
 */

import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import type { IInboxRepository } from './inbox-repository.interface';
import type {
  DataResult,
  PaginatedResult,
  PaginationOptions,
  CreateInboxItemDTO,
  UpdateInboxItemDTO,
  PromoteInboxItemDTO,
  PromoteResult,
} from '../domain/types';
import type { InboxItemViewEntity } from '../domain/entities';
import {
  InboxNotFoundError,
  InboxRepositoryError,
  InboxPromotionError,
  VersionConflictError,
} from '../domain/errors';
import {
  InboxModel,
  AccountModel,
  CategoryModel,
  CurrencyModel,
  activeTombstoneFilter,
  generateEntityId,
  getInitialSyncStatus,
  SYNC_STATUS,
  pendingSyncFilter,
  conflictFilter,
  TABLE_NAMES,
} from '@/lib/local-db';
import type { SyncStatus } from '@/lib/local-db';
import { checkAndBufferIfLocked, getSyncLockManager } from '@/lib/sync/sync-lock-manager';
import { localInboxItemViewsToDomain } from '@/lib/data/local-data-transformers';

/**
 * Local Inbox Repository
 *
 * Implements inbox data access using WatermelonDB.
 * All methods return DataResult<T> (never throw exceptions).
 *
 * CTO CRITICAL: This repository ONLY writes locally.
 * Sync engine (Phase 2d) handles pushing to Supabase.
 */
export class LocalInboxRepository implements IInboxRepository {
  constructor(private readonly database: Database) {}

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Enrich inbox items with joined account/category data
   *
   * CTO MANDATE: No N+1 Queries
   * Batch-fetches all related data in ONE query each,
   * then delegates to shared local-data-transformers.
   */
  private async enrichWithJoinedData(
    items: InboxModel[]
  ): Promise<InboxItemViewEntity[]> {
    if (items.length === 0) {
      return [];
    }

    // Collect unique IDs
    const accountIds = [
      ...new Set(items.map((i) => i.accountId).filter((id): id is string => id !== null)),
    ];
    const categoryIds = [
      ...new Set(items.map((i) => i.categoryId).filter((id): id is string => id !== null)),
    ];

    // Batch fetch accounts
    const accounts =
      accountIds.length > 0
        ? await this.database
            .get<AccountModel>('bank_accounts')
            .query(Q.where('id', Q.oneOf(accountIds)))
            .fetch()
        : [];

    // Batch fetch categories
    const categories =
      categoryIds.length > 0
        ? await this.database
            .get<CategoryModel>('categories')
            .query(Q.where('id', Q.oneOf(categoryIds)))
            .fetch()
        : [];

    // Batch fetch currencies
    const currencyCodes = [...new Set(accounts.map((a) => a.currencyCode))];
    const currencies =
      currencyCodes.length > 0
        ? await this.database
            .get<CurrencyModel>('global_currencies')
            .query(Q.where('code', Q.oneOf(currencyCodes)))
            .fetch()
        : [];

    // Create lookup maps
    const accountMap = new Map(accounts.map((a) => [a.id, a]));
    const categoryMap = new Map(categories.map((c) => [c.id, c]));
    const currencyMap = new Map(currencies.map((c) => [c.code, c]));

    // Delegate to shared transformer (CTO: Single Interface Rule)
    return localInboxItemViewsToDomain(items, accountMap, categoryMap, currencyMap);
  }

  // ============================================================================
  // QUERY OPERATIONS (Read)
  // ============================================================================

  async getPendingPaginated(
    userId: string,
    pagination?: PaginationOptions
  ): Promise<DataResult<PaginatedResult<InboxItemViewEntity>>> {
    try {
      const { offset = 0, limit = 50 } = pagination || {};

      const baseQuery = this.database
        .get<InboxModel>('transaction_inbox')
        .query(
          Q.where('user_id', userId),
          Q.where('status', 'pending'),
          ...activeTombstoneFilter(),
          Q.sortBy('created_at', Q.asc) // FIFO order
        );

      // Get total count
      const total = await baseQuery.fetchCount();

      // Get paginated results
      const items = await baseQuery
        .extend(Q.skip(offset), Q.take(limit))
        .fetch();

      // Enrich with joined data
      const enriched = await this.enrichWithJoinedData(items);

      return {
        success: true,
        data: {
          data: enriched,
          total,
          offset,
          limit,
          hasMore: total > offset + limit,
        },
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new InboxRepositoryError(`Failed to fetch inbox items: ${(err as Error).message}`),
      };
    }
  }

  async getById(userId: string, id: string): Promise<DataResult<InboxItemViewEntity>> {
    try {
      const item = await this.database
        .get<InboxModel>('transaction_inbox')
        .find(id);

      // Verify ownership
      if (item.userId !== userId) {
        return {
          success: false,
          data: null,
          error: new InboxNotFoundError(id),
        };
      }

      // Check tombstone
      if (item.deletedAt !== null) {
        return {
          success: false,
          data: null,
          error: new InboxNotFoundError(id),
        };
      }

      // Enrich with joined data
      const [enriched] = await this.enrichWithJoinedData([item]);

      return {
        success: true,
        data: enriched,
      };
    } catch (err) {
      if ((err as Error).message?.includes('not found')) {
        return {
          success: false,
          data: null,
          error: new InboxNotFoundError(id),
        };
      }
      return {
        success: false,
        data: null,
        error: new InboxRepositoryError(`Failed to fetch inbox item: ${(err as Error).message}`),
      };
    }
  }

  // ============================================================================
  // WRITE OPERATIONS
  // ============================================================================

  async create(
    userId: string,
    data: CreateInboxItemDTO
  ): Promise<DataResult<InboxItemViewEntity>> {
    try {
      const inboxCollection = this.database.get<InboxModel>('transaction_inbox');
      let createdItem: InboxModel | null = null;

      await this.database.write(async () => {
        createdItem = await inboxCollection.create((record) => {
          record._raw.id = generateEntityId();
          record.userId = userId;
          record.amountCents = data.amountCents !== undefined
            ? (data.amountCents !== null ? Math.round(data.amountCents) : null)
            : null;
          record.description = data.description ?? null;
          record.date = data.date ? new Date(data.date) : null;
          record.sourceText = data.sourceText ?? null;
          record.accountId = data.accountId ?? null;
          record.categoryId = data.categoryId ?? null;
          record.exchangeRate = null;
          record.notes = data.notes ?? null;
          record.status = 'pending';

          // CTO MANDATE: Sync fields
          record.version = 1;
          record.deletedAt = null;
          record.localSyncStatus = getInitialSyncStatus();
        });
      });

      if (!createdItem) {
        return {
          success: false,
          data: null,
          error: new InboxRepositoryError('Failed to create inbox item'),
        };
      }

      // Enrich with joined data
      const [enriched] = await this.enrichWithJoinedData([createdItem]);

      return {
        success: true,
        data: enriched,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new InboxRepositoryError(`Failed to create inbox item: ${(err as Error).message}`),
      };
    }
  }

  async update(
    userId: string,
    id: string,
    data: UpdateInboxItemDTO
  ): Promise<DataResult<InboxItemViewEntity>> {
    try {
      // Find existing item
      let item: InboxModel;
      try {
        item = await this.database
          .get<InboxModel>('transaction_inbox')
          .find(id);
      } catch {
        return {
          success: false,
          data: null,
          error: new InboxNotFoundError(id),
        };
      }

      // Verify ownership
      if (item.userId !== userId) {
        return {
          success: false,
          data: null,
          error: new InboxNotFoundError(id),
        };
      }

      // Check tombstone
      if (item.deletedAt !== null) {
        return {
          success: false,
          data: null,
          error: new InboxNotFoundError(id),
        };
      }

      // Check version if provided
      if (data.lastKnownVersion !== undefined && item.version !== data.lastKnownVersion) {
        return {
          success: false,
          data: null,
          error: new VersionConflictError(id, data.lastKnownVersion, item.version),
        };
      }

      // CTO MANDATE: Sync Lock Check - buffer if record is being synced
      const updateData = {
        amountCents: data.amountCents,
        description: data.description,
        date: data.date,
        accountId: data.accountId,
        categoryId: data.categoryId,
        exchangeRate: data.exchangeRate,
        notes: data.notes,
      };
      const lockResult = checkAndBufferIfLocked(
        id,
        TABLE_NAMES.TRANSACTION_INBOX,
        updateData
      );
      if (lockResult.isLocked) {
        // Return projected data for optimistic UI
        const [currentEnriched] = await this.enrichWithJoinedData([item]);
        const projected: InboxItemViewEntity = {
          ...currentEnriched,
          amountCents: data.amountCents !== undefined
            ? (data.amountCents !== null ? Math.round(data.amountCents) : null)
            : currentEnriched.amountCents,
          description: data.description !== undefined ? data.description : currentEnriched.description,
          date: data.date !== undefined ? data.date : currentEnriched.date,
          accountId: data.accountId !== undefined ? data.accountId : currentEnriched.accountId,
          categoryId: data.categoryId !== undefined ? data.categoryId : currentEnriched.categoryId,
          exchangeRate: data.exchangeRate !== undefined ? data.exchangeRate : currentEnriched.exchangeRate,
          notes: data.notes !== undefined ? data.notes : currentEnriched.notes,
          updatedAt: new Date().toISOString(),
        };
        return { success: true, data: projected, buffered: true };
      }

      // Update item
      await this.database.write(async () => {
        await item.update((record) => {
          if (data.amountCents !== undefined) {
            record.amountCents = data.amountCents !== null ? Math.round(data.amountCents) : null;
          }
          if (data.description !== undefined) {
            record.description = data.description;
          }
          if (data.date !== undefined) {
            record.date = data.date ? new Date(data.date) : null;
          }
          if (data.accountId !== undefined) {
            record.accountId = data.accountId;
          }
          if (data.categoryId !== undefined) {
            record.categoryId = data.categoryId;
          }
          if (data.exchangeRate !== undefined) {
            record.exchangeRate = data.exchangeRate;
          }
          if (data.notes !== undefined) {
            record.notes = data.notes;
          }

          // CTO MANDATE: Mark as pending for sync
          record.localSyncStatus = SYNC_STATUS.PENDING;
        });
      });

      // Fetch updated record
      const updated = await this.database
        .get<InboxModel>('transaction_inbox')
        .find(id);

      // Enrich with joined data
      const [enriched] = await this.enrichWithJoinedData([updated]);

      return {
        success: true,
        data: enriched,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new InboxRepositoryError(`Failed to update inbox item: ${(err as Error).message}`),
      };
    }
  }

  // ============================================================================
  // BATCH OPERATIONS
  // ============================================================================

  async createBatch(
    userId: string,
    items: CreateInboxItemDTO[]
  ): Promise<DataResult<InboxItemViewEntity[]>> {
    try {
      const inboxCollection = this.database.get<InboxModel>('transaction_inbox');
      const createdItems: InboxModel[] = [];

      await this.database.write(async () => {
        for (const data of items) {
          const item = await inboxCollection.create((record) => {
            record._raw.id = generateEntityId();
            record.userId = userId;
            record.amountCents = data.amountCents !== undefined
              ? (data.amountCents !== null ? Math.round(data.amountCents) : null)
              : null;
            record.description = data.description ?? null;
            record.date = data.date ? new Date(data.date) : null;
            record.sourceText = data.sourceText ?? null;
            record.accountId = data.accountId ?? null;
            record.categoryId = data.categoryId ?? null;
            record.exchangeRate = null;
            record.notes = data.notes ?? null;
            record.status = 'pending';

            // CTO MANDATE: Sync fields
            record.version = 1;
            record.deletedAt = null;
            record.localSyncStatus = getInitialSyncStatus();
          });
          createdItems.push(item);
        }
      });

      // Enrich with joined data
      const enriched = await this.enrichWithJoinedData(createdItems);

      return {
        success: true,
        data: enriched,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new InboxRepositoryError(`Failed to batch create inbox items: ${(err as Error).message}`),
      };
    }
  }

  async updateBatch(
    userId: string,
    updates: Array<{ id: string; data: UpdateInboxItemDTO }>
  ): Promise<DataResult<InboxItemViewEntity[]>> {
    try {
      // CTO MANDATE: Filter and Defer pattern for batch operations
      const lockManager = getSyncLockManager();
      const locked = updates.filter(({ id }) => lockManager.isLocked(id));
      const ready = updates.filter(({ id }) => !lockManager.isLocked(id));

      // Buffer locked items
      for (const { id, data } of locked) {
        lockManager.bufferUpdate(id, TABLE_NAMES.TRANSACTION_INBOX, data as Record<string, unknown>);
      }

      const updatedItems: InboxModel[] = [];

      // Update ready items
      await this.database.write(async () => {
        for (const { id, data } of ready) {
          try {
            const item = await this.database
              .get<InboxModel>('transaction_inbox')
              .find(id);

            if (item.userId !== userId || item.deletedAt !== null) {
              continue; // Skip items we can't update
            }

            await item.update((record) => {
              if (data.amountCents !== undefined) {
                record.amountCents = data.amountCents !== null ? Math.round(data.amountCents) : null;
              }
              if (data.description !== undefined) {
                record.description = data.description;
              }
              if (data.date !== undefined) {
                record.date = data.date ? new Date(data.date) : null;
              }
              if (data.accountId !== undefined) {
                record.accountId = data.accountId;
              }
              if (data.categoryId !== undefined) {
                record.categoryId = data.categoryId;
              }
              if (data.exchangeRate !== undefined) {
                record.exchangeRate = data.exchangeRate;
              }
              if (data.notes !== undefined) {
                record.notes = data.notes;
              }

              record.localSyncStatus = SYNC_STATUS.PENDING;
            });

            updatedItems.push(item);
          } catch {
            // Skip items that don't exist
          }
        }
      });

      // Enrich with joined data
      const enriched = await this.enrichWithJoinedData(updatedItems);

      return {
        success: true,
        data: enriched,
        bufferedCount: locked.length,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new InboxRepositoryError(`Failed to batch update inbox items: ${(err as Error).message}`),
      };
    }
  }

  // ============================================================================
  // PROMOTION OPERATIONS
  // ============================================================================

  async promote(
    _userId: string,
    _data: PromoteInboxItemDTO
  ): Promise<DataResult<PromoteResult>> {
    // CTO: Promotion requires atomic server operation
    // because it creates a transaction and updates inbox status
    return {
      success: false,
      data: null,
      error: new InboxPromotionError(
        'Inbox promotion must be performed via server sync. Local-only promotion not supported.'
      ),
    };
  }

  // ============================================================================
  // DISMISS OPERATIONS
  // ============================================================================

  async dismiss(userId: string, id: string): Promise<DataResult<void>> {
    try {
      // Find existing item
      let item: InboxModel;
      try {
        item = await this.database
          .get<InboxModel>('transaction_inbox')
          .find(id);
      } catch {
        return {
          success: false,
          data: null,
          error: new InboxNotFoundError(id),
        };
      }

      // Verify ownership
      if (item.userId !== userId) {
        return {
          success: false,
          data: null,
          error: new InboxNotFoundError(id),
        };
      }

      // Check tombstone
      if (item.deletedAt !== null) {
        return {
          success: false,
          data: null,
          error: new InboxNotFoundError(id),
        };
      }

      // CTO MANDATE: Sync Lock Check - buffer if record is being synced
      const dismissData = { status: 'ignored' };
      const lockResult = checkAndBufferIfLocked(
        id,
        TABLE_NAMES.TRANSACTION_INBOX,
        dismissData
      );
      if (lockResult.isLocked) {
        // Dismiss buffered - will be applied after sync completes
        return { success: true, data: undefined, buffered: true };
      }

      // Update status to ignored
      await this.database.write(async () => {
        await item.update((record) => {
          record.status = 'ignored';
          record.localSyncStatus = SYNC_STATUS.PENDING;
        });
      });

      return { success: true, data: undefined };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new InboxRepositoryError(`Failed to dismiss inbox item: ${(err as Error).message}`),
      };
    }
  }

  // ============================================================================
  // SYNC ENGINE METHODS (For Phase 2d)
  // ============================================================================

  /**
   * Get records pending sync
   */
  async getPendingRecords(userId: string): Promise<DataResult<InboxItemViewEntity[]>> {
    try {
      const pending = await this.database
        .get<InboxModel>('transaction_inbox')
        .query(
          Q.where('user_id', userId),
          ...pendingSyncFilter()
        )
        .fetch();

      const enriched = await this.enrichWithJoinedData(pending);

      return {
        success: true,
        data: enriched,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new InboxRepositoryError(`Failed to fetch pending records: ${(err as Error).message}`),
      };
    }
  }

  /**
   * Get records with conflicts
   */
  async getConflictRecords(userId: string): Promise<DataResult<InboxItemViewEntity[]>> {
    try {
      const conflicts = await this.database
        .get<InboxModel>('transaction_inbox')
        .query(
          Q.where('user_id', userId),
          ...conflictFilter()
        )
        .fetch();

      const enriched = await this.enrichWithJoinedData(conflicts);

      return {
        success: true,
        data: enriched,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new InboxRepositoryError(`Failed to fetch conflict records: ${(err as Error).message}`),
      };
    }
  }

  /**
   * Update sync status after push
   */
  async updateSyncStatus(
    id: string,
    status: SyncStatus,
    serverVersion?: number
  ): Promise<DataResult<void>> {
    try {
      const item = await this.database
        .get<InboxModel>('transaction_inbox')
        .find(id);

      await this.database.write(async () => {
        await item.update((record) => {
          record.localSyncStatus = status;
          if (serverVersion !== undefined) {
            record.version = serverVersion;
          }
        });
      });

      return { success: true, data: undefined };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new InboxRepositoryError(`Failed to update sync status: ${(err as Error).message}`),
      };
    }
  }
}
