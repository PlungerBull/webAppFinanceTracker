/**
 * Transaction Domain Types
 *
 * Data Transfer Objects (DTOs) and Result types for repository operations.
 *
 * CTO MANDATES INCORPORATED:
 * 1. DataResult<T> Pattern - Swift-compatible explicit error handling
 * 2. Integer Cents DTOs - All amounts are integers (never decimals)
 * 3. Version-Based Sync - SyncResponse includes currentServerVersion
 *
 * Key Principles:
 * - DTOs use primitive types only (cross-platform compatible)
 * - DataResult<T> forces explicit error handling (no silent failures)
 * - All dates are UTC ISO strings
 * - Amounts are INTEGER CENTS (no decimals)
 *
 * @module transaction-types
 */

import type { TransactionError } from './errors';
import type { TransactionEntity, TransactionViewEntity } from './entities';

/**
 * DataResult Pattern (Swift Result<T, Error> Mirror)
 *
 * CTO Mandate #1: Explicit Success/Failure Types
 *
 * Problem: TypeScript's try/catch is too loose - iOS team needs explicit contracts
 * Solution: Repository methods return DataResult<T> instead of throwing
 *
 * Benefits:
 * - Forces explicit error handling at service layer
 * - iOS can mirror with Swift's Result<T, DomainError>
 * - Conflict detection is type-safe (conflict?: boolean)
 * - No ambiguity about error states
 *
 * Swift Mirror:
 * ```swift
 * enum DataResult<T> {
 *     case success(T, conflict: Bool?)
 *     case failure(DomainError, conflict: Bool?)
 * }
 * ```
 *
 * Usage Example:
 * ```typescript
 * // Repository layer
 * async getById(userId: string, id: string): Promise<DataResult<TransactionViewEntity>> {
 *   try {
 *     const { data, error } = await supabase.from('transactions_view')...;
 *     if (error) {
 *       return { success: false, data: null, error: new RepositoryError(error.message) };
 *     }
 *     return { success: true, data: transformedData };
 *   } catch (err) {
 *     return { success: false, data: null, error: new UnexpectedError(err) };
 *   }
 * }
 *
 * // Service layer
 * const result = await this.repository.getById(userId, id);
 * if (!result.success) {
 *   throw result.error;  // Propagate domain error
 * }
 * return result.data;
 * ```
 */
export type DataResult<T> =
  | { success: true; data: T; conflict?: boolean }
  | { success: false; data: null; error: TransactionError; conflict?: boolean };

/**
 * Create Transaction DTO
 *
 * Input for creating a new transaction.
 *
 * CRITICAL: amountCents is INTEGER CENTS (CTO Mandate #3)
 * - $10.50 = 1050 cents (NOT 10.5)
 * - $0.01 = 1 cent
 * - $100.00 = 10000 cents
 *
 * Service layer is responsible for converting user input (dollars) to cents
 * before passing to repository.
 *
 * Swift Mirror:
 * ```swift
 * struct CreateTransactionDTO: Codable {
 *     let accountId: String
 *     let amountCents: Int  // Integer cents!
 *     let date: String
 *     let categoryId: String?
 *     let description: String?
 *     let notes: String?
 *     let sourceText: String?
 *     let inboxId: String?
 * }
 * ```
 */
export interface CreateTransactionDTO {
  /**
   * Account ID (foreign key)
   * Required - every transaction belongs to an account
   */
  readonly accountId: string;

  /**
   * Amount in INTEGER CENTS
   *
   * SACRED INTEGER ARITHMETIC (CTO Mandate #3)
   * - $10.50 = 1050 (NOT 10.5)
   * - $0.01 = 1
   * - $100.00 = 10000
   *
   * Service layer converts dollars → cents:
   * amountCents = Math.round(dollars * 100)
   */
  readonly amountCents: number;

  /**
   * Transaction date (when it occurred)
   *
   * Format: YYYY-MM-DDTHH:mm:ss.SSSZ (strict ISO 8601)
   * Example: "2024-01-12T10:30:00.123Z"
   *
   * Repository layer validates format before inserting.
   */
  readonly date: string;

  /**
   * Category ID (foreign key)
   * Optional - uncategorized transactions have null
   */
  readonly categoryId?: string | null;

  /**
   * Transaction description (user-facing)
   * Max length: 255 characters (enforced by constants)
   */
  readonly description?: string | null;

  /**
   * Additional notes (user-facing)
   * Max length: 1000 characters (enforced by constants)
   */
  readonly notes?: string | null;

  /**
   * Source text (for inbox items)
   * Original text that generated this transaction
   */
  readonly sourceText?: string | null;

  /**
   * Inbox ID (for inbox items)
   * Links to original inbox item that created this transaction
   */
  readonly inboxId?: string | null;
}

