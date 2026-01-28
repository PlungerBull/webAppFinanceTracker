/**
 * Local Transaction Repository Implementation
 *
 * Implements ITransactionRepository using WatermelonDB for offline-first storage.
 *
 * CTO MANDATES:
 * - Tombstone Pattern: ALL queries filter deleted_at using activeTombstoneFilter()
 * - ID Generation Ownership: Repository generates UUIDs via generateEntityId()
 * - Integer Cents: All amounts are integers (Math.round in toDomainEntity)
 * - Sync Status State Machine: All writes start as 'pending'
 * - No N+1 Queries: enrichWithJoinedData uses batch queries
 *
 * @module local-transaction-repository
 */

import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import type { ITransactionRepository } from './transaction-repository.interface';
import type {
  DataResult,
  CreateTransactionDTO,
  UpdateTransactionDTO,
  BulkUpdateTransactionDTO,
  BulkUpdateResult,
  TransactionFilters,
  PaginationOptions,
  PaginatedResult,
  SyncResponse,
  TransactionChanges,
  CategoryCounts,
} from '../domain/types';
import type { TransactionViewEntity } from '../domain/entities';
import {
  TransactionError,
  TransactionNotFoundError,
  TransactionVersionConflictError,
  TransactionRepositoryError,
  TransactionValidationError,
} from '../domain/errors';
import { validateISODate } from '@/lib/utils/date-validation';
import { TRANSACTION_VALIDATION, TRANSACTION_ERRORS } from '../domain/constants';
import {
  TransactionModel,
  AccountModel,
  CategoryModel,
  activeTombstoneFilter,
  generateEntityId,
  getInitialSyncStatus,
  SYNC_STATUS,
  pendingSyncFilter,
  conflictFilter,
  TABLE_NAMES,
} from '@/lib/local-db';
import type { SyncStatus } from '@/lib/local-db';
import { checkAndBufferIfLocked } from '@/lib/sync/sync-lock-manager';
import { localTransactionViewsToDomain } from '@/lib/data/local-data-transformers';

/**
 * Local Transaction Repository
 *
 * Implements transaction data access using WatermelonDB.
 * All methods return DataResult<T> (never throw exceptions).
 *
 * CTO CRITICAL: This repository ONLY writes locally.
 * Sync engine (Phase 2d) handles pushing to Supabase.
 */
export class LocalTransactionRepository implements ITransactionRepository {
  constructor(private readonly database: Database) {}

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Enrich transactions with joined account/category data
   *
   * CTO MANDATE: No N+1 Queries
   * Batch-fetches all accounts and categories in ONE query each,
   * then delegates to shared local-data-transformers.
   *
   * @param transactions - Array of TransactionModel instances
   * @returns Array of TransactionViewEntity with joined data
   */
  private async enrichWithJoinedData(
    transactions: TransactionModel[]
  ): Promise<TransactionViewEntity[]> {
    if (transactions.length === 0) {
      return [];
    }

    // Collect unique account and category IDs
    const accountIds = [...new Set(transactions.map((t) => t.accountId))];
    const categoryIds = [
      ...new Set(
        transactions.map((t) => t.categoryId).filter((id): id is string => id !== null)
      ),
    ];

    // Batch fetch accounts (CTO: No N+1)
    const accounts = await this.database
      .get<AccountModel>('bank_accounts')
      .query(Q.where('id', Q.oneOf(accountIds)))
      .fetch();

    // Batch fetch categories (CTO: No N+1)
    const categories =
      categoryIds.length > 0
        ? await this.database
            .get<CategoryModel>('categories')
            .query(Q.where('id', Q.oneOf(categoryIds)))
            .fetch()
        : [];

    // Create lookup maps for O(1) access
    const accountMap = new Map(accounts.map((a) => [a.id, a]));
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    // Delegate to shared transformer (CTO: Single Interface Rule)
    return localTransactionViewsToDomain(transactions, accountMap, categoryMap);
  }

