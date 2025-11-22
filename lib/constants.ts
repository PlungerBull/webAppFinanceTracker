/**
 * Application-wide constants
 * Centralizes all magic numbers and strings for better maintainability
 */

// ============================================================================
// QUERY & CACHE CONFIGURATION
// ============================================================================

export const QUERY_CONFIG = {
  /**
   * Stale time: How long data is considered fresh before refetching
   */
  STALE_TIME: {
    SHORT: 1 * 60 * 1000, // 1 minute - Frequently changing data
    MEDIUM: 5 * 60 * 1000, // 5 minutes - Semi-static data (categories, currencies)
    LONG: 10 * 60 * 1000, // 10 minutes - Rarely changing data
  },

  /**
   * Cache time: How long unused data stays in cache
   */
  CACHE_TIME: {
    SHORT: 5 * 60 * 1000, // 5 minutes
    MEDIUM: 10 * 60 * 1000, // 10 minutes
    LONG: 30 * 60 * 1000, // 30 minutes
  },

  /**
   * Default query config for the app
   */
  DEFAULT: {
    STALE_TIME: 60 * 1000, // 1 minute
  },
} as const;

// ============================================================================
// CURRENCY CONFIGURATION
// ============================================================================

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
  },

  /**
   * Input step values for currency amounts
   */
  STEP: {
    STANDARD: '0.01', // For regular amounts (e.g., $10.50)
    PRECISE: '0.0001', // For exchange rates
  },
} as const;

// ============================================================================
// ACCOUNT CONFIGURATION
// ============================================================================

export const ACCOUNT = {
  /**
   * Default account color
   */
  DEFAULT_COLOR: '#3b82f6',

  /**
   * Color for "no color" option
   */
  NO_COLOR: '#94a3b8',

  /**
   * Predefined color palette for accounts
   */
  COLOR_PALETTE: [
    '#ef4444', // Red
    '#f97316', // Orange
    '#eab308', // Yellow
    '#22c55e', // Green
    '#14b8a6', // Teal
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#6366f1', // Indigo
    '#a855f7', // Purple
    '#ec4899', // Pink
  ],

  /**
   * Regex for validating hex color codes
   */
  COLOR_REGEX: /^#[0-9A-Fa-f]{6}$/,
} as const;

// ============================================================================
// CATEGORY CONFIGURATION
// ============================================================================

export const CATEGORY = {
  /**
   * Default category color
   */
  DEFAULT_COLOR: '#64748b', // Slate-500
} as const;

// ============================================================================
// SETTINGS CONFIGURATION
// ============================================================================

export const SETTINGS_TABS = {
  ACCOUNT: 'Account',
  DATA: 'Data Management',
} as const;

// ============================================================================
// DATABASE FIELD VALUES
// ============================================================================

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

// ============================================================================
// UI CONFIGURATION
// ============================================================================

export const UI = {
  /**
   * Text input maximum lengths
   */
  MAX_LENGTH: {
    ACCOUNT_NAME: 50,
    TRANSACTION_DESCRIPTION: 200,
    NOTES: 500,
    FIRST_NAME: 100,
    LAST_NAME: 100,
  },

  /**
   * Textarea rows
   */
  ROWS: {
    NOTES_COMPACT: 2,
    NOTES_EXPANDED: 3,
  },

  /**
   * Auto-close delays for modals (milliseconds)
   */
  AUTO_CLOSE_DELAY: {
    DEFAULT: 2000, // 2 seconds
    SHORT: 1000, // 1 second
    MEDIUM: 2000, // 2 seconds
    LONG: 3000, // 3 seconds
  },

  /**
   * Month display configuration
   */
  MONTHS_DISPLAY: {
    SPENDING_TABLE: 6, // Show last 6 months in spending table
  },
} as const;

// ============================================================================
// VALIDATION RULES
// ============================================================================

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
} as const;

// ============================================================================
// QUERY KEYS
// ============================================================================

/**
 * React Query key factories
 * Centralized to ensure consistency across the app
 */
