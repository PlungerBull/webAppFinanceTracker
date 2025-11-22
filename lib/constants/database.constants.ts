/**
 * Database field values and configuration
 */

export const DATABASE = {
  /**
   * Flag value for main currency
   */
  MAIN_CURRENCY_FLAG: true,

  /**
   * Default months to fetch for historical data
   */
  MONTHS_BACK: {
    DEFAULT: 6,
    MIN: 1,
    MAX: 120, // 10 years
  },
} as const;
