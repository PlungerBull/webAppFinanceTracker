/**
 * Transaction Repository Interface
 *
 * THE CONTRACT between Web (TypeScript) and iOS (Swift).
 *
 * CTO Mandate: Platform-Agnostic Data Access Layer
 * - Web implements with Supabase Client SDK
 * - iOS implements with SupabaseSwift SDK + Native Apple Auth
 * - IDENTICAL method signatures on both platforms
 *
 * Critical Design Decisions:
 * 1. ALL methods accept userId as first parameter (no internal auth fetching)
 * 2. Returns domain entities, NOT database types
 * 3. Pure data access - NO business logic (no UUID generation, no retries)
 * 4. Uses DataResult<T> for explicit error handling (no throwing)
 *
 * Swift Protocol Mirror:
 * ```swift
 * protocol TransactionRepositoryProtocol {
 *     func getAllPaginated(userId: String, filters: TransactionFilters?,
 *                          pagination: PaginationOptions?) async -> Result<PaginatedResult<TransactionViewEntity>, DomainError>
 *     func getById(userId: String, id: String) async -> Result<TransactionViewEntity, DomainError>
 *     func create(userId: String, transactionId: String,
 *                 data: CreateTransactionDTO) async -> Result<TransactionViewEntity, DomainError>
 *     func update(userId: String, id: String,
 *                 data: UpdateTransactionDTO) async -> Result<TransactionViewEntity, DomainError>
 *     func delete(userId: String, id: String, version: Int) async -> Result<Void, DomainError>
 *     // ... all other methods
 * }
 * ```
 *
 * @module transaction-repository-interface
 */