  /**
   * Apply filters to WatermelonDB query
   */
  private buildFilterClauses(filters?: TransactionFilters): Q.Clause[] {
    const clauses: Q.Clause[] = [];

    if (filters?.accountId) {
      clauses.push(Q.where('account_id', filters.accountId));
    }

    if (filters?.categoryId) {
      clauses.push(Q.where('category_id', filters.categoryId));
    }

    if (filters?.startDate) {
      clauses.push(Q.where('date', Q.gte(new Date(filters.startDate).getTime())));
    }

    if (filters?.endDate) {
      clauses.push(Q.where('date', Q.lte(new Date(filters.endDate).getTime())));
    }

    if (filters?.minAmountCents !== undefined) {
      clauses.push(Q.where('amount_cents', Q.gte(filters.minAmountCents)));
    }

    if (filters?.maxAmountCents !== undefined) {
      clauses.push(Q.where('amount_cents', Q.lte(filters.maxAmountCents)));
    }

    if (filters?.searchQuery) {
      clauses.push(
        Q.or(
          Q.where('description', Q.like(`%${filters.searchQuery}%`)),
          Q.where('notes', Q.like(`%${filters.searchQuery}%`))
        )
      );
    }

    if (filters?.cleared !== undefined) {
      clauses.push(Q.where('cleared', filters.cleared));
    }

    if (filters?.transferId) {
      clauses.push(Q.where('transfer_id', filters.transferId));
    }

    if (filters?.reconciliationId) {
      clauses.push(Q.where('reconciliation_id', filters.reconciliationId));
    }

    return clauses;
  }

