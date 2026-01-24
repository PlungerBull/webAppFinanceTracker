/**
 * Inbox Domain Types
 *
 * Data Transfer Objects (DTOs) and Result types for inbox repository operations.
 *
 * CTO MANDATES INCORPORATED:
 * 1. DataResult<T> Pattern - Swift-compatible explicit error handling
 * 2. Integer Cents DTOs - All amounts are integers (never decimals)
 *
 * @module inbox-types
 */

import type { InboxItemEntity, InboxItemViewEntity } from './entities';

// Import shared types from data-patterns module
import type {
  DataResult as SharedDataResult,
  PaginatedResult as SharedPaginatedResult,
  PaginationOptions as SharedPaginationOptions,
  SerializableError,
} from '@/lib/data-patterns';

// Re-export shared types for convenience
export type { SharedPaginationOptions as PaginationOptions };
export type { SharedPaginatedResult as PaginatedResult };

/**
 * Inbox-specific error
 *
 * Swift Mirror:
 * ```swift
 * struct InboxError: Codable, Error {
 *     let code: String
 *     let message: String
 * }
 * ```
 */
export interface InboxError extends SerializableError {
  readonly code:
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'REPOSITORY_ERROR'
  | 'PROMOTION_FAILED'
  | 'ALREADY_PROCESSED'
  | 'VERSION_CONFLICT';
}

/**
 * Inbox-specific DataResult
 *
 * Uses InboxError for the error type.
 */
export type DataResult<T> = SharedDataResult<T, InboxError>;

/**
 * Create Inbox Item DTO
 *
 * Input for creating a new inbox item (scratchpad mode).
 * ALL FIELDS ARE OPTIONAL - supports partial data entry.
 *
 * CRITICAL: amountCents is INTEGER CENTS (CTO Mandate)
 * - $10.50 = 1050 cents (NOT 10.5)
 *
 * Swift Mirror:
 * ```swift
 * struct CreateInboxItemDTO: Codable {
 *     let amountCents: Int?
 *     let description: String?
 *     let date: String?
 *     let sourceText: String?
 *     let accountId: String?
 *     let categoryId: String?
 *     let notes: String?
 * }
 * ```
 */
export interface CreateInboxItemDTO {
  readonly amountCents?: number | null;
  readonly description?: string | null;
  readonly date?: string | null;
  readonly sourceText?: string | null;
  readonly accountId?: string | null;
  readonly categoryId?: string | null;
  readonly notes?: string | null;
}

/**
 * Update Inbox Item DTO
 *
 * Input for updating a draft inbox item.
 * Supports partial updates (only specified fields change).
 *
 * PARTIAL UPDATE SEMANTICS (CTO Mandate):
 * - Field absent (undefined): Don't update this field
 * - Field present as null: Clear this field (set to NULL in DB)
 * - Field present with value: Update to this value
 *
 * NOTE: The UI layer (EditedFields) uses triple semantics, but the component
 * MUST flatten these before passing to the service layer. The repository
 * should never receive "user hasn't touched this" - only "update" or "skip".
 *
 * Swift Mirror (uses Optional chaining for partial updates):
 * ```swift
 * struct UpdateInboxItemDTO: Codable {
 *     let amountCents: Int??      // nil = skip, .some(nil) = clear, .some(value) = update
 *     let description: String??
 *     let date: String??
 *     let accountId: String??
 *     let categoryId: String??
 *     let exchangeRate: Decimal??
 *     let notes: String??
 * }
 * ```
 */
export interface UpdateInboxItemDTO {
  readonly amountCents?: number | null;
  readonly description?: string | null;
  readonly date?: string | null;
  readonly accountId?: string | null;
  readonly categoryId?: string | null;
  readonly exchangeRate?: number | null;
  readonly notes?: string | null;
  /**
   * Optimistic Concurrency Control
   * The version of the item when it was read
   */
  readonly lastKnownVersion?: number;
}

/**
 * Promote Inbox Item DTO
 *
 * Input for promoting an inbox item to the ledger.
 * All required fields must be provided.
 *
 * Swift Mirror:
 * ```swift
 * struct PromoteInboxItemDTO: Codable {
 *     let inboxId: String
 *     let accountId: String
 *     let categoryId: String
 *     let finalDescription: String?
 *     let finalDate: String?
 *     let finalAmountCents: Int?
 *     let exchangeRate: Decimal?
 * }
 * ```
 */
export interface PromoteInboxItemDTO {
  readonly inboxId: string;
  readonly accountId: string;
  readonly categoryId: string;
  readonly finalDescription?: string | null;
  readonly finalDate?: string | null;
  readonly finalAmountCents?: number | null;
  readonly exchangeRate?: number | null;
  /**
   * Optimistic Concurrency Control
   * The version of the item when it was read
   */
  readonly lastKnownVersion?: number;
}

/**
 * Promote Result
 *
 * Response from promoting an inbox item.
 * Contains the created transaction ID.
 */
export interface PromoteResult {
  readonly transactionId: string;
  readonly inboxId: string;
}

/**
 * Inbox Query Filters
 *
 * Query filters for fetching inbox items.
 */
export interface InboxFilters {
  readonly status?: 'pending' | 'processed' | 'ignored';
  readonly accountId?: string;
  readonly categoryId?: string;
}

// Re-export entity types for convenience
export type { InboxItemEntity, InboxItemViewEntity };
