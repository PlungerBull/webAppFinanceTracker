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
import type { TransactionViewEntity } from './entities';
import type { InboxItemViewEntity } from '@/features/inbox/domain/entities';

// Import shared types from data-patterns module
import type {
  DataResult as SharedDataResult,
  PaginatedResult as SharedPaginatedResult,
  PaginationOptions as SharedPaginationOptions,
  SyncResponse as SharedSyncResponse,
} from '@/lib/data-patterns';

// Re-export shared types for backwards compatibility
export type { SharedPaginationOptions as PaginationOptions };
export type { SharedPaginatedResult as PaginatedResult };
export type { SharedSyncResponse as SyncResponse };

/**
 * Transaction-specific DataResult
 *
 * Uses TransactionError for the error type.
 * See @/lib/data-patterns for the base DataResult documentation.
 */
export type DataResult<T> = SharedDataResult<T, TransactionError>;

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
 *     let sentAmountCents: Int     // Positive amount leaving source
 *     let receivedAmountCents: Int // Positive amount entering destination
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
   * Amount SENT in INTEGER CENTS (always positive)
   * This is the amount leaving the source account.
   */
  readonly sentAmountCents: number;

  /**
   * Amount RECEIVED in INTEGER CENTS (always positive)
   * This is the amount entering the destination account.
   *
   * For same-currency transfers: receivedAmountCents === sentAmountCents
   * For cross-currency transfers: may differ based on exchange rate
   *
   * The implied exchange rate is calculated as:
   * receivedAmountCents / sentAmountCents
   */
  readonly receivedAmountCents: number;

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

// NOTE: PaginationOptions, PaginatedResult, and SyncResponse are now
// imported from @/lib/data-patterns and re-exported at the top of this file.
// See the shared module for full documentation.

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

// ============================================================================
// TRANSACTION ROUTING TYPES (Smart Routing Decision Engine)
// ============================================================================

/**
 * Transaction Route Destination
 *
 * Determines where transaction data should be stored:
 * - 'ledger': Complete data → transactions table (Sacred Ledger)
 * - 'inbox': Partial data → transaction_inbox table (Scratchpad)
 */
export type TransactionRoute = 'ledger' | 'inbox';

/**
 * Required field keys for routing decision
 *
 * These are the 4 fields that must ALL be present for ledger routing.
 * Used by RoutingDecision.missingFields for UI highlighting.
 */
export type TransactionRequiredField = 'amountCents' | 'description' | 'accountId' | 'categoryId';

/**
 * Transaction Route Input DTO
 *
 * Clean data contract for the routing service.
 * NEVER pass raw React-Hook-Form objects - convert at component boundary.
 *
 * SACRED RULE (AI_CONTEXT.md Section F):
 * - amountCents: 0 is treated as MISSING (prevents balance bugs)
 * - amountCents: null is treated as MISSING
 * - Empty string description is treated as MISSING
 *
 * Swift Mirror:
 * ```swift
 * struct TransactionRouteInputDTO: Codable {
 *     let amountCents: Int?        // CRITICAL: 0 == nil (MISSING)
 *     let description: String?
 *     let accountId: String?
 *     let categoryId: String?
 *     let date: String             // ISO 8601
 *     let notes: String?
 *     let exchangeRate: Double?
 * }
 * ```
 */
export interface TransactionRouteInputDTO {
  /**
   * Amount in INTEGER CENTS
   *
   * SACRED RULE: Both 0 and null are treated as MISSING
   * - null → MISSING (no amount entered)
   * - 0 → MISSING (prevents $0.00 ledger entries that break balance math)
   * - -100 → VALID expense ($1.00 debit)
   * - 100 → VALID income ($1.00 credit)
   */
  readonly amountCents: number | null;

  /**
   * Transaction description (payee)
   *
   * Empty string or whitespace-only is treated as MISSING.
   */
  readonly description: string | null;

  /**
   * Account ID (UUID)
   *
   * null means no account selected.
   */
  readonly accountId: string | null;

  /**
   * Category ID (UUID)
   *
   * null means no category selected.
   */
  readonly categoryId: string | null;

  /**
   * Transaction date (ISO 8601 format)
   *
   * Format: YYYY-MM-DDTHH:mm:ss.SSSZ
   * Always required (defaults to current date in UI).
   */
  readonly date: string;

  /**
   * Additional notes (optional)
   */
  readonly notes?: string | null;

  /**
   * Exchange rate (optional)
   *
   * Required when account currency differs from main currency.
   */
  readonly exchangeRate?: number | null;
}

/**
 * Routing Decision
 *
 * Result from determineRoute() pure function.
 * Includes specific missing fields for UI highlighting.
 *
 * Swift Mirror:
 * ```swift
 * struct RoutingDecision {
 *     let route: TransactionRoute
 *     let isComplete: Bool
 *     let hasAnyData: Bool
 *     let missingFields: [String]  // Exact keys for UI highlighting
 * }
 * ```
 */
export interface RoutingDecision {
  /**
   * Destination: 'ledger' (complete) or 'inbox' (partial)
   */
  readonly route: TransactionRoute;