  /**
   * Verify account exists (Cross-table integrity)
   *
   * CTO GUARDRAIL: Verify accountId exists before write
   */
  private async verifyAccountExists(accountId: string): Promise<boolean> {
    try {
      const account = await this.database
        .get<AccountModel>('bank_accounts')
        .find(accountId);
      return account.deletedAt === null;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // QUERY OPERATIONS (Read)
  // ============================================================================

  async getAllPaginated(
    userId: string,
    filters?: TransactionFilters,
    pagination?: PaginationOptions
  ): Promise<DataResult<PaginatedResult<TransactionViewEntity>>> {
    try {
      const { offset = 0, limit = 50 } = pagination || {};

      // Build query with tombstone filter (CTO MANDATE)
      const filterClauses = this.buildFilterClauses(filters);
      const includeDeleted = filters?.includeDeleted ?? false;

      const baseQuery = this.database
        .get<TransactionModel>('transactions')
        .query(
          Q.where('user_id', userId),
          ...(includeDeleted ? [] : activeTombstoneFilter()),
          ...filterClauses,
          Q.sortBy('date', Q.desc),
          Q.sortBy('created_at', Q.desc)
        );

      // Get total count
      const total = await baseQuery.fetchCount();

      // Get paginated results
      const transactions = await baseQuery
        .extend(Q.skip(offset), Q.take(limit))
        .fetch();

      // Enrich with joined data (CTO: Batch query, no N+1)
      const enriched = await this.enrichWithJoinedData(transactions);

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
        error: new TransactionRepositoryError(`Failed to fetch transactions: ${(err as Error).message}`),
      };
    }
  }

  async getById(userId: string, id: string): Promise<DataResult<TransactionViewEntity>> {
    try {
      const transaction = await this.database
        .get<TransactionModel>('transactions')
        .find(id);

      // Verify ownership and not deleted
      if (transaction.userId !== userId) {
        return {
          success: false,
          data: null,
          error: new TransactionNotFoundError(id),
        };
      }

      if (transaction.deletedAt !== null) {
        return {
          success: false,
          data: null,
          error: new TransactionNotFoundError(id),
        };
      }

      // Enrich with joined data
      const [enriched] = await this.enrichWithJoinedData([transaction]);

      return {
        success: true,
        data: enriched,
      };
    } catch (err) {
      // WatermelonDB throws when record not found
      if ((err as Error).message?.includes('not found')) {
        return {
          success: false,
          data: null,
          error: new TransactionNotFoundError(id),
        };
      }
      return {
        success: false,
        data: null,
        error: new TransactionRepositoryError(`Failed to fetch transaction: ${(err as Error).message}`),
      };
    }
  }

  async getCategoryCounts(
    userId: string,
    filters?: TransactionFilters
  ): Promise<DataResult<CategoryCounts>> {
    try {
      const filterClauses = this.buildFilterClauses({
        ...filters,
        categoryId: undefined, // Don't filter by category for aggregation
      });

      const transactions = await this.database
        .get<TransactionModel>('transactions')
        .query(
          Q.where('user_id', userId),
          ...activeTombstoneFilter(),
          ...filterClauses
        )
        .fetch();

      // Aggregate counts
      const counts: CategoryCounts = {};
      transactions.forEach((t) => {
        const categoryId = t.categoryId || 'uncategorized';
        counts[categoryId] = (counts[categoryId] || 0) + 1;
      });

      return {
        success: true,
        data: counts,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new TransactionRepositoryError(`Failed to fetch category counts: ${(err as Error).message}`),
      };
    }
  }

  // ============================================================================
  // WRITE OPERATIONS (Create, Update, Delete)
  // ============================================================================

  async create(
    userId: string,
    transactionId: string,
    data: CreateTransactionDTO
  ): Promise<DataResult<TransactionViewEntity>> {
    try {
      // Validate date format (CTO Mandate #4)
      if (!validateISODate(data.date)) {
        return {
          success: false,
          data: null,
          error: new TransactionValidationError(TRANSACTION_ERRORS.INVALID_DATE_FORMAT),
        };
      }

      // Validate amount range
      if (data.amountCents > TRANSACTION_VALIDATION.MAX_AMOUNT_CENTS) {
        return {
          success: false,
          data: null,
          error: new TransactionValidationError(TRANSACTION_ERRORS.AMOUNT_TOO_LARGE),
        };
      }
      if (data.amountCents < TRANSACTION_VALIDATION.MIN_AMOUNT_CENTS) {
        return {
          success: false,
          data: null,
          error: new TransactionValidationError(TRANSACTION_ERRORS.AMOUNT_TOO_SMALL),
        };
      }

      // CTO GUARDRAIL: Verify account exists
      const accountExists = await this.verifyAccountExists(data.accountId);
      if (!accountExists) {
        return {
          success: false,
          data: null,
          error: new TransactionValidationError(`Account ${data.accountId} not found`),
        };
      }

      // Get account for currency
      const account = await this.database
        .get<AccountModel>('bank_accounts')
        .find(data.accountId);

      // Create transaction with WatermelonDB
      const transactionsCollection = this.database.get<TransactionModel>('transactions');

      let createdTransaction: TransactionModel | null = null;

      await this.database.write(async () => {
        createdTransaction = await transactionsCollection.create((record) => {
          // Use provided ID or generate new one (CTO: Birth Certificate Rule)
          record._raw.id = transactionId || generateEntityId();
          record.userId = userId;
          record.accountId = data.accountId;
          record.categoryId = data.categoryId || null;
          record.amountCents = Math.round(data.amountCents); // CTO: Integer cents
          record.amountHomeCents = Math.round(data.amountCents); // TODO: Apply exchange rate
          record.exchangeRate = 1; // TODO: Get from exchange rate service
          record.date = new Date(data.date);
          record.description = data.description || null;
          record.notes = data.notes || null;
          record.sourceText = data.sourceText || null;
          record.inboxId = data.inboxId || null;
          record.transferId = null;
          record.cleared = false;
          record.reconciliationId = null;

          // CTO MANDATE: Sync fields
          record.version = 1; // Will be updated by sync engine
          record.deletedAt = null;
          record.localSyncStatus = getInitialSyncStatus(); // 'pending'
        });
      });

      if (!createdTransaction) {
        return {
          success: false,
          data: null,
          error: new TransactionRepositoryError('Failed to create transaction'),
        };
      }

      // Enrich with joined data
      const [enriched] = await this.enrichWithJoinedData([createdTransaction]);

      return {
        success: true,
        data: enriched,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new TransactionRepositoryError(`Failed to create transaction: ${(err as Error).message}`),
      };
    }
  }

  async update(
    userId: string,
    id: string,
    data: UpdateTransactionDTO
  ): Promise<DataResult<TransactionViewEntity>> {
    try {
      // Validate date format
      if (!validateISODate(data.date)) {
        return {
          success: false,
          data: null,
          error: new TransactionValidationError(TRANSACTION_ERRORS.INVALID_DATE_FORMAT),
          conflict: false,
        };
      }

      // Find existing transaction
      let transaction: TransactionModel;
      try {
        transaction = await this.database
          .get<TransactionModel>('transactions')
          .find(id);
      } catch {
        return {
          success: false,
          data: null,
          error: new TransactionNotFoundError(id),
        };
      }

      // Verify ownership
      if (transaction.userId !== userId) {
        return {
          success: false,
          data: null,
          error: new TransactionNotFoundError(id),
        };
      }

      // Check tombstone
      if (transaction.deletedAt !== null) {
        return {
          success: false,
          data: null,
          error: new TransactionNotFoundError(id),
        };
      }

      // CTO MANDATE: Mutation Lock Pattern
      // If record is already pending, we're merging into an existing pending state.
      // No version check needed - the local device is the temporary master.
      // If record is synced, we do version check before transitioning to pending.
      const isPending = transaction.localSyncStatus === SYNC_STATUS.PENDING;

      if (!isPending) {
        // Synced record: Enforce optimistic concurrency control
        if (transaction.version !== data.version) {
          return {
            success: false,
            data: null,
            error: new TransactionVersionConflictError(id, data.version),
            conflict: true,
          };
        }
      }
      // If isPending: Skip version check - merge into existing pending state

      // CTO GUARDRAIL: Verify account exists
      const accountExists = await this.verifyAccountExists(data.accountId);
      if (!accountExists) {
        return {
          success: false,
          data: null,
          error: new TransactionValidationError(`Account ${data.accountId} not found`),
        };
      }

      // CTO MANDATE: Sync Lock Check - buffer if record is being synced
      const updateData = {
        accountId: data.accountId,
        categoryId: data.categoryId,
        amountCents: Math.round(data.amountCents),
        date: data.date,
        description: data.description,
        notes: data.notes,
      };
      const lockResult = checkAndBufferIfLocked(
        id,
        TABLE_NAMES.TRANSACTIONS,
        updateData
      );
      if (lockResult.isLocked) {
        // Return projected data for optimistic UI
        const [currentEnriched] = await this.enrichWithJoinedData([transaction]);
        const projected: TransactionViewEntity = {
          ...currentEnriched,
          accountId: data.accountId,
          categoryId: data.categoryId || null,
          amountCents: Math.round(data.amountCents),
          amountHomeCents: Math.round(data.amountCents), // TODO: Apply exchange rate
          date: data.date,
          description: data.description || null,
          notes: data.notes || null,
          updatedAt: new Date().toISOString(),
        };
        return { success: true, data: projected, buffered: true };
      }

      // Update transaction with Mutation Lock
      // CTO MANDATE: If already pending, merge into existing pending state.
      // Version stays unchanged - only sync engine increments after server ack.
      await this.database.write(async () => {
        await transaction.update((record) => {
          record.accountId = data.accountId;
          record.categoryId = data.categoryId || null;
          record.amountCents = Math.round(data.amountCents); // CTO: Integer cents
          record.amountHomeCents = Math.round(data.amountCents); // TODO: Apply exchange rate
          record.date = new Date(data.date);
          record.description = data.description || null;
          record.notes = data.notes || null;

          // CTO MANDATE: Mark as pending for sync
          record.localSyncStatus = SYNC_STATUS.PENDING;
          // MUTATION LOCK: Never increment version locally.
          // Version only changes after successful server sync.
          // This prevents Overwriting Race Conditions.
        });
      });

      // Fetch updated record
      const updated = await this.database
        .get<TransactionModel>('transactions')
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
        error: new TransactionRepositoryError(`Failed to update transaction: ${(err as Error).message}`),
      };
    }
  }

