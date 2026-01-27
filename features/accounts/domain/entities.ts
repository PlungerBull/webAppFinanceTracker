/**
 * Account Domain Entities
 *
 * Core entity types for the accounts feature.
 *
 * CTO MANDATES:
 * - currentBalanceCents: INTEGER CENTS (not decimal)
 * - currencyCode: exposed directly on AccountEntity
 * - All dates are ISO 8601 strings
 *
 * @module account-entities
 */

/**
 * Account type enum
 */
export type AccountType =
  | 'checking'
  | 'savings'
  | 'credit_card'
  | 'investment'
  | 'loan'
  | 'cash'
  | 'other';

/**
 * Account Entity (Base)
 *
 * Core account data from bank_accounts table.
 * Each account has ONE currency and belongs to a group.
 *
 * Swift Mirror:
 * ```swift
 * struct AccountEntity: Codable, Identifiable {
 *     let id: String
 *     let version: Int
 *     let userId: String
 *     let groupId: String
 *     let name: String
 *     let type: AccountType
 *     let currencyCode: String
 *     let color: String
 *     let currentBalanceCents: Int  // INTEGER CENTS
 *     let isVisible: Bool
 *     let createdAt: String
 *     let updatedAt: String
 *     let deletedAt: String?
 * }
 * ```
 */
export interface AccountEntity {
  /** Primary key (UUID) */
  readonly id: string;

  /** Version for optimistic concurrency control */
  readonly version: number;

  /** Owner user ID (foreign key) */
  readonly userId: string;

  /** Group ID - accounts with same groupId are displayed together */
  readonly groupId: string;

  /** Account name (e.g., "Main Checking", "BCP Credit Card") */
  readonly name: string;

  /** Account type */
  readonly type: AccountType;

  /** Currency code (e.g., "USD", "EUR", "PEN") */
  readonly currencyCode: string;

  /** Hex color code for visual identification (e.g., "#3b82f6") */
  readonly color: string;

  /**
   * Current balance in INTEGER CENTS
   *
   * SACRED INTEGER ARITHMETIC (CTO Mandate):
   * - $10.50 = 1050 (NOT 10.5)
   * - $0.01 = 1
   * - $100.00 = 10000
   */
  readonly currentBalanceCents: number;

  /** Whether account is visible in UI */
  readonly isVisible: boolean;

  /** Creation timestamp (ISO 8601) */
  readonly createdAt: string;

  /** Last update timestamp (ISO 8601) */
  readonly updatedAt: string;

  /** Soft delete timestamp (ISO 8601, null if not deleted) */
  readonly deletedAt: string | null;
}

/**
 * Account View Entity (Enriched)
 *
 * Extends AccountEntity with joined display data.
 * Used for UI rendering where currency symbol is needed.
 *
 * Swift Mirror:
 * ```swift
 * struct AccountViewEntity: Codable, Identifiable {
 *     // ... all AccountEntity fields
 *     let currencySymbol: String  // Joined from global_currencies
 * }
 * ```
 */
export interface AccountViewEntity extends AccountEntity {
  /** Currency symbol from global_currencies (e.g., "$", "S/", "EUR"). Null if JOIN failed. */
  readonly currencySymbol: string | null;
}

/**
 * Type guard to check if entity is AccountViewEntity
 */
export function isAccountViewEntity(
  entity: AccountEntity | AccountViewEntity
): entity is AccountViewEntity {
  return 'currencySymbol' in entity;
}

/**
 * Type guard to check if account is soft-deleted
 */
export function isDeletedAccount(account: AccountEntity): boolean {
  return account.deletedAt !== null;
}
