/**
 * Transaction Domain Entities
 *
 * Platform-agnostic domain entities that mirror Swift Codable structs.
 *
 * CTO MANDATES INCORPORATED:
 * 1. Soft Deletes (deletedAt field) - Tombstone pattern for offline sync
 * 2. Version-Based Sync (global version counter) - Clock-independent
 * 3. Sacred Integer Arithmetic (amountCents) - Prevents floating-point drift
 *
 * Key Principles:
 * - All dates are UTC ISO strings (cross-platform compatible)
 * - readonly properties (immutability)
 * - Explicit typing (no `any`)
 * - 1:1 mapping to Swift structs
 * - Integer cents only (NO decimals for amounts)
 *
 * @module transaction-entities
 */

/**
 * Transaction Entity (Base)
 *
 * Core transaction data without joined account/category information.
 * This is the "raw" transaction as stored in the database.
 *
 * CRITICAL: All amounts are INTEGER CENTS
 * - $10.50 = 1050 cents (NOT 10.5)
 * - $0.01 = 1 cent
 * - $100.00 = 10000 cents
 *
 * Why Integer Cents?
 * - Prevents floating-point drift (0.1 + 0.2 !== 0.3)
 * - Cross-platform deterministic (TypeScript + Swift produce identical results)
 * - Database alignment (PostgreSQL NUMERIC stored as exact integer internally)
 * - Balance integrity (running balance never drifts)
 *
 * Swift Mirror:
 * ```swift
 * struct TransactionEntity: Codable, Identifiable {
 *     let id: String
 *     let version: Int
 *     let userId: String
 *     let amountCents: Int  // ← Int, NEVER Double
 *     let amountHomeCents: Int
 *     let currencyOriginal: String
 *     let exchangeRate: Decimal
 *     let accountId: String
 *     let categoryId: String?
 *     let transferId: String?
 *     let description: String?
 *     let notes: String?
 *     let date: String  // ISO 8601
 *     let createdAt: String
 *     let updatedAt: String
 *     let deletedAt: String?
 *     let reconciliationId: String?
 *     let cleared: Bool
 * }
 * ```
 */
export interface TransactionEntity {
  /**
   * Transaction ID (UUID v4)
   * Generated client-side for optimistic updates
   */
  readonly id: string;

  /**
   * Global monotonic version number for optimistic concurrency control
   *
   * CTO Mandate #2: Version-Based Sync
   * - Global sequence, NOT per-record counter
   * - Incremented on every INSERT/UPDATE
   * - Used for delta sync (WHERE version > last_seen_version)
   * - Clock-independent (prevents drift issues)
   */
  readonly version: number;

  /**
   * User ID (owner of this transaction)
   * UUID from auth provider (Supabase Auth or Apple Sign-In)
   */
  readonly userId: string;

  /**
   * Amount in INTEGER CENTS (original currency)
   *
   * CTO Mandate #3: Sacred Integer Arithmetic
   * - $10.50 = 1050 (NOT 10.5)
   * - $0.01 = 1
   * - $100.00 = 10000
   *
   * Conversion:
   * - Dollars to cents: Math.round(dollars * 100)
   * - Cents to dollars: cents / 100
   */
  readonly amountCents: number;

  /**
   * Amount in INTEGER CENTS (home currency)
   *
   * Converted using exchangeRate:
   * amountHomeCents = amountCents * exchangeRate
   *
   * Example: $10.50 USD (1050 cents) at rate 1.35 CAD/USD
   * = 1050 * 1.35 = 1417.5 → 1418 cents CAD ($14.18)
   */
  readonly amountHomeCents: number;

  /**
   * Original currency code (ISO 4217)
   *
   * Derived from account's currency_code (Sacred Ledger pattern)
   * Examples: "USD", "EUR", "GBP", "JPY"
   */
  readonly currencyOriginal: string;

  /**
   * Exchange rate for currency conversion
   *
   * Rate from original currency to home currency
   * - 1.0 = same currency (no conversion)
   * - 1.35 = 1 USD = 1.35 CAD
   *
   * Note: This is a DECIMAL (not integer) - only used for conversion formula
   */
  readonly exchangeRate: number;

  /**
   * Account ID (foreign key)
   * Required - every transaction belongs to an account
   */
  readonly accountId: string;

  /**
   * Category ID (foreign key)
   * Optional - uncategorized transactions have null
   */
  readonly categoryId: string | null;

  /**
   * Transfer ID (links paired transactions)
   *
   * When moving money between accounts:
   * - OUT transaction: transfer_id = "abc123"
   * - IN transaction: transfer_id = "abc123"
   *
   * CTO Mandate #1: Atomic Transfer Protocol
   * - Both transactions created in single RPC call
   * - All-or-nothing atomicity
   */
  readonly transferId: string | null;

  /**
   * Transaction description (user-facing)
   * Max length: 255 characters
   */
  readonly description: string | null;

  /**
   * Additional notes (user-facing)
   * Max length: 1000 characters
   */
  readonly notes: string | null;

