/**
 * Account Domain Constants
 *
 * Validation rules and limits shared across web and iOS.
 *
 * Swift Mirror:
 * ```swift
 * enum AccountValidation {
 *     static let nameMaxLength = 100
 *     static let nameMinLength = 1
 *     static let colorRegex = "^#[0-9A-Fa-f]{6}$"
 *     static let maxCurrenciesPerGroup = 10
 * }
 * ```
 *
 * @module account-constants
 */

/**
 * Account Validation Constants
 */
export const ACCOUNT_VALIDATION = {
  /** Maximum length for account name */
  NAME_MAX_LENGTH: 100,

  /** Minimum length for account name */
  NAME_MIN_LENGTH: 1,

  /** Regex for validating hex color codes */
  COLOR_REGEX: /^#[0-9A-Fa-f]{6}$/,

  /** Maximum number of currencies per account group */
  MAX_CURRENCIES_PER_GROUP: 10,

  /** Default hex color for new accounts */
  DEFAULT_COLOR: '#3b82f6',
} as const;

/**
 * Account Error Messages
 */
export const ACCOUNT_ERRORS = {
  NAME_REQUIRED: 'Account name is required',
  NAME_TOO_LONG: `Account name cannot exceed ${ACCOUNT_VALIDATION.NAME_MAX_LENGTH} characters`,
  NAME_TOO_SHORT: `Account name must be at least ${ACCOUNT_VALIDATION.NAME_MIN_LENGTH} character`,
  INVALID_COLOR: 'Color must be a valid hex code (e.g., #FF5733)',
  CURRENCIES_REQUIRED: 'At least one currency is required',
  TOO_MANY_CURRENCIES: `Cannot exceed ${ACCOUNT_VALIDATION.MAX_CURRENCIES_PER_GROUP} currencies per account group`,
  NOT_FOUND: 'Account not found',
  VERSION_CONFLICT: 'Account has been modified by another user',
  DELETE_FAILED: 'Failed to delete account',
  UPDATE_FAILED: 'Failed to update account',
  CREATE_FAILED: 'Failed to create account',
} as const;

/**
 * Account Limits
 */
export const ACCOUNT_LIMITS = {
  /** Maximum accounts per user (soft limit for UI performance) */
  MAX_ACCOUNTS_PER_USER: 100,

  /** Default page size for account lists */
  DEFAULT_PAGE_SIZE: 50,
} as const;
