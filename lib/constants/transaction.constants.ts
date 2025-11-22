/**
 * Transaction configuration and UI constants
 */

export const TRANSACTIONS = {
  /**
   * API error messages and console logs
   */
  API: {
    ERRORS: {
      FETCH_ALL_FAILED: 'Failed to fetch transactions',
      FETCH_ONE_FAILED: 'Failed to fetch transaction',
      CREATE_FAILED: 'Failed to create transaction',
      UPDATE_FAILED: 'Failed to update transaction',
      DELETE_FAILED: 'Failed to delete transaction',
      USER_NOT_AUTHENTICATED: 'User not authenticated',
    },
    CONSOLE: {
      FETCH_TRANSACTIONS: 'Error fetching transactions:',
      FETCH_TRANSACTION: 'Error fetching transaction:',
      CREATE_TRANSACTION: 'Error creating transaction:',
      UPDATE_TRANSACTION: 'Error updating transaction:',
      DELETE_TRANSACTION: 'Error deleting transaction:',
    },
  },

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
      ADD_DESCRIPTION: 'Add a new transaction to track your spending',
      SELECT_TO_VIEW: 'Select a transaction to view details',
      NO_NOTES: 'No notes',
    },
    PLACEHOLDERS: {
      AMOUNT: '0.00',
      DESCRIPTION: 'Description',
      AMOUNT_INPUT: 'Amount',
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