  /**
   * Transaction date (when it occurred)
   *
   * Format: YYYY-MM-DDTHH:mm:ss.SSSZ (strict ISO 8601)
   * Example: "2024-01-12T10:30:00.123Z"
   *
   * CTO Mandate #4: Strict ISO 8601 Date Enforcement
   * - Always UTC (Z suffix)
   * - Always includes milliseconds (.SSS)
   * - Prevents Swift ISO8601DateFormatter crashes
   */
  readonly date: string;

  /**
   * Created timestamp (UTC ISO 8601)
   * Set by database on INSERT
   */
  readonly createdAt: string;

  /**
   * Updated timestamp (UTC ISO 8601)
   * Set by database on INSERT/UPDATE
   */
  readonly updatedAt: string;

  /**
   * Soft delete timestamp (UTC ISO 8601)
   *
   * CTO Mandate #1: Soft Deletes (Tombstone Pattern)
   * - NULL = not deleted (visible)
   * - ISO timestamp = deleted at this time (tombstone)
   *
   * Why soft deletes?
   * - Offline sync: iOS app needs to know what was deleted
   * - Audit trail: Can see when transaction was deleted
   * - Restore capability: Can undo deletes
   * - Conflict resolution: Can detect delete vs edit conflicts
   */
  readonly deletedAt: string | null;

  /**
   * Reconciliation ID (for audit workspace)
   * Links transaction to a reconciliation session
   */
  readonly reconciliationId: string | null;

  /**
   * Cleared flag (for reconciliation)
   * true = transaction has been reconciled
   * false = pending reconciliation
   */
  readonly cleared: boolean;

  /**
   * Source text (for inbox items)
   * Original text that generated this transaction (if from inbox)
   */
  readonly sourceText?: string | null;

  /**
   * Inbox ID (for inbox items)
   * Links to original inbox item that created this transaction
   */
  readonly inboxId?: string | null;
}

/**
 * Transaction View Entity (Enriched)
 *
 * Transaction data WITH joined account and category information.
 * This is the "read model" for display purposes.
 *
 * Differences from TransactionEntity:
 * - Includes account name, color, currency
 * - Includes category name, color, type
 * - Includes reconciliation status
 *
 * Why separate types?
 * - TransactionEntity: Write operations (create, update)
 * - TransactionViewEntity: Read operations (display, list)
 *
 * Swift Mirror:
 * ```swift
 * struct TransactionViewEntity: Codable, Identifiable {
 *     // All fields from TransactionEntity
 *     let id: String
 *     let version: Int
 *     let userId: String
 *     let amountCents: Int
 *     let amountHomeCents: Int
 *     let currencyOriginal: String
 *     let exchangeRate: Decimal
 *     let accountId: String
 *     let categoryId: String?
 *     let transferId: String?
 *     let description: String?
 *     let notes: String?
 *     let date: String
 *     let createdAt: String
 *     let updatedAt: String
 *     let deletedAt: String?
 *     let reconciliationId: String?
 *     let cleared: Bool
 *
 *     // Joined fields
 *     let accountName: String
 *     let accountCurrency: String
 *     let accountColor: String?
 *     let categoryName: String?
 *     let categoryColor: String?
 *     let categoryType: String?
 *     let reconciliationStatus: String?
 * }
 * ```
 */
export interface TransactionViewEntity extends TransactionEntity {
  /**
   * Account name (from bank_accounts table)
   * Example: "Chase Checking", "Savings Account"
   */
  readonly accountName: string;

  /**
   * Account currency code (from bank_accounts table)
   * Same as currencyOriginal - included for convenience
   */
  readonly accountCurrency: string;

  /**
   * Account color (from bank_accounts table)
   * Hex color for UI display
   * Example: "#FF5733"
   */
  readonly accountColor: string | null;

  /**
   * Category name (from categories table)
   * Example: "Groceries", "Rent", "Salary"
   */
  readonly categoryName: string | null;

  /**
   * Category color (from categories table)
   * Hex color for UI display
   */
  readonly categoryColor: string | null;

  /**
   * Category type (from categories table)
   * - "income": Positive cash flow
   * - "expense": Negative cash flow
   * - "opening_balance": Initial account balance
   */
  readonly categoryType: 'income' | 'expense' | 'opening_balance' | null;

  /**
   * Reconciliation status (from reconciliations table)
   * - "draft": In progress
   * - "completed": Finalized
   * - null: Not part of reconciliation
   */
  readonly reconciliationStatus: 'draft' | 'completed' | null;
}

/**
 * Type guard to check if entity is a view entity
 */
export function isTransactionViewEntity(
  entity: TransactionEntity | TransactionViewEntity
): entity is TransactionViewEntity {
  return 'accountName' in entity;
}

/**
 * Type guard to check if transaction is deleted
 */
export function isDeletedTransaction(
  transaction: TransactionEntity
): boolean {
  return transaction.deletedAt !== null;
}

/**
 * Type guard to check if transaction is a transfer
 */
export function isTransferTransaction(
  transaction: TransactionEntity
): boolean {
  return transaction.transferId !== null;
}

/**
 * Type guard to check if transaction is reconciled
 */
export function isReconciledTransaction(
  transaction: TransactionEntity
): boolean {
  return transaction.cleared;
}