  /**
   * True if all 4 required fields are present
   *
   * All of these must be true:
   * - amountCents is non-null AND non-zero
   * - description is non-null AND non-empty
   * - accountId is non-null AND non-empty
   * - categoryId is non-null AND non-empty
   */
  readonly isComplete: boolean;

  /**
   * True if at least one field has data
   *
   * Used to determine if form can be submitted at all.
   */
  readonly hasAnyData: boolean;

  /**
   * List of missing required field keys
   *
   * Empty array when isComplete is true.
   * UI uses this to highlight which fields are preventing ledger routing.
   */
  readonly missingFields: TransactionRequiredField[];
}

/**
 * Submission Result
 *
 * Result from submitTransaction() - includes route AND entity for cache update.
 *
 * CTO MANDATE: Return entity for optimistic cache prepend (Zero-Latency UX).
 * UI uses result.entity to immediately prepend to list without waiting for refetch.
 *
 * Swift Mirror:
 * ```swift
 * struct SubmissionResult {
 *     let route: TransactionRoute
 *     let id: String
 *     let success: Bool
 *     let entity: TransactionViewEntity? // For optimistic UI
 * }
 * ```
 */
export interface SubmissionResult {
  /**
   * Where the data was stored: 'ledger' or 'inbox'
   *
   * Critical for Zero-Latency UX: UI uses this to determine
   * which cache to update (transactions vs inbox).
   */
  readonly route: TransactionRoute;

  /**
   * ID of the created record
   *
   * Transaction ID (if ledger) or Inbox Item ID (if inbox).
   */
  readonly id: string;

  /**
   * True if submission succeeded
   */
  readonly success: boolean;

  /**
   * Created entity for optimistic cache prepend
   *
   * CTO MANDATE: Required for Zero-Latency UX.
   * - For 'ledger': TransactionViewEntity (with joined account/category data)
   * - For 'inbox': InboxItemViewEntity
   *
   * UI prepends this to cache immediately instead of waiting for refetch.
   */
  readonly entity: TransactionViewEntity | InboxItemViewEntity;
}

/**
 * Update Route Input DTO
 *
 * Input for updating an existing transaction/inbox item with routing.
 * Extends TransactionRouteInputDTO with ID and version for updates.
 *
 * CTO MANDATE: Version field required for conflict resolution.
 * Prevents overwriting remote changes during multi-device sync.
 *
 * Swift Mirror:
 * ```swift
 * struct UpdateRouteInputDTO: Codable {
 *     let id: String
 *     let version: Int
 *     let sourceRoute: TransactionRoute  // Where item currently lives
 *     // ... all fields from TransactionRouteInputDTO
 * }
 * ```
 */
export interface UpdateRouteInputDTO extends TransactionRouteInputDTO {
  /**
   * ID of the record to update
   */
  readonly id: string;

  /**
   * Version for optimistic concurrency control
   *
   * CTO MANDATE: Required for conflict resolution.
   * Service checks: IF version = expected THEN update ELSE conflict
   */
  readonly version: number;

  /**
   * Source route: where the item currently lives
   *
   * Determines which service to call for updates:
   * - 'ledger' → TransactionService.update()
   * - 'inbox' → InboxService.update()
   *
   * Also used to detect promotion/demotion:
   * - source: 'inbox', target: 'ledger' → PROMOTION
   * - source: 'ledger', target: 'inbox' → DEMOTION
   */
  readonly sourceRoute: TransactionRoute;
}

/**
 * Update Result
 *
 * Result from updateTransaction() - includes both source and target routes.
 *
 * CTO CRITICAL - Automatic Promotion/Demotion:
 * - Editing Inbox item + filling all fields → promotes to Ledger
 * - Editing Ledger item + removing required field → demotes to Inbox
 *
 * Swift Mirror:
 * ```swift
 * struct UpdateResult {
 *     let sourceRoute: TransactionRoute  // Where item was
 *     let targetRoute: TransactionRoute  // Where item is now
 *     let id: String
 *     let success: Bool
 *     let promoted: Bool    // Inbox → Ledger
 *     let demoted: Bool     // Ledger → Inbox
 *     let entity: TransactionViewEntity | InboxItemViewEntity
 * }
 * ```
 */
export interface UpdateResult {
  /**
   * Where the item was before update
   */
  readonly sourceRoute: TransactionRoute;

  /**
   * Where the item is after update
   *
   * May differ from sourceRoute if promotion/demotion occurred.
   */
  readonly targetRoute: TransactionRoute;

  /**
   * ID of the updated record
   *
   * May change if item was promoted (inbox → ledger creates new transaction).
   */
  readonly id: string;

  /**
   * True if update succeeded
   */
  readonly success: boolean;

  /**
   * True if item was promoted (Inbox → Ledger)
   *
   * UI should:
   * - Remove from inbox cache
   * - Add to transactions cache
   * - Show "Promoted to Ledger" toast
   */
  readonly promoted: boolean;

  /**
   * True if item was demoted (Ledger → Inbox)
   *
   * CTO CRITICAL: Keeps Ledger Sacred and 100% complete.
   * UI should:
   * - Remove from transactions cache
   * - Add to inbox cache
   * - Show "Moved to Inbox" toast
   */
  readonly demoted: boolean;

  /**
   * Updated entity for optimistic cache update
   */
  readonly entity: TransactionViewEntity | InboxItemViewEntity;
}
