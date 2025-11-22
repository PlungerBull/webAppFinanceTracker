/**
 * UI configuration constants
 */

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

/**
 * Type-safe access to constant values
 */
export type AutoCloseDelay = (typeof UI.AUTO_CLOSE_DELAY)[keyof typeof UI.AUTO_CLOSE_DELAY];
