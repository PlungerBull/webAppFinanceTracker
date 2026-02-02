/**
 * Local Account Repository Implementation
 *
 * Implements IAccountRepository using WatermelonDB for offline-first storage.
 *
 * CTO MANDATES:
 * - Tombstone Pattern: ALL queries filter deleted_at using activeTombstoneFilter()
 * - ID Generation Ownership: Repository generates UUIDs via generateEntityId()
 * - Integer Cents: All balance amounts are integers
 * - Sync Status State Machine: All writes start as 'pending'
 * - No N+1 Queries: enrichWithCurrencySymbol uses batch queries
 *
 * @module local-account-repository
 */

import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import type { IAccountRepository } from './account-repository.interface';
import type {
  AccountDataResult,
  CreateAccountDTO,
  UpdateAccountDTO,
  CreateAccountGroupResult,
  AccountFilters,
  AccountViewEntity,
} from '../domain';
import {
  AccountNotFoundError,
  AccountRepositoryError,
  AccountValidationError,
  AccountVersionConflictError,
} from '../domain';
import {
  AccountModel,
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
import { checkAndBufferIfLocked } from '@/lib/sync/sync-lock-manager';
import { localAccountViewsToDomain } from '@/lib/data/local-data-transformers';

/**
 * Local Account Repository
 *
 * Implements account data access using WatermelonDB.
 * All methods return DataResult<T> (never throw exceptions).
 *
 * CTO CRITICAL: This repository ONLY writes locally.
 * Sync engine (Phase 2d) handles pushing to Supabase.
 */
export class LocalAccountRepository implements IAccountRepository {
  constructor(private readonly database: Database) {}

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Enrich accounts with joined currency symbol data
   *
   * CTO MANDATE: No N+1 Queries
   * Batch-fetches all currencies in ONE query,
   * then delegates to shared local-data-transformers.
   *
   * @param accounts - Array of AccountModel instances
   * @returns Array of AccountViewEntity with joined data
   */
  private async enrichWithCurrencySymbol(
    accounts: AccountModel[]
  ): Promise<AccountViewEntity[]> {
    if (accounts.length === 0) {
      return [];
    }

    // Collect unique currency codes
    const currencyCodes = [...new Set(accounts.map((a) => a.currencyCode))];

    // Batch fetch currencies (CTO: No N+1)
    const currencies = await this.database
      .get<CurrencyModel>('global_currencies')
      .query(Q.where('code', Q.oneOf(currencyCodes)))
      .fetch();

    // Create lookup map for O(1) access
    const currencyMap = new Map(currencies.map((c) => [c.code, c]));

    // Delegate to shared transformer (CTO: Single Interface Rule)
    return localAccountViewsToDomain(accounts, currencyMap);
  }

  /**
   * Apply filters to WatermelonDB query
   */
  private buildFilterClauses(filters?: AccountFilters): Q.Clause[] {
    const clauses: Q.Clause[] = [];

    if (filters?.type) {
      clauses.push(Q.where('type', filters.type));
    }

    if (filters?.isVisible !== undefined) {
      clauses.push(Q.where('is_visible', filters.isVisible));
    }

    if (filters?.groupId) {
      clauses.push(Q.where('group_id', filters.groupId));
    }

    return clauses;
  }

  // ============================================================================
  // QUERY OPERATIONS (Read)
  // ============================================================================

  async getAll(
    userId: string,
    filters?: AccountFilters
  ): Promise<AccountDataResult<AccountViewEntity[]>> {
    try {
      // Build query with tombstone filter (CTO MANDATE)
      const filterClauses = this.buildFilterClauses(filters);
      const includeDeleted = filters?.includeDeleted ?? false;

      const accounts = await this.database
        .get<AccountModel>('bank_accounts')
        .query(
          Q.where('user_id', userId),
          ...(includeDeleted ? [] : activeTombstoneFilter()),
          ...filterClauses,
          Q.sortBy('name', Q.asc)
        )
        .fetch();

      // Enrich with joined data (CTO: Batch query, no N+1)
      const enriched = await this.enrichWithCurrencySymbol(accounts);

      return {
        success: true,
        data: enriched,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new AccountRepositoryError(
          `Failed to fetch accounts: ${(err as Error).message}`,
          err
        ),
      };
    }
  }

  async getById(
    userId: string,
    id: string
  ): Promise<AccountDataResult<AccountViewEntity>> {
    try {
      const account = await this.database
        .get<AccountModel>('bank_accounts')
        .find(id);

      // Verify ownership and not deleted
      if (account.userId !== userId) {
        return {
          success: false,
          data: null,
          error: new AccountNotFoundError(id),
        };
      }

      if (account.deletedAt !== null) {
        return {
          success: false,
          data: null,
          error: new AccountNotFoundError(id),
        };
      }

      // Enrich with joined data
      const [enriched] = await this.enrichWithCurrencySymbol([account]);

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
          error: new AccountNotFoundError(id),
        };
      }
      return {
        success: false,
        data: null,
        error: new AccountRepositoryError(
          `Failed to fetch account: ${(err as Error).message}`,
          err
        ),
      };
    }
  }

  async getByGroupId(
    userId: string,
    groupId: string
  ): Promise<AccountDataResult<AccountViewEntity[]>> {
    return this.getAll(userId, { groupId });
  }

  // ============================================================================
  // WRITE OPERATIONS
  // ============================================================================

  async createWithCurrencies(
    userId: string,
    data: CreateAccountDTO
  ): Promise<AccountDataResult<CreateAccountGroupResult>> {
    try {
      // =========================================================================
      // VALIDATION GATES: Fail fast if preconditions not met
      // CTO MANDATE: Architecture violations throw, not return error
      // =========================================================================

      if (!userId) {
        throw new Error(
          '[AccountFactory] Architecture Violation: userId is required'
        );
      }

      if (!data.name?.trim()) {
        throw new Error(
          '[AccountFactory] Architecture Violation: name is required'
        );
      }

      if (!data.currencies || data.currencies.length === 0) {
        return {
          success: false,
          data: null,
          error: new AccountValidationError(
            'At least one currency is required',
            'currencies'
          ),
        };
      }

      // Generate group ID BEFORE transaction - ensures atomicity
      const groupId = generateEntityId();
      const createdAccounts: AccountModel[] = [];

      // Create account with WatermelonDB
      const accountsCollection = this.database.get<AccountModel>('bank_accounts');

      await this.database.write(async () => {
        // Create one account per currency
        for (const currencyCode of data.currencies) {
          const account = await accountsCollection.create((record) => {
            // Use provided ID for first account, generate for rest
            record._raw.id =
              data.id && data.currencies[0] === currencyCode
                ? data.id
                : generateEntityId();
            record.userId = userId;
            record.groupId = groupId;
            record.name = data.name;
            record.type = data.type;
            record.currencyCode = currencyCode;
            record.color = data.color;
            record.isVisible = true;
            record.currentBalanceCents = 0; // New accounts start with 0 balance

            // CTO MANDATE: Sync fields
            record.version = 1;
            record.deletedAt = null;
            record.localSyncStatus = getInitialSyncStatus(); // 'pending'
          });
          createdAccounts.push(account);
        }
      });

      // Enrich with currency symbols
      const enrichedAccounts = await this.enrichWithCurrencySymbol(createdAccounts);

      return {
        success: true,
        data: {
          groupId,
          accounts: enrichedAccounts,
        },
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new AccountRepositoryError(
          `Failed to create account: ${(err as Error).message}`,
          err
        ),
      };
    }
  }

  async update(
    userId: string,
    id: string,
    data: UpdateAccountDTO
  ): Promise<AccountDataResult<AccountViewEntity>> {
    try {
      // Find existing account
      let account: AccountModel;
      try {
        account = await this.database
          .get<AccountModel>('bank_accounts')
          .find(id);
      } catch {
        return {
          success: false,
          data: null,
          error: new AccountNotFoundError(id),
        };
      }

      // Verify ownership
      if (account.userId !== userId) {
        return {
          success: false,
          data: null,
          error: new AccountNotFoundError(id),
        };
      }

      // Check tombstone
      if (account.deletedAt !== null) {
        return {
          success: false,
          data: null,
          error: new AccountNotFoundError(id),
        };
      }

      // CTO MANDATE: Mutation Lock Pattern
      // If record is already pending, we're merging into an existing pending state.
      // No version check needed - the local device is the temporary master.
      // If record is synced, we do version check before transitioning to pending.
      const isPending = account.localSyncStatus === SYNC_STATUS.PENDING;

      if (!isPending) {
        // Synced record: Enforce optimistic concurrency control
        if (account.version !== data.version) {
          return {
            success: false,
            data: null,
            error: new AccountVersionConflictError(id, data.version),
            conflict: true,
          };
        }
      }
      // If isPending: Skip version check - merge into existing pending state

      // CTO MANDATE: Sync Lock Check - buffer if record is being synced
      const updateData = {
        name: data.name,
        color: data.color,
        isVisible: data.isVisible,
      };
      const lockResult = checkAndBufferIfLocked(
        id,
        TABLE_NAMES.BANK_ACCOUNTS,
        updateData
      );
      if (lockResult.isLocked) {
        // Return projected data for optimistic UI
        const [currentEnriched] = await this.enrichWithCurrencySymbol([account]);
        const projected: AccountViewEntity = {
          ...currentEnriched,
          name: data.name ?? currentEnriched.name,
          color: data.color ?? currentEnriched.color,
          isVisible: data.isVisible ?? currentEnriched.isVisible,
          updatedAt: new Date().toISOString(),
        };
        return { success: true, data: projected, buffered: true };
      }

      // Update account with Mutation Lock
      await this.database.write(async () => {
        await account.update((record) => {
          if (data.name !== undefined) {
            record.name = data.name;
          }
          if (data.color !== undefined) {
            record.color = data.color;
          }
          if (data.isVisible !== undefined) {
            record.isVisible = data.isVisible;
          }

          // CTO MANDATE: Mark as pending for sync
          record.localSyncStatus = SYNC_STATUS.PENDING;
          // MUTATION LOCK: Never increment version locally.
          // Version only changes after successful server sync.
          // This prevents Overwriting Race Conditions.
        });
      });

      // Fetch updated record
      const updated = await this.database
        .get<AccountModel>('bank_accounts')
        .find(id);

      // Enrich with joined data
      const [enriched] = await this.enrichWithCurrencySymbol([updated]);

      return {
        success: true,
        data: enriched,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new AccountRepositoryError(
          `Failed to update account: ${(err as Error).message}`,
          err
        ),
      };
    }
  }

  async delete(
    userId: string,
    id: string,
    version: number
  ): Promise<AccountDataResult<void>> {
    try {
      // Find existing account
      let account: AccountModel;
      try {
        account = await this.database
          .get<AccountModel>('bank_accounts')
          .find(id);
      } catch {
        return {
          success: false,
          data: null,
          error: new AccountNotFoundError(id),
        };
      }

      // Verify ownership
      if (account.userId !== userId) {
        return {
          success: false,
          data: null,
          error: new AccountNotFoundError(id),
        };
      }

      // Already deleted
      if (account.deletedAt !== null) {
        return {
          success: false,
          data: null,
          error: new AccountNotFoundError(id),
        };
      }

      // CTO MANDATE: Optimistic concurrency control
      if (account.version !== version) {
        return {
          success: false,
          data: null,
          error: new AccountVersionConflictError(id, version),
          conflict: true,
        };
      }

      // CTO MANDATE: Sync Lock Check - buffer if record is being synced
      const deleteData = { deletedAt: Date.now() };
      const lockResult = checkAndBufferIfLocked(
        id,
        TABLE_NAMES.BANK_ACCOUNTS,
        deleteData
      );
      if (lockResult.isLocked) {
        // Delete buffered - will be applied after sync completes
        return { success: true, data: undefined, buffered: true };
      }

      // CTO MANDATE: Soft delete (Tombstone Pattern)
      await this.database.write(async () => {
        await account.update((record) => {
          record.deletedAt = Date.now(); // Tombstone timestamp
          record.localSyncStatus = SYNC_STATUS.PENDING; // Mark for sync
        });
      });

      return { success: true, data: undefined };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new AccountRepositoryError(
          `Failed to delete account: ${(err as Error).message}`,
          err
        ),
      };
    }
  }

  // ============================================================================
  // SYNC ENGINE METHODS (For Phase 2d)
  // ============================================================================

  /**
   * Get records pending sync
   *
   * CTO: Used by sync engine to find local changes to push
   */
  async getPendingRecords(userId: string): Promise<AccountDataResult<AccountViewEntity[]>> {
    try {
      const pending = await this.database
        .get<AccountModel>('bank_accounts')
        .query(
          Q.where('user_id', userId),
          ...pendingSyncFilter()
        )
        .fetch();

      const enriched = await this.enrichWithCurrencySymbol(pending);

      return {
        success: true,
        data: enriched,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new AccountRepositoryError(
          `Failed to fetch pending records: ${(err as Error).message}`,
          err
        ),
      };
    }
  }

  /**
   * Get records with conflicts
   *
   * CTO: Used by conflict resolution UI
   */
  async getConflictRecords(userId: string): Promise<AccountDataResult<AccountViewEntity[]>> {
    try {
      const conflicts = await this.database
        .get<AccountModel>('bank_accounts')
        .query(
          Q.where('user_id', userId),
          ...conflictFilter()
        )
        .fetch();

      const enriched = await this.enrichWithCurrencySymbol(conflicts);

      return {
        success: true,
        data: enriched,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new AccountRepositoryError(
          `Failed to fetch conflict records: ${(err as Error).message}`,
          err
        ),
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
  ): Promise<AccountDataResult<void>> {
    try {
      const account = await this.database
        .get<AccountModel>('bank_accounts')
        .find(id);

      await this.database.write(async () => {
        await account.update((record) => {
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
        error: new AccountRepositoryError(
          `Failed to update sync status: ${(err as Error).message}`,
          err
        ),
      };
    }
  }

  /**
   * Update account balance (for sync engine)
   *
   * CTO: Called by sync engine when server returns updated balance
   */
  async updateBalance(
    id: string,
    balanceCents: number,
    serverVersion: number
  ): Promise<AccountDataResult<void>> {
    try {
      const account = await this.database
        .get<AccountModel>('bank_accounts')
        .find(id);

      await this.database.write(async () => {
        await account.update((record) => {
          record.currentBalanceCents = Math.round(balanceCents);
          record.version = serverVersion;
          record.localSyncStatus = SYNC_STATUS.SYNCED;
        });
      });

      return { success: true, data: undefined };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new AccountRepositoryError(
          `Failed to update balance: ${(err as Error).message}`,
          err
        ),
      };
    }
  }
}