/**
 * Update Transaction DTO
 *
 * Input for updating an existing transaction.
 *
 * CRITICAL: Includes version field for optimistic concurrency control
 * - Service layer auto-retries on version conflict
 * - Repository layer detects conflict via RPC result
 *
 * Swift Mirror:
 * ```swift
 * struct UpdateTransactionDTO: Codable {
 *     let accountId: String
 *     let amountCents: Int
 *     let date: String
 *     let categoryId: String?
 *     let description: String?
 *     let notes: String?
 *     let version: Int  // Optimistic concurrency
 * }
 * ```
 */
export interface UpdateTransactionDTO {
  readonly accountId: string;
  readonly amountCents: number;  // INTEGER CENTS
  readonly date: string;  // YYYY-MM-DDTHH:mm:ss.SSSZ
  readonly categoryId?: string | null;
  readonly description?: string | null;
  readonly notes?: string | null;

  /**
   * Version number for optimistic concurrency control
   *
   * CTO Mandate #2: Version-Based Sync
   * - Global monotonic version (NOT per-record counter)
   * - Repository checks: IF version = expected THEN update ELSE conflict
   * - Service layer auto-retries with fresh version on conflict
   */
  readonly version: number;
}

/**
 * Bulk Update Transaction DTO
 *
 * Input for updating multiple transactions at once.
 * Used for batch operations (e.g., change category on 50 transactions).
 *
 * Swift Mirror:
 * ```swift
 * struct BulkUpdateTransactionDTO: Codable {
 *     let transactionIds: [String]
 *     let updates: [String: Any]  // Partial updates
 * }
 * ```
 */
export interface BulkUpdateTransactionDTO {
  /**
   * Array of transaction IDs to update
   * Max size: 100 (enforced by constants)
   */
  readonly transactionIds: string[];

  /**
   * Partial updates to apply to all transactions
   * Only specified fields will be updated
   */
  readonly updates: Partial<Omit<CreateTransactionDTO, 'accountId' | 'amountCents' | 'date'>>;
}

/**
 * Bulk Update Result
 *
 * Response from bulk update operations.
 * Includes both successful and failed IDs.
 */
export interface BulkUpdateResult {
  /** Number of transactions successfully updated */
  readonly successCount: number;

  /** Number of transactions that failed to update */
  readonly failureCount: number;

  /** IDs of successfully updated transactions */
  readonly successIds: string[];

  /** IDs of transactions that failed (with error messages) */
  readonly failures: Array<{
    readonly id: string;
    readonly error: string;
  }>;
}

/**
 * Create Transfer DTO
 *
 * Input for creating an atomic transfer (two transactions).
 *
 * CTO Mandate #1: Atomic Transfer Protocol
 * - Single RPC call creates BOTH transactions atomically
 * - All-or-nothing: both succeed or both fail
 * - Prevents orphaned half-transfers due to network issues
 *
 * Swift Mirror:
 * ```swift
 * struct CreateTransferDTO: Codable {
 *     let fromAccountId: String
 *     let toAccountId: String
 *     let amountCents: Int  // Positive amount
 *     let date: String
 *     let description: String?
 *     let notes: String?
 * }
 * ```
 */
export interface CreateTransferDTO {
  /** Source account (money goes OUT) */
  readonly fromAccountId: string;

  /** Destination account (money goes IN) */
  readonly toAccountId: string;

  /**
   * Amount in INTEGER CENTS (always positive)
   *
   * RPC function will:
   * - Create OUT transaction with -amountCents
   * - Create IN transaction with +amountCents
   */
  readonly amountCents: number;

  /** Transfer date (YYYY-MM-DDTHH:mm:ss.SSSZ) */
  readonly date: string;

  /** Transfer description (applied to both transactions) */
  readonly description?: string | null;

  /** Transfer notes (applied to both transactions) */
  readonly notes?: string | null;
}

/**
 * Transfer Result
 *
 * Response from atomic transfer creation.
 * Contains IDs for both created transactions.
 */
export interface TransferResult {
  /** Transfer ID (links the two transactions) */
  readonly transferId: string;

  /** OUT transaction ID (from source account) */
  readonly outTransactionId: string;

  /** IN transaction ID (to destination account) */
  readonly inTransactionId: string;

  /** OUT transaction (full entity with joined data) */
  readonly outTransaction: TransactionViewEntity;

  /** IN transaction (full entity with joined data) */
  readonly inTransaction: TransactionViewEntity;
}

/**
 * Transaction Filters
 *
 * Query filters for fetching transactions.
 * Used by repository's getAllPaginated() method.
 *
 * Swift Mirror:
 * ```swift
 * struct TransactionFilters: Codable {
 *     let accountId: String?
 *     let categoryId: String?
 *     let startDate: String?
 *     let endDate: String?
 *     let minAmountCents: Int?
 *     let maxAmountCents: Int?
 *     let searchQuery: String?
 *     let cleared: Bool?
 *     let transferId: String?
 *     let reconciliationId: String?
 * }
 * ```
 */