  async updateBatch(
    userId: string,
    id: string,
    updates: Partial<CreateTransactionDTO>,
    version: number
  ): Promise<DataResult<TransactionViewEntity>> {
    // Get current transaction to merge with updates
    const currentResult = await this.getById(userId, id);
    if (!currentResult.success) {
      return currentResult;
    }

    const current = currentResult.data;

    // Build full update DTO
    const fullUpdate: UpdateTransactionDTO = {
      accountId: updates.accountId ?? current.accountId,
      amountCents: updates.amountCents ?? current.amountCents,
      date: updates.date ?? current.date,
      categoryId: updates.categoryId !== undefined ? updates.categoryId : current.categoryId,
      description: updates.description !== undefined ? updates.description : current.description,
      notes: updates.notes !== undefined ? updates.notes : current.notes,
      version,
    };

    return this.update(userId, id, fullUpdate);
  }

  async bulkUpdate(
    userId: string,
    data: BulkUpdateTransactionDTO
  ): Promise<DataResult<BulkUpdateResult>> {
    // TODO: Implement bulk update
    return {
      success: false,
      data: null,
      error: new TransactionRepositoryError('Bulk update not yet implemented'),
    };
  }

  // ============================================================================
  // SOFT DELETE OPERATIONS (Tombstone Pattern)
  // ============================================================================

