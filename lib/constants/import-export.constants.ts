/**
 * Import/Export configuration constants
 */

export const IMPORT_EXPORT = {
  REQUIRED_COLUMNS: ['Date', 'Amount', 'Account', 'Description', 'Category', 'Currency'],
  OPTIONAL_COLUMNS: ['Exchange Rate', 'Notes'],
  FILE_TYPES: ['.xlsx', '.xls'],

  /**
   * Excel date conversion constants
   */
  EXCEL: {
    EPOCH_OFFSET: 25567, // Excel epoch offset from Unix epoch
    DATE_ADJUSTMENT: 2, // Excel date adjustment for leap year bug
    SECONDS_PER_DAY: 86400, // Seconds in a day
    MS_MULTIPLIER: 1000, // Milliseconds conversion
  },

  /**
   * Error messages for import/export operations
   */
  ERRORS: {
    FILE_EMPTY: 'File is empty',
    DATE_REQUIRED: 'Date is required',
    INVALID_DATE_FORMAT: (date: string | number) => `Invalid date format: ${date}`,
    DESCRIPTION_REQUIRED: 'Description is required',
    CATEGORY_REQUIRED: 'Category is required',
    CURRENCY_REQUIRED: 'Currency is required',
    USER_NOT_AUTHENTICATED: 'User not authenticated',
    RPC_CALL_FAILED: (message: string) => `RPC call failed: ${message}`,
    FILE_PROCESSING_ERROR: (error: string) => `File processing error: ${error}`,
    UNKNOWN_ERROR: 'Unknown error',
  },

  /**
   * RPC function names and parameters
   */
  RPC: {
    IMPORT_TRANSACTIONS: 'import_transactions',
    PARAMS: {
      USER_ID: 'p_user_id',
      TRANSACTIONS: 'p_transactions',
      DEFAULT_ACCOUNT_COLOR: 'p_default_account_color',
      DEFAULT_CATEGORY_COLOR: 'p_default_category_color',
    },
  },
} as const;
