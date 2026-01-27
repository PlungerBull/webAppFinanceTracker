/**
 * Inbox Repository Interface
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
 * protocol InboxRepositoryProtocol {
 *     func getPendingPaginated(userId: String, pagination: PaginationOptions?)
 *         async -> Result<PaginatedResult<InboxItemViewEntity>, InboxError>
 *     func getById(userId: String, id: String)
 *         async -> Result<InboxItemViewEntity, InboxError>
 *     func create(userId: String, data: CreateInboxItemDTO)
 *         async -> Result<InboxItemViewEntity, InboxError>
 *     func createBatch(userId: String, items: [CreateInboxItemDTO])
 *         async -> Result<[InboxItemViewEntity], InboxError>
 *     func update(userId: String, id: String, data: UpdateInboxItemDTO)
 *         async -> Result<InboxItemViewEntity, InboxError>
 *     func updateBatch(userId: String, updates: [(id: String, data: UpdateInboxItemDTO)])
 *         async -> Result<[InboxItemViewEntity], InboxError>
 *     func promote(userId: String, data: PromoteInboxItemDTO)
 *         async -> Result<PromoteResult, InboxError>
 *     func dismiss(userId: String, id: String)
 *         async -> Result<Void, InboxError>
 * }
 * ```
 *
 * @module inbox-repository-interface
 */

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

/**
 * Inbox Repository Interface
 *
 * Platform-agnostic contract for inbox data access.
 * Implementations MUST NOT throw errors - use DataResult<T> pattern.
 */
export interface IInboxRepository {
  // ============================================================================
  // QUERY OPERATIONS (Read)
  // ============================================================================

  /**
   * Get paginated pending inbox items
   *
   * Returns items in FIFO order (oldest first) for processing.
   * Only returns items with status = 'pending'.
   *
   * @param userId - User ID (UUID)
   * @param pagination - Optional pagination (offset, limit)
   * @returns DataResult with paginated inbox items or error
   *
   * @example
   * ```typescript
   * const result = await repository.getPendingPaginated(
   *   userId,
   *   { offset: 0, limit: 20 }
   * );
   *
   * if (!result.success) {
   *   console.error(result.error.message);
   *   return;
   * }
   *
   * console.log(`Found ${result.data.total} pending items`);
   * ```
   */
  getPendingPaginated(
    userId: string,
    pagination?: PaginationOptions
  ): Promise<DataResult<PaginatedResult<InboxItemViewEntity>>>;

  /**
   * Get single inbox item by ID
   *
   * Returns full inbox item with joined account/category data.
   * Returns NotFoundError if item doesn't exist.
   *
   * @param userId - User ID (UUID)
   * @param id - Inbox item ID (UUID)
   * @returns DataResult with inbox item or error
   */
  getById(userId: string, id: string): Promise<DataResult<InboxItemViewEntity>>;

  // ============================================================================
  // WRITE OPERATIONS (Create, Update)
  // ============================================================================

  /**
   * Create new inbox item (scratchpad mode)
   *
   * ALL fields are optional - supports partial data entry.
   * Uses Write-then-Read pattern for complete data.
   *
   * CTO Mandate: Integer Cents
   * - data.amountCents MUST be integer (no decimals)
   *
   * @param userId - User ID (UUID)
   * @param data - Inbox item data (all optional for scratchpad)
   * @returns DataResult with created inbox item or error
   *
   * @example
   * ```typescript
   * const result = await repository.create(userId, {
   *   amountCents: 1050,  // $10.50
   *   description: 'Coffee shop',
   * });
   * ```
   */
  create(
    userId: string,
    data: CreateInboxItemDTO
  ): Promise<DataResult<InboxItemViewEntity>>;

  /**
   * Update draft inbox item
   *
   * Supports partial updates (only specified fields change).
   * Item remains in 'pending' status.
   *
   * @param userId - User ID (UUID)
   * @param id - Inbox item ID (UUID)
   * @param data - Partial updates
   * @returns DataResult with updated inbox item or error
   */
  update(
    userId: string,
    id: string,
    data: UpdateInboxItemDTO
  ): Promise<DataResult<InboxItemViewEntity>>;

  // ============================================================================
  // BATCH OPERATIONS (Offline Sync - CTO Mandate)
  // ============================================================================

  /**
   * Batch create inbox items (for offline sync push)
   *
   * Creates multiple inbox items in a single operation.
   * Used by sync engine to push offline-created items.
   *
   * Implementation Note:
   * - Initial implementation may loop through create() calls
   * - Will be replaced with single RPC for atomic batch insert
   *
   * @param userId - User ID (UUID)
   * @param items - Array of inbox items to create
   * @returns DataResult with array of created inbox items or error
   *
   * @example
   * ```typescript
   * const result = await repository.createBatch(userId, [
   *   { amountCents: 1050, description: 'Coffee' },
   *   { amountCents: 2500, description: 'Lunch' },
   * ]);
   * ```
   */
  createBatch(
    userId: string,
    items: CreateInboxItemDTO[]
  ): Promise<DataResult<InboxItemViewEntity[]>>;

  /**
   * Batch update inbox items (for offline sync push)
   *
   * Updates multiple inbox items in a single operation.
   * Used by sync engine to push offline-modified items.
   *
   * Implementation Note:
   * - Initial implementation may loop through update() calls
   * - Will be replaced with single RPC for atomic batch update
   *
   * @param userId - User ID (UUID)
   * @param updates - Array of {id, data} update pairs
   * @returns DataResult with array of updated inbox items or error
   *
   * @example
   * ```typescript
   * const result = await repository.updateBatch(userId, [
   *   { id: 'inbox-1', data: { categoryId: 'cat-123' } },
   *   { id: 'inbox-2', data: { accountId: 'acc-456' } },
   * ]);
   * ```
   */
  updateBatch(
    userId: string,
    updates: Array<{ id: string; data: UpdateInboxItemDTO }>
  ): Promise<DataResult<InboxItemViewEntity[]>>;

  // ============================================================================
  // PROMOTION OPERATIONS (Inbox → Ledger)
  // ============================================================================

  /**
   * Promote inbox item to ledger
   *
   * Calls the promote_inbox_item RPC function which:
   * 1. Validates all required fields
   * 2. Creates transaction in ledger (using integer cents)
   * 3. Marks inbox item as 'processed'
   * 4. Returns the created transaction ID
   *
   * All-or-nothing atomicity - both operations succeed or both fail.
   *
   * @param userId - User ID (UUID)
   * @param data - Promotion data (required fields for ledger)
   * @returns DataResult with promotion result or error
   *
   * @example
   * ```typescript
   * const result = await repository.promote(userId, {
   *   inboxId: 'inbox-123',
   *   accountId: 'account-456',
   *   categoryId: 'category-789',
   *   finalAmountCents: 1050,
   * });
   *
   * if (result.success) {
   *   console.log('Created transaction:', result.data.transactionId);
   * }
   * ```
   */
  promote(
    userId: string,
    data: PromoteInboxItemDTO
  ): Promise<DataResult<PromoteResult>>;

  // ============================================================================
  // DISMISS OPERATIONS (Ignore)
  // ============================================================================

  /**
   * Dismiss (ignore) inbox item
   *
   * Sets status = 'ignored' and removes from pending list.
   * Item is not deleted, just hidden from processing queue.
   *
   * @param userId - User ID (UUID)
   * @param id - Inbox item ID (UUID)
   * @returns DataResult with void or error
   */
  dismiss(userId: string, id: string): Promise<DataResult<void>>;
}
