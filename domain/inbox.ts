/**
 * Inbox Domain Entities
 *
 * Shared inbox types for cross-feature use.
 * This is the "Sacred Domain" - any feature can import from here.
 *
 * The Inbox is a "staging area" for incomplete financial data.
 *
 * CTO MANDATES:
 * - Integer cents for all monetary amounts (amountCents)
 * - DataResult pattern for explicit error handling
 * - Swift-serializable structures
 *
 * @module domain/inbox
 */

import type { DataResult, SerializableError } from '@/lib/data-patterns/types';

/**
 * Inbox Item Status
 */
export type InboxStatus = 'pending' | 'processed' | 'ignored';

/**
 * Inbox Item Entity
 *
 * Represents a "dirty" transaction that needs user review before entering the ledger.
 * All optional fields use null (not undefined) for iOS Swift compatibility.
 *
 * Swift Mirror:
 * ```swift
 * struct InboxItemEntity: Codable {
 *     let id: String
 *     let userId: String
 *     let amountCents: Int?         // INTEGER CENTS!
 *     let currencyCode: String?     // Derived from account
 *     let description: String?
 *     let date: String?
 *     let accountId: String?
 *     let categoryId: String?
 *     let notes: String?
 *     let status: InboxStatus
 *     let createdAt: String
 *     let updatedAt: String
 * }
 * ```
 */
export interface InboxItemEntity {
  /** Unique identifier */
  readonly id: string;

  /** User ID (for RLS) */
  readonly userId: string;

  /**
   * Amount in INTEGER CENTS (positive or negative)
   * Null when item is a pure draft without amount
   */
  readonly amountCents: number | null;

  /**
   * Currency code derived from account (e.g., "USD", "PEN")
   * Null when no account is assigned yet
   */
  readonly currencyCode: string | null;

  /** Transaction description */
  readonly description: string | null;

  /** Transaction date (ISO 8601) */
  readonly date: string | null;

  /** Original source text (from import/parse) */
  readonly sourceText: string | null;

  /** Assigned account ID */
  readonly accountId: string | null;

  /** Assigned category ID */
  readonly categoryId: string | null;

  /** Exchange rate (for cross-currency) */
  readonly exchangeRate: number | null;

  /** User notes during scratchpad phase */
  readonly notes: string | null;

  /** Item status */
  readonly status: InboxStatus;

  /** Created timestamp (ISO 8601) */
  readonly createdAt: string;

  /** Updated timestamp (ISO 8601) */
  readonly updatedAt: string;

  /**
   * Sync Version (Optimistic Concurrency Control)
   * Uses global_transaction_version sequence
   */
  readonly version: number;

  /**
   * Soft Delete Timestamp (Tombstone Pattern)
   * Null = Active, Date = Deleted
   */
  readonly deletedAt: string | null;
}

/**
 * Inbox Item View Entity
 *
 * Extended entity with joined account and category data.
 * Used for UI display.
 */
export interface InboxItemViewEntity extends InboxItemEntity {
  /** Joined account data */
  readonly account?: {
    readonly id: string;
    readonly name: string | null;
    readonly currencyCode: string | null;
    readonly currencySymbol: string | null;
  };

  /** Joined category data */
  readonly category?: {
    readonly id: string;
    readonly name: string | null;
    readonly color: string | null;
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if an inbox item is ready for promotion
 */
export function isPromotionReady(
  item: InboxItemEntity
): item is InboxItemEntity & {
  amountCents: number;
  accountId: string;
  categoryId: string;
} {
  return (
    item.amountCents !== null &&
    item.accountId !== null &&
    item.categoryId !== null
  );
}

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

/**
 * DTO for creating an inbox item
 */
export interface CreateInboxItemDTO {
  amountCents?: number | null;
  description?: string | null;
  date?: string | null;
  sourceText?: string | null;
  accountId?: string | null;
  categoryId?: string | null;
  exchangeRate?: number | null;
  notes?: string | null;
}

/**
 * DTO for updating an inbox item
 */
export interface UpdateInboxItemDTO {
  amountCents?: number | null;
  description?: string | null;
  date?: string | null;
  accountId?: string | null;
  categoryId?: string | null;
  exchangeRate?: number | null;
  notes?: string | null;
  status?: InboxStatus;
  /** Optimistic Concurrency Control version */
  lastKnownVersion?: number;
}

/**
 * DTO for promoting an inbox item to a transaction
 *
 * Uses "final" prefix for fields that may override inbox values
 */
export interface PromoteInboxItemDTO {
  readonly inboxId: string;
  readonly accountId: string;
  readonly categoryId: string;
  readonly finalDescription?: string | null;
  readonly finalDate?: string | null;
  readonly finalAmountCents?: number | null;
  readonly exchangeRate?: number | null;
  /** Optimistic Concurrency Control */
  readonly lastKnownVersion?: number;
}

/**
 * Result of promoting an inbox item
 */
export interface PromoteResult {
  readonly transactionId: string;
  readonly inboxId: string;
}

// ============================================================================
// INVERSION OF CONTROL INTERFACE
// ============================================================================

/**
 * Interface for inbox operations - Inversion of Control.
 *
 * Features depend on this interface, not concrete InboxService.
 * This allows the transactions feature to interact with inbox
 * without directly importing from the inbox feature.
 *
 * Usage:
 * - Define operations needed by other features
 * - Implement adapter at app level that wraps InboxService
 */
export interface IInboxOperations {
  /**
   * Create a new inbox item
   */
  create(data: CreateInboxItemDTO): Promise<DataResult<InboxItemViewEntity, SerializableError>>;

  /**
   * Update an existing inbox item
   */
  update(
    id: string,
    data: UpdateInboxItemDTO
  ): Promise<DataResult<InboxItemViewEntity, SerializableError>>;

  /**
   * Promote an inbox item to a full transaction
   */
  promote(data: PromoteInboxItemDTO): Promise<DataResult<PromoteResult, SerializableError>>;
}