  async delete(userId: string, id: string, version: number): Promise<DataResult<void>> {
    try {
      // Find existing transaction
      let transaction: TransactionModel;
      try {
        transaction = await this.database
          .get<TransactionModel>('transactions')
          .find(id);
      } catch {
        return {
          success: false,
          data: null,
          error: new TransactionNotFoundError(id),
        };
      }

      // Verify ownership
      if (transaction.userId !== userId) {
        return {
          success: false,
          data: null,
          error: new TransactionNotFoundError(id),
        };
      }

      // Already deleted
      if (transaction.deletedAt !== null) {
        return {
          success: false,
          data: null,
          error: new TransactionNotFoundError(id),
        };
      }

      // CTO MANDATE: Optimistic concurrency control
      if (transaction.version !== version) {
        return {
          success: false,
          data: null,
          error: new TransactionVersionConflictError(id, version),
          conflict: true,
        };
      }

      // CTO MANDATE: Sync Lock Check - buffer if record is being synced
      const deleteData = { deletedAt: Date.now() };
      const lockResult = checkAndBufferIfLocked(
        id,
        TABLE_NAMES.TRANSACTIONS,
        deleteData
      );
      if (lockResult.isLocked) {
        // Delete buffered - will be applied after sync completes
        return { success: true, data: undefined as any, buffered: true };
      }

      // CTO MANDATE: Soft delete (Tombstone Pattern)
      await this.database.write(async () => {
        await transaction.update((record) => {
          record.deletedAt = Date.now(); // Tombstone timestamp
          record.localSyncStatus = SYNC_STATUS.PENDING; // Mark for sync
        });
      });

      return {
        success: true,
        data: undefined as any,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new TransactionRepositoryError(`Failed to delete transaction: ${(err as Error).message}`),
      };
    }
  }

  async restore(userId: string, id: string): Promise<DataResult<TransactionViewEntity>> {
    try {
      // Find existing transaction (including deleted)
      let transaction: TransactionModel;
      try {
        transaction = await this.database
          .get<TransactionModel>('transactions')
          .find(id);
      } catch {
        return {
          success: false,
          data: null,
          error: new TransactionNotFoundError(id),
        };
      }

      // Verify ownership
      if (transaction.userId !== userId) {
        return {
          success: false,
          data: null,
          error: new TransactionNotFoundError(id),
        };
      }

      // Not deleted
      if (transaction.deletedAt === null) {
        // Already active - just return it
        const [enriched] = await this.enrichWithJoinedData([transaction]);
        return {
          success: true,
          data: enriched,
        };
      }

      // CTO MANDATE: Sync Lock Check - buffer if record is being synced
      const restoreData = { deletedAt: null };
      const lockResult = checkAndBufferIfLocked(
        id,
        TABLE_NAMES.TRANSACTIONS,
        restoreData
      );
      if (lockResult.isLocked) {
        // Return projected data for optimistic UI (restored state)
        const [currentEnriched] = await this.enrichWithJoinedData([transaction]);
        const projected: TransactionViewEntity = {
          ...currentEnriched,
          deletedAt: null,
          updatedAt: new Date().toISOString(),
        };
        return { success: true, data: projected, buffered: true };
      }

      // Restore (clear tombstone)
      await this.database.write(async () => {
        await transaction.update((record) => {
          record.deletedAt = null;
          record.localSyncStatus = SYNC_STATUS.PENDING; // Mark for sync
        });
      });

      // Fetch updated record
      const restored = await this.database
        .get<TransactionModel>('transactions')
        .find(id);

      // Enrich with joined data
      const [enriched] = await this.enrichWithJoinedData([restored]);

      return {
        success: true,
        data: enriched,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new TransactionRepositoryError(`Failed to restore transaction: ${(err as Error).message}`),
      };
    }
  }

