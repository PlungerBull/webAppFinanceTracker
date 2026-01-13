/**
 * Transaction Service Interface
 *
 * Service layer contract for business logic operations.
 *
 * Key Differences from Repository:
 * - Service: Business logic (UUID generation, retry logic, auth extraction)
 * - Repository: Pure data access (no logic, just CRUD)
 *
 * Service Responsibilities:
 * 1. Auth context extraction (getCurrentUserId from auth provider)
 * 2. Client-side UUID generation (for optimistic updates)
 * 3. Retry logic on version conflicts (auto-retry with fresh version)
 * 4. Error translation (repository errors → domain errors with context)
 *
 * Swift Protocol Mirror:
 * ```swift
 * protocol TransactionServiceProtocol {
 *     func getAllPaginated(filters: TransactionFilters?,
 *                          pagination: PaginationOptions?) async throws -> PaginatedResult<TransactionViewEntity>
 *     func getById(id: String) async throws -> TransactionViewEntity
 *     func create(data: CreateTransactionDTO) async throws -> TransactionViewEntity
 *     func update(id: String, data: UpdateTransactionDTO) async throws -> TransactionViewEntity
 *     // ... all other methods
 * }
 * ```
 *
 * @module transaction-service-interface
 */

import type {
  CreateTransactionDTO,
  UpdateTransactionDTO,
  BulkUpdateTransactionDTO,
  BulkUpdateResult,
  CreateTransferDTO,
  TransferResult,
  TransactionFilters,
  PaginationOptions,
  PaginatedResult,
  SyncResponse,
  TransactionChanges,
  CategoryCounts,
} from '../domain/types';
import type { TransactionViewEntity } from '../domain/entities';

/**
 * Transaction Service Interface
 *
 * Higher-level operations with business logic.
 * Methods do NOT take userId parameter (extracted internally from auth).
 */
export interface ITransactionService {
  // ============================================================================
  // QUERY OPERATIONS
  // ============================================================================

  /**
   * Get paginated transactions with optional filtering
   *
   * Automatically fetches current user from auth provider.
   * Returns transactions ordered by date DESC (newest first).
   *
   * @param filters - Optional query filters
   * @param pagination - Optional pagination options
   * @returns Paginated result with transactions
   * @throws {TransactionError} On error
   */
  getAllPaginated(
    filters?: TransactionFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<TransactionViewEntity>>;

  /**
   * Get single transaction by ID
   *
   * @param id - Transaction ID (UUID)
   * @returns Transaction entity
   * @throws {TransactionNotFoundError} If transaction doesn't exist
   * @throws {TransactionError} On error
   */
  getById(id: string): Promise<TransactionViewEntity>;

  /**
   * Get category counts with optional filtering
   *
   * @param filters - Optional query filters
   * @returns Category counts (categoryId → count)
   * @throws {TransactionError} On error
   */
  getCategoryCounts(filters?: TransactionFilters): Promise<CategoryCounts>;

  // ============================================================================
  // WRITE OPERATIONS
  // ============================================================================

  /**
   * Create new transaction
   *
   * Business logic:
   * 1. Generate client-side UUID (for optimistic updates)
   * 2. Extract current user ID from auth provider
   * 3. Call repository.create()
   *
   * @param data - Transaction data (amountCents, date, accountId, etc.)
   * @returns Created transaction
   * @throws {TransactionValidationError} If validation fails
   * @throws {TransactionError} On error
   */
  create(data: CreateTransactionDTO): Promise<TransactionViewEntity>;

  /**
   * Update existing transaction
   *
   * Business logic:
   * 1. Extract current user ID from auth provider
   * 2. Call repository.update() with version check
   * 3. If version conflict, auto-retry with fresh version (max 2 attempts)
   * 4. If conflict persists, throw VersionConflictError
   *
   * @param id - Transaction ID (UUID)
   * @param data - Updated transaction data (includes version)
   * @returns Updated transaction
   * @throws {TransactionVersionConflictError} If version conflict after retry
   * @throws {TransactionNotFoundError} If transaction doesn't exist
   * @throws {TransactionError} On error
   */
  update(id: string, data: UpdateTransactionDTO): Promise<TransactionViewEntity>;

  /**
   * Update transaction with partial changes
   *
   * Similar to update() but only changes specified fields.
   *
   * @param id - Transaction ID (UUID)
   * @param updates - Partial updates
   * @param version - Current version (optimistic concurrency)
   * @returns Updated transaction
   * @throws {TransactionError} On error
   */
  updateBatch(
    id: string,
    updates: Partial<CreateTransactionDTO>,
    version: number
  ): Promise<TransactionViewEntity>;

  /**
   * Bulk update multiple transactions
   *
   * @param data - Transaction IDs and partial updates
   * @returns Bulk update result (success/failure counts)
   * @throws {TransactionError} On error
   */
  bulkUpdate(data: BulkUpdateTransactionDTO): Promise<BulkUpdateResult>;

  // ============================================================================
  // SOFT DELETE OPERATIONS
  // ============================================================================

  /**
   * Soft delete transaction
   *
   * Sets deleted_at = NOW() (tombstone pattern).
   *
   * @param id - Transaction ID (UUID)
   * @param version - Current version (optimistic concurrency)
   * @throws {TransactionVersionConflictError} If version conflict
   * @throws {TransactionNotFoundError} If transaction doesn't exist
   * @throws {TransactionError} On error
   */
  delete(id: string, version: number): Promise<void>;

  /**
   * Restore soft-deleted transaction
   *
   * Sets deleted_at = NULL.
   *
   * @param id - Transaction ID (UUID)
   * @returns Restored transaction
   * @throws {TransactionError} On error
   */
  restore(id: string): Promise<TransactionViewEntity>;

  /**
   * Get deleted transactions (for delta sync)
   *
   * @param sinceVersion - Optional version number (default: 0 = all deleted)
   * @returns Sync response with deleted transactions
   * @throws {TransactionError} On error
   */
  getDeleted(sinceVersion?: number): Promise<SyncResponse<TransactionViewEntity[]>>;

  // ============================================================================
  // ATOMIC TRANSFER OPERATIONS
  // ============================================================================

  /**
   * Create atomic transfer (two transactions in one RPC call)
   *
   * CTO Mandate #1: Atomic Transfer Protocol
   * - Single RPC creates BOTH transactions atomically
   * - All-or-nothing: both succeed or both fail
   *
   * @param data - Transfer data (fromAccountId, toAccountId, amountCents)
   * @returns Transfer result (both transaction IDs + entities)
   * @throws {TransactionError} On error
   */
  createTransfer(data: CreateTransferDTO): Promise<TransferResult>;

  // ============================================================================
  // DELTA SYNC OPERATIONS (Future - Phase 2)
  // ============================================================================

  /**
   * Get all changes since version (for full delta sync)
   *
   * @param sinceVersion - Version number (get changes after this version)
   * @returns Sync response (created/updated/deleted + currentServerVersion)
   * @throws {TransactionError} On error
   */
  getChangesSince(sinceVersion: number): Promise<SyncResponse<TransactionChanges>>;
}
