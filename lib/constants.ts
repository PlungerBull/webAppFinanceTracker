/**
 * Application-wide constants
 * Centralizes all magic numbers and strings for better maintainability
 */

// ============================================================================
// APP METADATA
// ============================================================================

export const APP_METADATA = {
  TITLE: 'Finance Tracker - Manage Your Finances Across Multiple Currencies',
  DESCRIPTION: 'A personal finance tracking application that helps you manage your money across multiple accounts and currencies with a beautiful, intuitive interface.',
} as const;

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
// ACCOUNTS CONFIGURATION
// ============================================================================

export const ACCOUNTS = {
  /**
   * Error messages for account operations
   */
  MESSAGES: {
    ERROR: {
      FETCH_FAILED: 'Failed to fetch accounts',
      FETCH_ONE_FAILED: 'Failed to fetch account',
      CREATE_FAILED: 'Failed to create account',
      UPDATE_FAILED: 'Failed to update account',
      DELETE_FAILED: 'Failed to delete account',

      CURRENCY_FETCH_FAILED: 'Failed to fetch account currencies',
      CURRENCY_ADD_FAILED: 'Failed to add currency to account',
      CURRENCY_UPDATE_FAILED: 'Failed to update account currency',
      CURRENCY_REMOVE_FAILED: 'Failed to remove currency from account',
      CURRENCY_BULK_ADD_FAILED: 'Failed to add currencies to account',
      CURRENCY_REPLACE_FAILED: 'Failed to replace currency',

      VALIDATION_NO_CURRENCY: 'Please add at least one currency to the account',
      VALIDATION_NAME_REQUIRED: 'Account name is required',
      VALIDATION_NAME_TOO_LONG: 'Account name must be less than 50 characters',
      VALIDATION_COLOR_INVALID: 'Invalid color format',
    },
    WARNING: {
      CURRENCY_CHANGE_AFFECTS_TRANSACTIONS: 'The changes you made will affect all related transactions',
    },
    CONFIRM: {
      DELETE_ACCOUNT: 'Are you sure you want to delete this account?',
    },
  },

  /**
   * UI labels and text
   */
  LABELS: {
    MODAL_ADD_TITLE: 'Add New Account',
    MODAL_ADD_DESC: 'Create a new account and configure currencies',
    MODAL_EDIT_TITLE: 'Edit Account',
    MODAL_DELETE_TITLE: 'Delete Account',

    CURRENCIES: 'Currencies',
    ADD_CURRENCIES: 'Add Currencies *',
    CURRENCY_INPUT_PLACEHOLDER: 'Currency (e.g., USD)',
    STARTING_BALANCE: 'Starting Balance',

    ACCOUNT_NAME: 'Account Name *',
    ACCOUNT_NAME_PLACEHOLDER: 'e.g., BCP Credit Card, Checking Account',
    ACCOUNT_COLOR: 'Account Color *',
    CUSTOM_COLOR: 'Custom Color',

    GRID_FROM: 'FROM',
    GRID_TO: 'TO',
    GRID_INITIAL_AMOUNT: 'INITIAL AMOUNT',
  },

  /**
   * Button text
   */
  BUTTONS: {
    CREATE: 'Create Account',
    UPDATE: 'Update Account',
    DELETE: 'Delete',
    CANCEL: 'Cancel',
    ADD_CURRENCY: (code: string) => `Add "${code}"`,
  },

  /**
   * Default values
   */
  VALUES: {
    DEFAULT_BALANCE: '0',
    DEFAULT_BALANCE_DECIMAL: '0.00',
  },

  /**
   * Modal configuration
   */
  MODAL: {
    ADD_MAX_WIDTH: 'sm:max-w-[550px]',
    EDIT_MAX_WIDTH: 'sm:max-w-[600px]',
    MAX_HEIGHT: 'max-h-[90vh]',
    OVERFLOW: 'overflow-y-auto',
  },

  /**
   * Console log messages
   */
  CONSOLE: {
    ERROR_PREFIX: 'Error',
    FETCH_ACCOUNTS: 'fetching accounts',
    FETCH_ACCOUNT: 'fetching account',
    CREATE_ACCOUNT: 'creating account with currencies',
    UPDATE_ACCOUNT: 'updating account',
    DELETE_ACCOUNT: 'deleting account',
    FETCH_CURRENCIES: 'fetching account currencies',
    CREATE_CURRENCY: 'creating account currency',
    UPDATE_CURRENCY: 'updating account currency',
    DELETE_CURRENCY: 'deleting account currency',
    REPLACE_CURRENCY: 'replacing currency',
    ADD_CURRENCY_MODAL: 'adding currency',
  },
} as const;