export const QUERY_KEYS = {
  ACCOUNTS: ['accounts'] as const,
  CATEGORIES: ['categories'] as const,
  CURRENCIES: ['currencies'] as const,
  TRANSACTIONS: {
    ALL: ['transactions'] as const,
    MONTHLY_SPENDING: (monthsBack: number) =>
      ['transactions', 'monthly-spending', monthsBack] as const,
  },
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

/**
 * Type-safe access to constant values
 */
export type QueryStaleTime = (typeof QUERY_CONFIG.STALE_TIME)[keyof typeof QUERY_CONFIG.STALE_TIME];
export type QueryCacheTime = (typeof QUERY_CONFIG.CACHE_TIME)[keyof typeof QUERY_CONFIG.CACHE_TIME];
export type CurrencyCode = string; // Could be made more strict with a union type
export type AutoCloseDelay = (typeof UI.AUTO_CLOSE_DELAY)[keyof typeof UI.AUTO_CLOSE_DELAY];

// ============================================================================
// IMPORT / EXPORT CONFIGURATION
// ============================================================================

export const IMPORT_EXPORT = {
  REQUIRED_COLUMNS: ['Date', 'Amount', 'Account', 'Description', 'Category', 'Currency'],
  OPTIONAL_COLUMNS: ['Exchange Rate', 'Notes'],
  FILE_TYPES: ['.xlsx', '.xls'],
} as const;

// ============================================================================
// SETTINGS PAGE CONFIGURATION
// ============================================================================

export const SETTINGS = {
  HEADERS: {
    ACCOUNT: 'Account',
    DATA: 'Data Management',
    PHOTO: 'Photo',
    IMPORT_EXPORT: 'Import & Export',
    DANGER_ZONE: 'Danger Zone',
  },
  DESCRIPTIONS: {
    ACCOUNT: 'Update your personal information and security settings.',
    DATA: 'Manage your financial data. Import from Excel, export for backup, or reset your account.',
    IMPORT: 'Import transactions from an Excel file (.xlsx, .xls).',
    EXPORT: 'Download a backup of all your transactions in Excel format.',
    CLEAR_DATA: 'Permanently delete all your transactions, accounts, and categories.',
    CLEAR_DATA_CONFIRM: 'This action cannot be undone. This will permanently delete all your transactions, bank accounts, categories, and currencies from our servers.',
  },
  LABELS: {
    FIRST_NAME: 'First Name',
    LAST_NAME: 'Last Name',
    EMAIL: 'Email',
    PASSWORD: 'Password',
    PASSWORD_PLACEHOLDER: '••••••••',
    IMPORT_DATA: 'Import Data',
    EXPORT_DATA: 'Export Data',
    CLEAR_ALL_DATA: 'Clear All Data',
    CLEAR_ALL_DATA_QUESTION: 'Clear All Data?',
    FILE_STRUCTURE_REQ: 'File Structure Requirements',
    REQUIRED_COLUMNS: 'Required Columns:',
    OPTIONAL_COLUMNS: 'Optional Columns:',
  },
  BUTTONS: {
    UPLOAD_PHOTO: 'Upload photo',
    CHANGE: 'Change',
    UPDATE_PROFILE: 'Update Profile',
    SELECT_FILE: 'Select File',
    DOWNLOAD: 'Download',
    CLEAR_DATA: 'Clear Data',
    CANCEL: 'Cancel',
    CONFIRM_DELETE: 'Yes, delete everything',
  },
  MESSAGES: {
    SUCCESS: {
      PROFILE_UPDATED: 'Profile updated successfully!',
      IMPORT_SUCCESS: (count: number) => `Successfully imported ${count} records!`,
      DATA_CLEARED: 'All data has been successfully deleted.',
    },
    ERROR: {
      UPDATE_FAILED: 'Failed to update profile',
      IMPORT_FAILED: 'Import failed',
      EXPORT_FAILED: 'Export failed',
      CLEAR_FAILED: 'Failed to clear data. Please try again.',
      IMPORT_ERRORS: (success: number, failed: number, errors: string[]) =>
        `Imported ${success} records. Failed: ${failed}. Errors: ${errors.slice(0, 3).join(', ')}...`,
    },
    FILE_STRUCTURE_INTRO: (fileTypes: string) =>
      `Please ensure your Excel file (${fileTypes}) matches the following structure:`,
  },
  TIMEOUTS: {
    SUCCESS_MESSAGE: 2000,
  },
} as const;
