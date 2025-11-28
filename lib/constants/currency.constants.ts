/**
 * Currency configuration and formatting constants
 */

export const CURRENCY = {
  /**
   * Standard currency code length (ISO 4217)
   */
  CODE_LENGTH: 3,

  /**
   * Default fallback currency
   */
  DEFAULT: 'USD',

  /**
   * Formatting options
   */
  FORMAT: {
    DECIMAL_PLACES: 2,
    USE_GROUPING: true,
    EXCHANGE_RATE_PRECISION: 4, // Number of decimal places for exchange rates
  },

  /**
   * Input step values for currency amounts
   */
  STEP: {
    STANDARD: '0.01', // For regular amounts (e.g., $10.50)
    PRECISE: '0.0001', // For exchange rates
  },

  /**
   * Default values
   */
  DEFAULTS: {
    EXCHANGE_RATE: 1,
  },

  /**
   * API error messages and console logs
   */
  API: {
    ERRORS: {
      FETCH_ALL_FAILED: 'Failed to fetch currencies',
      USER_NOT_AUTHENTICATED: 'User not authenticated',
    },
    CONSOLE: {
      FETCH_CURRENCIES: 'Error fetching currencies:',
    },
  },
} as const;

/**
 * Type-safe access to constant values
 */
export type CurrencyCode = string; // Could be made more strict with a union type