export const ACCOUNT_UI = {
  LABELS: {
    ACCOUNTS: 'Accounts',
    CREATE_ACCOUNT: 'Create Account',
    EDIT_ACCOUNT: 'Edit Account',
    DELETE_ACCOUNT: 'Delete Account',
    ADD_ACCOUNT: 'Add Account',
    ACCOUNT_NAME: 'Account Name',
    ACCOUNT_NAME_PLACEHOLDER: 'e.g., Main Checking',
    INITIAL_BALANCE: 'Initial Balance',
    CURRENCY: 'Currency',
    CURRENCIES: 'Currencies',
    CURRENCY_PLACEHOLDER: 'Currency (e.g., USD)',
    BALANCE: 'Balance',
    BALANCE_PLACEHOLDER: '0.00',
    STARTING_BALANCE: 'Starting balance',
    COLOR: 'Color',
    ICON: 'Icon',
    SELECT_ICON: 'Select Icon',
    SEARCH_ICONS: 'Search icons...',
    NO_ICONS_FOUND: 'No icons found',
    DEFAULT: 'Default',
    UNKNOWN_ACCOUNT: 'Unknown Account',
    NOT_AVAILABLE: 'N/A',
    SELECTED_CURRENCIES: (count: number) => `Selected Currencies (${count})`,
    STARTING_BALANCE_FOR: (currency: string) => `Starting balance for ${currency}`,
    TABLE_FROM: 'FROM',
    TABLE_TO: 'TO',
    TABLE_INITIAL_AMOUNT: 'INITIAL AMOUNT',
  },
  DESCRIPTIONS: {
    CREATE_ACCOUNT: 'Create a new account to track your finances.',
    EDIT_ACCOUNT: 'Update account details',
    ADD_CURRENCIES: 'Add one or more currencies for this account',
    REPLACE_CURRENCIES: 'Replace currencies in this account. All matching transactions will be updated.',
  },
  MESSAGES: {
    CREATE_SUCCESS: 'Account created successfully',
    UPDATE_SUCCESS: 'Account updated successfully',
    DELETE_SUCCESS: 'Account deleted successfully',
    DELETE_CONFIRMATION: 'Are you sure you want to delete this account? This action cannot be undone.',
    DELETE_WARNING: 'This will also delete all transactions associated with this account.',
    LOADING: 'Loading...',
    NO_ACCOUNTS: 'No accounts yet!',
    NO_CURRENCIES: 'No currencies configured for this account',
    ACCOUNT_NAME_REQUIRED: 'Account name is required',
    AT_LEAST_ONE_CURRENCY: 'Please add at least one currency to the account',
    CREATE_FAILED: 'Failed to create account',
    UPDATE_FAILED: 'Failed to update account',
    DELETE_FAILED: 'Failed to delete account',
    ADD_CURRENCY: (code: string) => `Add "${code}"`,
    CURRENCY_CHANGE_WARNING: (oldCode: string, newCode: string) => `⚠️ All ${oldCode} transactions will be changed to ${newCode}`,
    ERROR_ADDING_CURRENCY: 'Error adding currency:',
  },
  BUTTONS: {
    CREATE: 'Create Account',
    UPDATE: 'Update Account',
    DELETE: 'Delete Account',
    CANCEL: 'Cancel',
  },
} as const;

