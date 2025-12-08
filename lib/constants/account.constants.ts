/**
 * Account configuration and UI constants
 * Consolidates ACCOUNT, ACCOUNTS, and ACCOUNT_UI from the original constants file
 */

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
   * Predefined color palette for accounts (7 colors + custom picker = 8 total)
   */
  COLOR_PALETTE: [
    '#3b82f6', // Blue
    '#22c55e', // Green
    '#eab308', // Yellow
    '#ef4444', // Red
    '#a855f7', // Purple
    '#ec4899', // Pink
    '#f97316', // Orange
  ],

  /**
   * Regex for validating hex color codes
   */
  COLOR_REGEX: /^#[0-9A-Fa-f]{6}$/,

  /**
   * Color input configuration
   */
  COLOR_INPUT: {
    MAX_LENGTH: 7, // Length of hex color code (e.g., #FFFFFF)
  },
} as const;

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