  async getDeleted(
    userId: string,
    sinceVersion?: number
  ): Promise<DataResult<SyncResponse<TransactionViewEntity[]>>> {
    try {
      const query = this.database
        .get<TransactionModel>('transactions')
        .query(
          Q.where('user_id', userId),
          Q.where('deleted_at', Q.notEq(null)),
          ...(sinceVersion ? [Q.where('version', Q.gt(sinceVersion))] : [])
        );

      const deleted = await query.fetch();
      const enriched = await this.enrichWithJoinedData(deleted);

      const currentVersion = deleted.length > 0
        ? Math.max(...deleted.map((t) => t.version))
        : 0;

      return {
        success: true,
        data: {
          data: enriched,
          currentServerVersion: currentVersion,
          hasMore: false,
        },
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new TransactionRepositoryError(`Failed to fetch deleted transactions: ${(err as Error).message}`),
      };
    }
  }

  // ============================================================================
  // DELTA SYNC OPERATIONS
  // ============================================================================

  async getChangesSince(
    userId: string,
    sinceVersion: number
  ): Promise<DataResult<SyncResponse<TransactionChanges>>> {
    try {
      // Get all transactions with version > sinceVersion
      const changedTransactions = await this.database
        .get<TransactionModel>('transactions')
        .query(
          Q.where('user_id', userId),
          Q.where('version', Q.gt(sinceVersion))
        )
        .fetch();

      // Separate into created, updated, deleted
      const deleted: TransactionModel[] = [];
      const createdOrUpdated: TransactionModel[] = [];

      changedTransactions.forEach((t) => {
        if (t.deletedAt !== null) {
          deleted.push(t);
        } else {
          createdOrUpdated.push(t);
        }
      });

      // TODO: Distinguish between created and updated
      // For now, treat all as "updated" (sync engine will handle)
      const enrichedDeleted = await this.enrichWithJoinedData(deleted);
      const enrichedUpdated = await this.enrichWithJoinedData(createdOrUpdated);

      const currentVersion = changedTransactions.length > 0
        ? Math.max(...changedTransactions.map((t) => t.version))
        : sinceVersion;

      return {
        success: true,
        data: {
          data: {
            created: [], // TODO: Track createdAt vs updatedAt
            updated: enrichedUpdated,
            deleted: enrichedDeleted,
          },
          currentServerVersion: currentVersion,
          hasMore: false,
        },
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new TransactionRepositoryError(`Failed to fetch changes: ${(err as Error).message}`),
      };
    }
  }

  async permanentlyDelete(userId: string, id: string): Promise<DataResult<void>> {
    // ADMIN ONLY - not implemented for local
    return {
      success: false,
      data: null,
      error: new TransactionRepositoryError('Permanent delete not supported locally'),
    };
  }

  // ============================================================================
  // SYNC ENGINE METHODS (For Phase 2d)
  // ============================================================================

  /**
   * Get records pending sync
   *
   * CTO: Used by sync engine to find local changes to push
   */
  async getPendingRecords(userId: string): Promise<DataResult<TransactionViewEntity[]>> {
    try {
      const pending = await this.database
        .get<TransactionModel>('transactions')
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
        error: new TransactionRepositoryError(`Failed to fetch pending records: ${(err as Error).message}`),
      };
    }
  }

  /**
   * Get records with conflicts
   *
   * CTO: Used by conflict resolution UI
   */
  async getConflictRecords(userId: string): Promise<DataResult<TransactionViewEntity[]>> {
    try {
      const conflicts = await this.database
        .get<TransactionModel>('transactions')
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
        error: new TransactionRepositoryError(`Failed to fetch conflict records: ${(err as Error).message}`),
      };
    }
  }

  /**
   * Update sync status after push
   *
   * CTO: Called by sync engine after successful/failed push
   */
  async updateSyncStatus(
    id: string,
    status: SyncStatus,
    serverVersion?: number
  ): Promise<DataResult<void>> {
    try {
      const transaction = await this.database
        .get<TransactionModel>('transactions')
        .find(id);

      await this.database.write(async () => {
        await transaction.update((record) => {
          record.localSyncStatus = status;
          if (serverVersion !== undefined) {
            record.version = serverVersion;
          }
        });
      });

      return {
        success: true,
        data: undefined as any,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new TransactionRepositoryError(`Failed to update sync status: ${(err as Error).message}`),
      };
    }
  }
}
