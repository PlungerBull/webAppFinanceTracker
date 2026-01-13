/**
 * Transaction Domain Constants
 *
 * CTO Mandate #3: Shared Validation Constants (Platform-Agnostic)
 *
 * Problem: Zod validation rules are TypeScript-only. iOS needs same constraints.
 * Solution: Extract validation rules into constants file that both platforms consume.
 *
 * Integration:
 * - Web: Zod schemas consume these constants
 * - iOS: Swift code reads from documentation or JSON export
 * - Database: CHECK constraints match these limits
 *
 * @module transaction-constants
 */

/**
 * Transaction Validation Constraints
 *
 * These constraints are enforced at multiple layers:
 * 1. Client-side (Zod schemas)
 * 2. Service layer (before repository calls)
 * 3. Database (CHECK constraints)
 *
 * Swift Mirror:
 * ```swift
 * enum TransactionValidation {
 *     static let descriptionMaxLength = 255
 *     static let notesMaxLength = 1000
 *     static let maxAmountCents = 9999999999  // $99,999,999.99
 *     static let minAmountCents = -9999999999
 *     static let dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
 * }
 * ```
 */
export const TRANSACTION_VALIDATION = {
  /** Maximum length for description field */
  DESCRIPTION_MAX_LENGTH: 255,

  /** Maximum length for notes field */
  NOTES_MAX_LENGTH: 1000,

  /**
   * Maximum amount in cents (integer)
   * $99,999,999.99 = 9,999,999,999 cents
   *
   * Why integer cents?
   * - Prevents floating-point errors (0.1 + 0.2 !== 0.3)
   * - Cross-platform consistency (TypeScript + Swift produce identical results)
   * - Database alignment (PostgreSQL NUMERIC stores as exact integer internally)
   */
  MAX_AMOUNT_CENTS: 9999999999,

  /**
   * Minimum amount in cents (integer)
   * -$99,999,999.99 = -9,999,999,999 cents
   */
  MIN_AMOUNT_CENTS: -9999999999,

  /**
   * Strict ISO 8601 date format
   * Format: YYYY-MM-DDTHH:mm:ss.SSSZ
   *
   * Why strict?
   * - Swift ISO8601DateFormatter crashes on malformed dates
   * - Prevents timezone ambiguity
   * - Cross-platform deterministic
   */
  DATE_FORMAT: 'YYYY-MM-DDTHH:mm:ss.SSSZ',

  /**
   * Exchange rate precision
   * 6 decimal places (e.g., 1.234567)
   *
   * Covers most currency conversions with sufficient precision.
   */
  EXCHANGE_RATE_PRECISION: 6,

  /**
   * Exchange rate max value
   * 1,000,000 (covers extreme currency conversions)
   */
  EXCHANGE_RATE_MAX: 1000000,

  /**
   * Exchange rate min value
   * 0.000001 (covers extreme inverse conversions)
   */
  EXCHANGE_RATE_MIN: 0.000001,
} as const;

/**
 * Transaction Error Messages
 *
 * Standardized error messages for validation failures.
 *
 * Benefits:
 * - Consistent UX across platforms
 * - Easier to localize (single source of truth)
 * - Clear debugging context
 */
export const TRANSACTION_ERRORS = {
  // Amount validation
  AMOUNT_TOO_LARGE: `Amount exceeds maximum allowed value of $${(TRANSACTION_VALIDATION.MAX_AMOUNT_CENTS / 100).toLocaleString()}`,
  AMOUNT_TOO_SMALL: `Amount below minimum allowed value of -$${Math.abs(TRANSACTION_VALIDATION.MIN_AMOUNT_CENTS / 100).toLocaleString()}`,
  AMOUNT_REQUIRED: 'Amount is required',
  AMOUNT_INVALID: 'Amount must be a valid number',

  // Description validation
  DESCRIPTION_TOO_LONG: `Description cannot exceed ${TRANSACTION_VALIDATION.DESCRIPTION_MAX_LENGTH} characters`,

  // Notes validation
  NOTES_TOO_LONG: `Notes cannot exceed ${TRANSACTION_VALIDATION.NOTES_MAX_LENGTH} characters`,

  // Date validation
  DATE_REQUIRED: 'Date is required',
  DATE_INVALID: 'Date must be a valid date',
  INVALID_DATE_FORMAT: `Date must be in format ${TRANSACTION_VALIDATION.DATE_FORMAT}`,

  // Exchange rate validation
  EXCHANGE_RATE_REQUIRED: 'Exchange rate is required',
  EXCHANGE_RATE_TOO_LARGE: `Exchange rate exceeds maximum of ${TRANSACTION_VALIDATION.EXCHANGE_RATE_MAX}`,
  EXCHANGE_RATE_TOO_SMALL: `Exchange rate below minimum of ${TRANSACTION_VALIDATION.EXCHANGE_RATE_MIN}`,

  // Account validation
  ACCOUNT_REQUIRED: 'Account is required',
  ACCOUNT_INVALID: 'Invalid account ID',

  // Version validation (optimistic concurrency)
  VERSION_REQUIRED: 'Version is required for updates',
  VERSION_CONFLICT: 'Transaction has been modified by another user. Please refresh and try again.',

  // General validation
  TRANSACTION_NOT_FOUND: 'Transaction not found',
  TRANSACTION_DELETED: 'Transaction has been deleted',
  AUTHENTICATION_REQUIRED: 'You must be signed in to perform this action',
} as const;

/**
 * Transaction Field Limits
 *
 * Additional constraints for specific fields.
 */
export const TRANSACTION_LIMITS = {
  /** Maximum transactions per bulk operation */
  BULK_UPDATE_MAX_SIZE: 100,

  /** Maximum transactions to fetch in single query */
  MAX_FETCH_SIZE: 1000,

  /** Default page size for pagination */
  DEFAULT_PAGE_SIZE: 50,
} as const;
