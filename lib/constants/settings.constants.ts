/**
 * Settings page and user menu configuration constants
 */

export const SETTINGS_TABS = {
  ACCOUNT: 'Account',
  DATA: 'Data Management',
} as const;

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
