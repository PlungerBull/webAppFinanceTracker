/**
 * Transaction Service Implementation
 *
 * Business logic layer for transaction operations.
 *
 * Key Responsibilities:
 * 1. Auth context extraction (getCurrentUserId())
 * 2. Client-side UUID generation (crypto.randomUUID())
 * 3. Retry logic on version conflicts (max 2 attempts)
 * 4. Error translation (DataResult → thrown exceptions)
 *
 * @module transaction-service
 */

import type { ITransactionService } from './transaction-service.interface';
import type { ITransactionRepository } from '../repository';
import type { IAuthProvider } from '@/lib/auth';
import type {
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
import { TransactionVersionConflictError } from '../domain/errors';

/**
 * Transaction Service
 *
 * Implements business logic for transaction operations.
 */
export class TransactionService implements ITransactionService {
  constructor(
    private readonly repository: ITransactionRepository,
    private readonly authProvider: IAuthProvider
  ) {}

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Get current user ID from auth provider
   *
   * Business logic layer responsibility - extracts auth context.
   *
   * @returns User ID (UUID)
   * @throws {AuthenticationError} If user not authenticated
   */
  private async getCurrentUserId(): Promise<string> {
    return this.authProvider.getCurrentUserId();
  }

  /**
   * Generate client-side UUID for optimistic updates
   *
   * Business logic layer responsibility - provides ID to repository.
   *
   * @returns UUID v4
   */
  private generateId(): string {
    return crypto.randomUUID();
  }

  // ============================================================================
  // QUERY OPERATIONS
  // ============================================================================

  async getAllPaginated(
    filters?: TransactionFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<TransactionViewEntity>> {
    const userId = await this.getCurrentUserId();
    const result = await this.repository.getAllPaginated(userId, filters, pagination);

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }

  async getById(id: string): Promise<TransactionViewEntity> {
    const userId = await this.getCurrentUserId();
    const result = await this.repository.getById(userId, id);

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }

  async getCategoryCounts(filters?: TransactionFilters): Promise<CategoryCounts> {
    const userId = await this.getCurrentUserId();
    const result = await this.repository.getCategoryCounts(userId, filters);

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }

  async getCountByCategory(categoryId: string): Promise<number> {
    const userId = await this.getCurrentUserId();
    const result = await this.repository.getCountByCategory(userId, categoryId);

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }

  // ============================================================================
  // WRITE OPERATIONS
  // ============================================================================

  async create(data: CreateTransactionDTO): Promise<TransactionViewEntity> {
    const userId = await this.getCurrentUserId();
    const transactionId = this.generateId();

    const result = await this.repository.create(userId, transactionId, data);

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }

  async update(
    id: string,
    data: UpdateTransactionDTO
  ): Promise<TransactionViewEntity> {
    const userId = await this.getCurrentUserId();

    // First attempt
    const result = await this.repository.update(userId, id, data);

    // Handle version conflict with auto-retry
    if (!result.success && result.conflict) {
      // Fetch latest version
      const latestResult = await this.repository.getById(userId, id);
      if (!latestResult.success) {
        throw latestResult.error;
      }

      const latest = latestResult.data;

      // Retry with fresh version
      const retryData: UpdateTransactionDTO = {
        ...data,
        version: latest.version,
      };

      const retryResult = await this.repository.update(userId, id, retryData);

      // If still conflict after retry, throw error
      if (!retryResult.success && retryResult.conflict) {
        throw new TransactionVersionConflictError(id, data.version);
      }

      // Other error on retry
      if (!retryResult.success) {
        throw retryResult.error;
      }

      return retryResult.data;
    }

    // Non-conflict error on first attempt
    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }

  async updateBatch(
    id: string,
    updates: Partial<CreateTransactionDTO>,
    version: number
  ): Promise<TransactionViewEntity> {
    const userId = await this.getCurrentUserId();
    const result = await this.repository.updateBatch(userId, id, updates, version);

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }

  async bulkUpdate(data: BulkUpdateTransactionDTO): Promise<BulkUpdateResult> {
    const userId = await this.getCurrentUserId();
    const result = await this.repository.bulkUpdate(userId, data);

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }

  // ============================================================================
  // SOFT DELETE OPERATIONS
  // ============================================================================

  async delete(id: string, version: number): Promise<void> {
    const userId = await this.getCurrentUserId();
    const result = await this.repository.delete(userId, id, version);

    if (!result.success) {
      throw result.error;
    }
  }

  async restore(id: string): Promise<TransactionViewEntity> {
    const userId = await this.getCurrentUserId();
    const result = await this.repository.restore(userId, id);

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }

  async getDeleted(
    sinceVersion?: number
  ): Promise<SyncResponse<TransactionViewEntity[]>> {
    const userId = await this.getCurrentUserId();
    const result = await this.repository.getDeleted(userId, sinceVersion);

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }

  // ============================================================================
  // DELTA SYNC OPERATIONS (Future - Phase 2)
  // ============================================================================

  // NOTE: Transfer operations have been moved to TransferService.
  // See features/transactions/services/transfer-service.ts

  async getChangesSince(
    sinceVersion: number
  ): Promise<SyncResponse<TransactionChanges>> {
    const userId = await this.getCurrentUserId();
    const result = await this.repository.getChangesSince(userId, sinceVersion);

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }
}