import type {
  DataResult,
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
 * Transaction Repository Interface
 *
 * Platform-agnostic contract for transaction data access.
 * Implementations MUST NOT throw errors - use DataResult<T> pattern.
 */
export interface ITransactionRepository {
  // ============================================================================
  // QUERY OPERATIONS (Read)
  // ============================================================================

  /**
   * Get paginated transactions with optional filtering
   *
   * Returns transactions ordered by date DESC (newest first).
   * Excludes soft-deleted records unless filters.includeDeleted = true.
   *
   * @param userId - User ID (UUID)
   * @param filters - Optional query filters (account, category, date range, etc.)
   * @param pagination - Optional pagination (offset, limit)
   * @returns DataResult with paginated transactions or error
   *
   * @example
   * ```typescript
   * const result = await repository.getAllPaginated(
   *   userId,
   *   { accountId: 'abc-123', startDate: '2024-01-01T00:00:00.000Z' },
   *   { offset: 0, limit: 50 }
   * );
   *
   * if (!result.success) {
   *   console.error(result.error.message);
   *   return;
   * }
   *
   * console.log(`Found ${result.data.total} transactions`);
   * ```
   *
   * Swift equivalent:
   * ```swift
   * let result = try await repository.getAllPaginated(
   *     userId: userId,
   *     filters: TransactionFilters(accountId: "abc-123"),
   *     pagination: PaginationOptions(offset: 0, limit: 50)
   * )
   * ```
   */
  getAllPaginated(
    userId: string,
    filters?: TransactionFilters,
    pagination?: PaginationOptions
  ): Promise<DataResult<PaginatedResult<TransactionViewEntity>>>;

  /**
   * Get single transaction by ID
   *
   * Returns full transaction with joined account/category data.
   * Returns NotFoundError if transaction doesn't exist or is soft-deleted.
   *
   * @param userId - User ID (UUID)
   * @param id - Transaction ID (UUID)
   * @returns DataResult with transaction or error
   *
   * @example
   * ```typescript
   * const result = await repository.getById(userId, transactionId);
   * if (!result.success) {
   *   if (result.error.code === 'NOT_FOUND') {
   *     console.log('Transaction deleted or not found');
   *   }
   * }
   * ```
   */
  getById(userId: string, id: string): Promise<DataResult<TransactionViewEntity>>;

  /**
   * Get category counts with optional filtering
   *
   * Returns aggregated counts by category ID.
   * Used for analytics and charts.
   *
   * @param userId - User ID (UUID)
   * @param filters - Optional query filters (date range, account, etc.)
   * @returns DataResult with category counts or error
   *
   * @example
   * ```typescript
   * const result = await repository.getCategoryCounts(userId, {
   *   startDate: '2024-01-01T00:00:00.000Z',
   *   endDate: '2024-01-31T23:59:59.999Z'
   * });
   *
   * if (result.success) {
   *   console.log(result.data); // { "cat-123": 10, "cat-456": 5 }
   * }
   * ```
   */
  getCategoryCounts(
    userId: string,
    filters?: TransactionFilters
  ): Promise<DataResult<CategoryCounts>>;

  // ============================================================================
  // WRITE OPERATIONS (Create, Update, Delete)
  // ============================================================================

  /**
   * Create new transaction
   *
   * Uses Write-then-Read pattern:
   * 1. INSERT into transactions table (RPC function)
   * 2. SELECT from transactions_view (get joined data)
   *
   * CTO Mandate #3: Integer Cents
   * - data.amountCents MUST be integer (no decimals)
   * - Service layer converts dollars → cents before calling
   *
   * CTO Mandate #4: Strict ISO 8601
   * - Repository MUST validate data.date format before inserting
   * - Returns ValidationError if format invalid
   *
   * @param userId - User ID (UUID)
   * @param transactionId - Transaction ID (UUID) - generated by service layer
   * @param data - Transaction data (amountCents, date, accountId, etc.)
   * @returns DataResult with created transaction or error
   *
   * @example
   * ```typescript
   * const result = await repository.create(userId, transactionId, {
   *   accountId: 'abc-123',
   *   amountCents: 1050,  // $10.50
   *   date: '2024-01-12T10:30:00.123Z',
   *   categoryId: 'cat-456',
   *   description: 'Coffee shop'
   * });
   * ```
   */
  create(
    userId: string,
    transactionId: string,
    data: CreateTransactionDTO
  ): Promise<DataResult<TransactionViewEntity>>;

  /**
   * Update existing transaction
   *
   * Uses optimistic concurrency control (version check):
   * - IF version = expected THEN update ELSE conflict
   * - Returns { success: false, conflict: true } on version mismatch
   * - Service layer auto-retries with fresh version
   *
   * CTO Mandate #2: Version-Based Sync
   * - Global monotonic version counter prevents clock drift
   * - Repository checks version in RPC function
   *
   * @param userId - User ID (UUID)
   * @param id - Transaction ID (UUID)
   * @param data - Updated transaction data (includes version)
   * @returns DataResult with updated transaction or error (conflict flag set if version mismatch)
   *
   * @example
   * ```typescript
   * const result = await repository.update(userId, transactionId, {
   *   accountId: 'abc-123',
   *   amountCents: 2000,  // Changed from $10.50 to $20.00
   *   date: '2024-01-12T10:30:00.123Z',
   *   categoryId: 'cat-789',
   *   version: 42  // Optimistic concurrency
   * });
   *
   * if (!result.success && result.conflict) {
   *   console.log('Version conflict - need to retry with fresh data');
   * }
   * ```
   */
  update(
    userId: string,
    id: string,
    data: UpdateTransactionDTO
  ): Promise<DataResult<TransactionViewEntity>>;

  /**
   * Update transaction with partial changes
   *
   * Similar to update() but only changes specified fields.
   * Used for batch operations (e.g., change category on 10 transactions).
   *
   * @param userId - User ID (UUID)
   * @param id - Transaction ID (UUID)
   * @param updates - Partial updates (only fields to change)
   * @param version - Current version (optimistic concurrency)
   * @returns DataResult with updated transaction or error
   */
  updateBatch(
    userId: string,
    id: string,
    updates: Partial<CreateTransactionDTO>,
    version: number
  ): Promise<DataResult<TransactionViewEntity>>;

  /**
   * Bulk update multiple transactions
   *
   * Updates multiple transactions with same partial changes.
   * Returns counts of successes and failures.
   *
   * Max size: 100 transactions (enforced by TRANSACTION_LIMITS.BULK_UPDATE_MAX_SIZE)
   *
   * @param userId - User ID (UUID)
   * @param data - Transaction IDs and partial updates
   * @returns DataResult with bulk update result (success/failure counts)
   *
   * @example
   * ```typescript
   * const result = await repository.bulkUpdate(userId, {
   *   transactionIds: ['id1', 'id2', 'id3'],
   *   updates: { categoryId: 'new-category' }
   * });
   *
   * if (result.success) {
   *   console.log(`Updated ${result.data.successCount} transactions`);
   *   console.log(`Failed: ${result.data.failureCount}`);
   * }
   * ```
   */
  bulkUpdate(
    userId: string,
    data: BulkUpdateTransactionDTO
  ): Promise<DataResult<BulkUpdateResult>>;

  // ============================================================================
  // SOFT DELETE OPERATIONS (Tombstone Pattern)
  // ============================================================================

  /**
   * Soft delete transaction
   *
   * CTO Mandate #1: Soft Deletes (Tombstone Pattern)
   * - Sets deleted_at = NOW() (does NOT physically delete)
   * - Tombstone tells iOS app "this was intentionally deleted"
   * - Enables delta sync reconciliation
   *
   * Why soft deletes?
   * - Offline sync: iOS needs to know what was deleted while offline
   * - Audit trail: Can see when transaction was deleted
   * - Restore capability: Can undo deletes
   * - Conflict resolution: Can detect delete vs edit conflicts
   *
   * @param userId - User ID (UUID)
   * @param id - Transaction ID (UUID)
   * @param version - Current version (optimistic concurrency)
   * @returns DataResult with void or error (conflict flag set if version mismatch)
   *
   * @example
   * ```typescript
   * const result = await repository.delete(userId, transactionId, version);
   * if (!result.success && result.conflict) {
   *   console.log('Transaction was modified by another user');
   * }
   * ```
   */
  delete(userId: string, id: string, version: number): Promise<DataResult<void>>;

  /**
   * Restore soft-deleted transaction
   *
   * Sets deleted_at = NULL (makes transaction visible again).
   * Used for "undo delete" functionality.
   *
   * @param userId - User ID (UUID)
   * @param id - Transaction ID (UUID)
   * @returns DataResult with restored transaction or error
   *
   * @example
   * ```typescript
   * const result = await repository.restore(userId, transactionId);
   * if (result.success) {
   *   console.log('Transaction restored');
   * }
   * ```
   */
  restore(userId: string, id: string): Promise<DataResult<TransactionViewEntity>>;

  /**
   * Get deleted transactions (for delta sync)
   *
   * CTO Mandate #2: Version-Based Sync
   * - Returns soft-deleted transactions since version
   * - Used for delta sync: "what was deleted since last sync?"
   *
   * @param userId - User ID (UUID)
   * @param sinceVersion - Optional version number (default: 0 = all deleted)
   * @returns DataResult with sync response (deleted transactions + currentServerVersion)
   *
   * @example
   * ```typescript
   * const lastSyncVersion = parseInt(localStorage.getItem('lastSyncVersion') || '0');
   * const result = await repository.getDeleted(userId, lastSyncVersion);
   *
   * if (result.success) {
   *   // Remove these from local cache
   *   result.data.data.forEach(txn => localCache.remove(txn.id));
   *   // Store new sync version
   *   localStorage.setItem('lastSyncVersion', result.data.currentServerVersion.toString());
   * }
   * ```
   */
  getDeleted(
    userId: string,
    sinceVersion?: number
  ): Promise<DataResult<SyncResponse<TransactionViewEntity[]>>>;

  // ============================================================================
  // ATOMIC TRANSFER OPERATIONS (CTO Mandate #1)
  // ============================================================================

  /**
   * Create atomic transfer (two transactions in one RPC call)
   *
   * CTO Mandate #1: Atomic Transfer Protocol
   * - Single RPC creates BOTH transactions atomically (all-or-nothing)
   * - Prevents orphaned half-transfers due to network issues
   * - Database transaction ensures consistency
   *
   * Process:
   * 1. Generate transfer_id, out_txn_id, in_txn_id (server-side)
   * 2. INSERT OUT transaction (negative amount)
   * 3. INSERT IN transaction (positive amount)
   * 4. COMMIT or ROLLBACK (both succeed or both fail)
   *
   * @param userId - User ID (UUID)
   * @param data - Transfer data (fromAccountId, toAccountId, amountCents)
   * @returns DataResult with transfer result (both transaction IDs + entities)
   *
   * @example
   * ```typescript
   * const result = await repository.createTransfer(userId, {
   *   fromAccountId: 'checking-account',
   *   toAccountId: 'savings-account',
   *   amountCents: 10000,  // $100.00
   *   date: '2024-01-12T10:30:00.123Z',
   *   description: 'Monthly savings'
   * });
   *
   * if (result.success) {
   *   console.log(`Transfer created: ${result.data.transferId}`);
   *   console.log(`OUT: ${result.data.outTransactionId}`);
   *   console.log(`IN: ${result.data.inTransactionId}`);
   * }
   * ```
   */
  createTransfer(
    userId: string,
    data: CreateTransferDTO
  ): Promise<DataResult<TransferResult>>;

  // ============================================================================
  // DELTA SYNC OPERATIONS (Future - Phase 2)
  // ============================================================================

  /**
   * Get all changes since version (for full delta sync)
   *
   * CTO Mandate #2: Version-Based Sync
   * - Returns created, updated, AND deleted transactions
   * - Used for delta sync: "what changed since last sync?"
   *
   * Future enhancement for Phase 2 (offline-first architecture).
   *
   * @param userId - User ID (UUID)
   * @param sinceVersion - Version number (get changes after this version)
   * @returns DataResult with sync response (all changes + currentServerVersion)
   *
   * @example
   * ```typescript
   * const result = await repository.getChangesSince(userId, lastSyncVersion);
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

  // ============================================================================
  // ADMIN OPERATIONS (Future)
  // ============================================================================

  /**
   * Permanently delete transaction (physical DELETE)
   *
   * ADMIN ONLY - removes record from database permanently.
   * Normal delete operations should use soft delete.
   *
   * @param userId - User ID (UUID)
   * @param id - Transaction ID (UUID)
   * @returns DataResult with void or error
   */
  permanentlyDelete(userId: string, id: string): Promise<DataResult<void>>;
}
