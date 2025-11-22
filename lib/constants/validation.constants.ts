/**
 * Validation rules and error messages
 */

export const VALIDATION = {
  /**
   * Password requirements
   */
  PASSWORD: {
    MIN_LENGTH: 8,
  },

  /**
   * Field minimum lengths (mostly for required fields)
   */
  MIN_LENGTH: {
    REQUIRED: 1, // For required string fields
  },

  /**
   * Numeric value limits
   */
  NUMERIC: {
    MIN_BALANCE: 0, // Minimum balance value
    MAX_AMOUNT: 999999999, // Maximum transaction amount
  },

  /**
   * Validation regex patterns
   */
  REGEX: {
    PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    CURRENCY_CODE: /^[A-Z]{3}$/,
  },

  MESSAGES: {
    REQUIRED: 'This field is required',
    INVALID_EMAIL: 'Invalid email address',
    PASSWORD_MIN_LENGTH: `Password must be at least ${8} characters`,
    PASSWORD_REQUIREMENTS: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    PASSWORDS_DO_NOT_MATCH: 'Passwords do not match',
    PASSWORDS_DONT_MATCH: "Passwords don't match",
    INVALID_AMOUNT: 'Invalid amount',
    INVALID_DATE: 'Invalid date',
    FIRST_NAME_REQUIRED: 'First name is required',
    LAST_NAME_REQUIRED: 'Last name is required',
    EMAIL_REQUIRED: 'Email is required',
    PASSWORD_REQUIRED: 'Password is required',
    CURRENT_PASSWORD_REQUIRED: 'Current password is required',
    CONFIRM_PASSWORD: 'Please confirm your password',
    CONFIRM_NEW_PASSWORD: 'Please confirm your new password',
    CATEGORY_NAME_REQUIRED: 'Category name is required',
    DESCRIPTION_REQUIRED: 'Description is required',
    DESCRIPTION_MAX: (max: number) => `Description must be less than ${max} characters`,
    AMOUNT_MIN: 'Amount must be greater than 0',
    AMOUNT_ZERO: 'Amount cannot be zero',
    CATEGORY_REQUIRED: 'Category is required',
    ACCOUNT_REQUIRED: 'Account is required',
    TRANSACTION_DATE_REQUIRED: 'Transaction date is required',
    INVALID_CATEGORY: 'Invalid category',
    INVALID_BANK_ACCOUNT: 'Invalid bank account',
    BANK_ACCOUNT_REQUIRED: 'Bank account is required',
    CURRENCY_VALID_CODE: 'Currency must be a valid 3-letter code',
    CURRENCY_UPPERCASE: 'Currency must be uppercase letters',
    EXCHANGE_RATE_POSITIVE: 'Exchange rate must be positive',
    NOTES_MAX: (max: number) => `Notes must be less than ${max} characters`,
  },
} as const;
