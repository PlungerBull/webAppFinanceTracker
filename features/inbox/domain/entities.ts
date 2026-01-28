/**
 * Inbox Domain Entities
 *
 * Domain entities for the Transaction Inbox feature.
 * The Inbox is a "staging area" for incomplete financial data.
 *
 * CTO MANDATES:
 * - Integer cents for all monetary amounts (amountCents)
 * - DataResult pattern for explicit error handling
 * - Swift-serializable structures
 *
 * @module inbox-entities
 */

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
  readonly status: 'pending' | 'processed' | 'ignored';

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