export interface TransactionFilters {
  /** Filter by account ID */
  readonly accountId?: string;

  /** Filter by single category ID */
  readonly categoryId?: string;

  /** Filter by multiple category IDs (for grouping/aggregation) */
  readonly categoryIds?: string[];

  /** Filter by date range (start) - ISO 8601 */
  readonly startDate?: string;

  /** Filter by date range (end) - ISO 8601 */
  readonly endDate?: string;

  /** Filter by minimum amount (integer cents) */
  readonly minAmountCents?: number;

  /** Filter by maximum amount (integer cents) */
  readonly maxAmountCents?: number;

  /** Search query (matches description or notes) */
  readonly searchQuery?: string;

  /** Filter by exact date (ISO 8601) */
  readonly date?: Date | string;

  /** Sort order */
  readonly sortBy?: 'date' | 'created_at';

  /** Filter by cleared status (for reconciliation) */
  readonly cleared?: boolean;

  /** Filter by transfer ID (find paired transactions) */
  readonly transferId?: string;

  /** Filter by reconciliation ID */
  readonly reconciliationId?: string;

  /** Include soft-deleted transactions (for sync) */
  readonly includeDeleted?: boolean;
}

/**
 * Pagination Options
 *
 * Offset/limit pagination for queries.
 *
 * Swift Mirror:
 * ```swift
 * struct PaginationOptions: Codable {
 *     let offset: Int
 *     let limit: Int
 * }
 * ```
 */
export interface PaginationOptions {
  /** Number of records to skip */
  readonly offset: number;

  /** Maximum number of records to return */
  readonly limit: number;
}

/**
 * Paginated Result
 *
 * Generic paginated response.
 *
 * Swift Mirror:
 * ```swift
 * struct PaginatedResult<T: Codable>: Codable {
 *     let data: [T]
 *     let total: Int
 *     let offset: Int
 *     let limit: Int
 *     let hasMore: Bool
 * }
 * ```
 */
export interface PaginatedResult<T> {
  /** Array of items for current page */
  readonly data: T[];

  /** Total number of items (across all pages) */
  readonly total: number;

  /** Current offset */
  readonly offset: number;

  /** Current limit */
  readonly limit: number;

  /** Whether there are more pages available */
  readonly hasMore: boolean;
}

/**
 * Sync Response (Version-Based Delta Sync)
 *
 * CTO Mandate #2: Version-Based Sync (NOT Timestamps)
 *
 * Problem: Timestamp-based sync is vulnerable to clock drift
 * Solution: Use global monotonic version counter
 *
 * How it works:
 * 1. Client stores last sync version: localStorage.setItem('lastSyncVersion', '12345')
 * 2. Client requests changes: getChangesSince(userId, 12345)
 * 3. Server returns: all transactions where version > 12345 + currentServerVersion
 * 4. Client updates: localStorage.setItem('lastSyncVersion', currentServerVersion)
 *
 * Benefits:
 * - Clock-independent (works even if device clock is wrong)
 * - Deterministic (same version always returns same data)
 * - Gap-proof (missing version ranges are impossible)
 *
 * Swift Mirror:
 * ```swift
 * struct SyncResponse<T: Codable>: Codable {
 *     let data: T
 *     let currentServerVersion: Int
 *     let hasMore: Bool
 * }
 * ```
 */
export interface SyncResponse<T> {
  /** Response data (transactions, accounts, etc.) */
  readonly data: T;

  /**
   * Current server version (monotonic counter)
   *
   * CRITICAL: Client MUST store this value for next sync
   * - Web: localStorage.setItem('lastSyncVersion', currentServerVersion)
   * - iOS: UserDefaults.standard.set(currentServerVersion, forKey: "lastSyncVersion")
   */
  readonly currentServerVersion: number;

  /** Whether there are more changes available (for pagination) */
  readonly hasMore: boolean;
}

/**
 * Transaction Changes (Delta Sync Result)
 *
 * Response from getChangesSince() - contains all changes since version.
 *
 * Swift Mirror:
 * ```swift
 * struct TransactionChanges: Codable {
 *     let created: [TransactionViewEntity]
 *     let updated: [TransactionViewEntity]
 *     let deleted: [TransactionViewEntity]
 * }
 * ```
 */
export interface TransactionChanges {
  /** Newly created transactions (version > lastSyncVersion) */
  readonly created: TransactionViewEntity[];

  /** Updated transactions (version > lastSyncVersion) */
  readonly updated: TransactionViewEntity[];

  /**
   * Deleted transactions (soft-deleted, version > lastSyncVersion)
   *
   * TOMBSTONE PATTERN: These records have deletedAt set
   * Client should remove them from local cache
   */
  readonly deleted: TransactionViewEntity[];
}

/**
 * Category Counts Result
 *
 * Aggregated counts by category.
 * Used for analytics and charts.
 */
export interface CategoryCounts {
  [categoryId: string]: number;
}