// ============================================================================
// CATEGORY CONFIGURATION
// ============================================================================

export const CATEGORY = {
  /**
   * Default category color
   */
  DEFAULT_COLOR: '#64748b', // Slate-500
  UI: {
    LABELS: {
      CREATE_CATEGORY: 'Create Category',
      EDIT_CATEGORY: 'Edit Category',
      DELETE_CATEGORY: 'Delete Category',
      CATEGORY_NAME: 'Category Name',
      CATEGORY_NAME_PLACEHOLDER: 'e.g., Groceries',
      COLOR: 'Color',
      ICON: 'Icon',
      SELECT_ICON: 'Select Icon',
      SEARCH_ICONS: 'Search icons...',
      NO_ICONS_FOUND: 'No icons found',
    },
    MESSAGES: {
      CREATE_SUCCESS: 'Category created successfully',
      UPDATE_SUCCESS: 'Category updated successfully',
      DELETE_SUCCESS: 'Category deleted successfully',
      DELETE_CONFIRMATION: 'Are you sure you want to delete this category? This action cannot be undone.',
      DELETE_WARNING: 'This will also delete all transactions associated with this category.',
      TRANSACTION_COUNT_WARNING: (count: number) => `This category has ${count} associated transactions. Deleting it will remove the category from these transactions.`,
    },
    BUTTONS: {
      CREATE: 'Create Category',
      UPDATE: 'Update Category',
      DELETE: 'Delete Category',
      CANCEL: 'Cancel',
    },
  },
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

  MODALS: {
    CHANGE_EMAIL: {
      TITLE: 'Change Email',
      DESCRIPTION: 'Enter your new email and current password. A confirmation will be sent to both your old and new email addresses.',
      SUCCESS: 'Success! Please check your email to confirm the change.',
      LABELS: {
        NEW_EMAIL: 'New Email',
        CURRENT_PASSWORD: 'Current Password',
      },
    },
    CHANGE_PASSWORD: {
      TITLE: 'Change Password',
      SUCCESS: 'Password updated successfully!',
      LABELS: {
        CURRENT_PASSWORD: 'Current Password',
        NEW_PASSWORD: 'New Password',
        CONFIRM_PASSWORD: 'Confirm New Password',
      },
    },
    MAIN: {
      TITLE: 'Settings',
    },
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
    CONFIRM_PASSWORD: 'Please confirm your password',
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
  ACCOUNT_CURRENCIES: (accountId?: string) =>
    accountId ? ['account-currencies', accountId] : ['account-currencies'],
  CATEGORIES: ['categories'] as const,
  CURRENCIES: ['currencies'] as const,
  TRANSACTIONS: {
    ALL: ['transactions'] as const,
    MONTHLY_SPENDING: (monthsBack: number) =>
      ['transactions', 'monthly-spending', monthsBack] as const,
  },
} as const;

export const TRANSACTIONS = {
  UI: {
    LABELS: {
      ADD_TRANSACTION: 'Add Transaction',
      EDIT_TRANSACTION: 'Edit Transaction',
      DELETE_TRANSACTION: 'Delete Transaction',
      TRANSACTION_DETAILS: 'Transaction Details',
      TRANSACTIONS: 'Transactions',
      DESCRIPTION: 'Description',
      DESCRIPTION_PLACEHOLDER: 'What was this for?',
      ADD_NOTE_PLACEHOLDER: 'Add a note...',
      AMOUNT: 'Amount',
      DATE: 'Date',
      PICK_DATE: 'Pick a date',
      PICK_A_DATE: 'Pick a date',
      CATEGORY: 'Category',
      ACCOUNT: 'Account',
      BANK_ACCOUNT: 'Bank Account',
      EXCHANGE_RATE: 'Exchange Rate',
      NOTES: 'Notes',
      NO_NOTES: 'No notes added',
      NOTES_PLACEHOLDER: 'Add a note...',
      SELECT_CATEGORY: 'Select category',
      SELECT_ACCOUNT: 'Select account',
      NO_CATEGORIES: 'No categories found',
      NO_ACCOUNTS: 'No accounts found',
      LOADING_CATEGORIES: 'Loading categories...',
      LOADING_ACCOUNTS: 'Loading accounts...',
      UNCATEGORIZED: 'Uncategorized',
      TOTAL: 'Total',
    },
    MESSAGES: {
      CREATE_SUCCESS: 'Transaction created successfully',
      UPDATE_SUCCESS: 'Transaction updated successfully',
      DELETE_SUCCESS: 'Transaction deleted successfully',
      DELETE_CONFIRMATION: 'Are you sure you want to delete this transaction? This action cannot be undone.',
      NO_TRANSACTIONS: 'No transactions found. Start adding transactions to see them here.',
    },
    BUTTONS: {
      ADD: 'Add Transaction',
      UPDATE: 'Update Transaction',
      DELETE: 'Delete Transaction',
      CANCEL: 'Cancel',
      SAVE: 'Save',
      EDIT: 'Edit',
      CREATING: 'Creating...',
      UPDATING: 'Updating...',
      DELETING: 'Deleting...',
    },
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

// ============================================================================
// AUTH CONFIGURATION
// ============================================================================

export const AUTH = {
  ERRORS: {
    // Console error prefixes
    SIGN_UP_ERROR: 'Sign up error:',
    LOGIN_ERROR: 'Login error:',
    LOGOUT_ERROR: 'Logout error:',
    RESET_PASSWORD_ERROR: 'Reset password error:',
    UPDATE_PASSWORD_ERROR: 'Update password error:',
    GET_SESSION_ERROR: 'Get session error:',
    GET_USER_ERROR: 'Get user error:',
    UPDATE_METADATA_ERROR: 'Error updating user metadata:',
    CHANGE_PASSWORD_ERROR: 'Error changing password:',
    CHANGE_EMAIL_ERROR: 'Error changing email:',
    REAUTH_ERROR: 'Re-authentication error:',

    // Error messages
    FAILED_SIGN_UP: 'Failed to sign up',
    FAILED_LOGIN: 'Failed to login',
    FAILED_LOGOUT: 'Failed to logout',
    FAILED_RESET_EMAIL: 'Failed to send reset email',
    FAILED_UPDATE_PASSWORD: 'Failed to update password',
    FAILED_GET_SESSION: 'Failed to get session',
    FAILED_GET_USER: 'Failed to get user',
    FAILED_UPDATE_PROFILE: 'Failed to update profile',
    FAILED_CHANGE_PASSWORD: 'Failed to change password',
    FAILED_CHANGE_EMAIL: 'Failed to change email',
    REAUTH_FAILED: 'Re-authentication failed. Please log out and log back in.',

    // Session errors
    AUTH_SESSION_MISSING_ERROR: 'AuthSessionMissingError',
    AUTH_SESSION_MISSING_MESSAGE: 'Auth session missing!',
  },
  LOGIN: {
    TITLE: 'Welcome back',
    DESCRIPTION: 'Enter your credentials to access your account',
    LABELS: {
      EMAIL: 'Email',
      PASSWORD: 'Password',
      FORGOT_PASSWORD: 'Forgot password?',
      NO_ACCOUNT: "Don't have an account?",
      SIGN_UP: 'Sign up',
    },
    BUTTONS: {
      LOGIN: 'Login',
      LOGGING_IN: 'Logging in...',
    },
    PLACEHOLDERS: {
      EMAIL: 'you@example.com',
      PASSWORD: '••••••••',
    },
    MESSAGES: {
      ERROR: 'Failed to login',
      LOADING: 'Loading...',
    },
  },
  SIGNUP: {
    TITLE: 'Create an account',
    DESCRIPTION: 'Enter your information to create your Finance Tracker account',
    CHECK_EMAIL_TITLE: 'Check your email',
    CHECK_EMAIL_DESC: "We've sent you a verification link. Please check your email to verify your account.",
    LABELS: {
      FIRST_NAME: 'First Name',
      LAST_NAME: 'Last Name',
      EMAIL: 'Email',
      PASSWORD: 'Password',
      CONFIRM_PASSWORD: 'Confirm Password',
      ALREADY_HAVE_ACCOUNT: 'Already have an account?',
      LOGIN: 'Login',
    },
    BUTTONS: {
      SIGN_UP: 'Sign up',
      CREATING_ACCOUNT: 'Creating account...',
    },
    PLACEHOLDERS: {
      FIRST_NAME: 'John',
      LAST_NAME: 'Doe',
      EMAIL: 'you@example.com',
      PASSWORD: '••••••••',
    },
    MESSAGES: {
      ERROR: 'Failed to sign up',
      SUCCESS_REDIRECT: 'Please check your email to verify your account',
    },
  },
  RESET_PASSWORD: {
    TITLE: 'Reset your password',
    DESCRIPTION: "Enter your email address and we'll send you a link to reset your password",
    CHECK_EMAIL_TITLE: 'Check your email',
    CHECK_EMAIL_DESC: "We've sent you a password reset link. Please check your email and follow the instructions.",
    LABELS: {
      EMAIL: 'Email',
    },
    BUTTONS: {
      SEND_LINK: 'Send reset link',
      SENDING_LINK: 'Sending reset link...',
      BACK_TO_LOGIN: 'Back to login',
    },
    PLACEHOLDERS: {
      EMAIL: 'you@example.com',
    },
    MESSAGES: {
      ERROR: 'Failed to send reset email',
    },
  },
  UPDATE_PASSWORD: {
    TITLE: 'Update your password',
    DESCRIPTION: 'Enter your new password below',
    LABELS: {
      NEW_PASSWORD: 'New Password',
      CONFIRM_PASSWORD: 'Confirm New Password',
    },
    BUTTONS: {
      UPDATE: 'Update password',
      UPDATING: 'Updating password...',
    },
    PLACEHOLDERS: {
      PASSWORD: '••••••••',
    },
    MESSAGES: {
      ERROR: 'Failed to update password',
      SUCCESS_REDIRECT: 'Password updated successfully. Please login with your new password.',
    },
  },
} as const;

// ============================================================================
// USER MENU CONFIGURATION
// ============================================================================

export const USER_MENU = {
  DEFAULT_NAME: 'User',
  FALLBACK_INITIALS: '?',
  LOADING: 'Loading...',
  LABELS: {
    SETTINGS: 'Settings',
    PREMIUM: 'Premium',
    LOGOUT: 'Logout',
  },
} as const;

// ============================================================================
// LANDING PAGE CONFIGURATION
// ============================================================================

export const LANDING = {
  HERO: {
    TITLE_1: 'Manage Your Finances',
    TITLE_2: 'Across Multiple Currencies',
    DESCRIPTION: 'A personal finance tracker that helps you manage your money across multiple accounts and currencies with a beautiful, intuitive interface.',
    BUTTONS: {
      GET_STARTED: 'Get Started',
      LOGIN: 'Login',
    },
  },
  FEATURES: {
    QUICK: {
      TITLE: 'Quick & Easy',
      DESCRIPTION: 'Add a transaction in under 7 seconds. No loading screens, instant access to your data.',
    },
    MULTI_CURRENCY: {
      TITLE: 'Multi-Currency',
      DESCRIPTION: 'Essential for dual-currency economies. Track accounts in USD, EUR, PEN, and more.',
    },
    PRIVACY: {
      TITLE: 'Privacy-First',
      DESCRIPTION: 'You own your data. Export everything anytime. Your financial information is secure.',
    },
  },
} as const;
