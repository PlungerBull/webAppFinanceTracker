/**
 * Inbox configuration and UI constants
 */

export const INBOX = {
  /**
   * API error messages and console logs
   */
  API: {
    ERRORS: {
      FETCH_FAILED: 'Failed to fetch inbox items',
      PROMOTE_FAILED: 'Failed to promote inbox item to ledger',
      DISMISS_FAILED: 'Failed to dismiss inbox item',
      CREATE_FAILED: 'Failed to create inbox item',
      USER_NOT_AUTHENTICATED: 'User not authenticated',
      MISSING_ACCOUNT: 'Account is required to promote item',
      MISSING_CATEGORY: 'Category is required to promote item',
    },
    CONSOLE: {
      ERROR_PREFIX: '[Inbox API Error]',
      FETCH_ITEMS: 'Error fetching inbox items:',
      PROMOTE_ITEM: 'Error promoting inbox item:',
      DISMISS_ITEM: 'Error dismissing inbox item:',
      CREATE_ITEM: 'Error creating inbox item:',
    },
  },

  UI: {
    LABELS: {
      INBOX: 'Inbox',
      PENDING_ITEMS: 'Pending Items',
      REVIEW_ITEM: 'Review Item',
      PROMOTE_TO_LEDGER: 'Move to Ledger',
      DISMISS_ITEM: 'Ignore',
      ACCOUNT: 'Account',
      CATEGORY: 'Category',
      AMOUNT: 'Amount',
      DESCRIPTION: 'Description',
      DATE: 'Date',
      SOURCE: 'Source',
      SELECT_ACCOUNT: 'Select account',
      SELECT_CATEGORY: 'Select category',
    },
    MESSAGES: {
      PROMOTE_SUCCESS: 'Transaction moved to ledger',
      DISMISS_SUCCESS: 'Item dismissed',
      CREATE_SUCCESS: 'Item added to inbox',
      NO_ITEMS: 'No pending items. Your inbox is empty!',
      NO_ITEMS_DESCRIPTION: 'Items you add for quick review will appear here.',
      PROMOTE_CONFIRMATION: 'Move this item to your transaction ledger?',
      DISMISS_CONFIRMATION: 'Ignore this item? You can still find it in the archive.',
    },
    BUTTONS: {
      APPROVE: 'Approve',
      IGNORE: 'Ignore',
      APPROVING: 'Approving...',
      IGNORING: 'Ignoring...',
    },
  },

  /**
   * Query keys for React Query
   */
  QUERY_KEYS: {
    ALL: ['inbox'] as const,
    PENDING: ['inbox', 'pending'] as const,
    PENDING_INFINITE: ['inbox', 'pending', 'infinite'] as const,
  },
} as const;
