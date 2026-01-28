/**
 * Domain Types - Frontend camelCase Types
 *
 * These are the TRANSFORMED types that frontend components receive after data transformers.
 * They represent the OUTPUT of lib/types/data-transformers.ts
 *
 * CRITICAL DISTINCTION:
 * - database.types.ts = snake_case (PostgreSQL convention) - for Supabase client
 * - domain.ts (THIS FILE) = camelCase (JavaScript convention) - for React components
 *
 * When you use the API layer, you get these domain types, NOT database types!
 */

// ============================================================================
// TRANSACTION TYPES (Frontend camelCase)
// ============================================================================

/**
 * Raw transaction from transactions table
 * Use TransactionViewEntity instead when displaying in UI
 */
export interface Transaction {
  id: string;
  version: number; // NEW: Optimistic concurrency control
  userId: string;
  accountId: string;
  categoryId: string | null;
  amountCents: number;        // INTEGER CENTS (e.g., $10.50 = 1050)
  amountHomeCents: number;    // INTEGER CENTS (home currency)
  currencyOriginal: string;
  exchangeRate: number;
  description: string | null;
  notes: string | null;
  sourceText?: string;           // NEW: Raw source context (OCR, bank import data)
  date: string;
  transferId: string | null;
  inboxId?: string;              // NEW: Birth certificate - links to inbox origin
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// ACCOUNT TYPES (Frontend camelCase)
// ============================================================================

/**
 * Account with calculated balances (from account_balances view)
 * This is what you get from accountsApi.getAll()
 *
 * NEW CONTAINER PATTERN:
 * - Each row represents ONE account with ONE currency
 * - Multiple accounts share the same groupId (e.g., "Chase Visa USD" and "Chase Visa PEN")
 * - Group accounts by groupId for display
 *
 * UI DISPLAY CONVENTION (Flat Currency Architecture):
 * - ALWAYS use currencyCode in UI (e.g., "USD", "EUR", "PEN")
 * - NEVER use currencySymbol in UI (e.g., "$", "€", "S/") - symbols are ambiguous
 * - Display format: "${name} ${currencyCode}" (e.g., "BCP Credito PEN")
 */
export interface AccountBalance {
  accountId: string | null;
  groupId: string | null;
  name: string | null;
  currencyCode: string | null;
  type: 'checking' | 'savings' | 'credit_card' | 'investment' | 'loan' | 'cash' | 'other' | null;
  currentBalance: number | null;
  color: string | null;
  isVisible: boolean | null;
  currencySymbol: string | null; // Deprecated: Use currencyCode in UI for unambiguous display
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * Basic account from bank_accounts table
 * NEW: Each account has ONE currency and belongs to a group
 *
 * SYNC FIELDS (Phase 2a):
 * - version: Optimistic concurrency control via global_transaction_version
 * - deletedAt: Tombstone pattern for distributed sync
 */
export interface Account {
  id: string;
  version: number;
  groupId: string;
  name: string;
  color: string;
  currencyCode: string;
  type: 'checking' | 'savings' | 'credit_card' | 'investment' | 'loan' | 'cash' | 'other';
  userId: string;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/**
 * Grouped accounts for UI display
 * Multiple accounts with the same groupId are displayed as one visual card
 */
export interface GroupedAccount {
  groupId: string;
  name: string; // Clean name without currency suffix
  color: string;
  type: 'checking' | 'savings' | 'credit_card' | 'investment' | 'loan' | 'cash' | 'other';
  balances: Array<{
    accountId: string;
    currency: string;
    amount: number;
  }>;
}

// ============================================================================
// CATEGORY TYPES (Frontend camelCase)
// ============================================================================

/**
 * SYNC FIELDS (Phase 2a):
 * - version: Optimistic concurrency control via global_transaction_version
 * - deletedAt: Tombstone pattern for distributed sync
 */
export interface Category {
  id: string;
  version: number;
  name: string;
  color: string;
  type: 'income' | 'expense';
  parentId: string | null;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CategoryWithCount {
  // Critical fields - guaranteed non-null by transformer
  id: string;
  version: number;
  name: string;
  color: string;
  type: 'income' | 'expense';
  transactionCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;

  // Optional fields - can be null
  parentId: string | null;
  userId: string | null;
}

export interface ParentCategoryWithCount {
  id: string;
  version: number;
  name: string | null;
  color: string | null;
  type: 'income' | 'expense';
  parentId: string | null;
  transactionCount: number;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// ============================================================================
// CURRENCY TYPES (Frontend camelCase)
// ============================================================================

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  flag: string | null;
}

// ============================================================================
// USER SETTINGS TYPES (Frontend camelCase)
// ============================================================================

export interface UserSettings {
  userId: string;
  mainCurrency: string | null;
  startOfWeek: number | null;
  theme: string | null;
  transactionSortPreference: 'date' | 'created_at';
  createdAt: string;
  updatedAt: string;
}

// Transaction sort mode type alias
export type TransactionSortMode = 'date' | 'created_at';

// ============================================================================
// TYPE ALIASES (For backward compatibility)
// ============================================================================

/**
 * Alias for Account - used by some components that reference BankAccount
 */
export type BankAccount = Account;

// ============================================================================
// RECONCILIATION TYPES (Frontend camelCase)
// ============================================================================

/**
 * Reconciliation Status
 * - draft: Reconciliation in progress, transactions can be linked/unlinked
 * - completed: Reconciliation locked, linked transactions become immutable (semi-permeable lock)
 */
export type ReconciliationStatus = 'draft' | 'completed';

/**
 * Reconciliation session tracking the "Contract of Truth" between bank statements and ledger
 */
export interface Reconciliation {
  id: string;
  userId: string;
  accountId: string;
  name: string;
  beginningBalance: number;
  endingBalance: number;
  dateStart: string | null; // ISO timestamp - optional filter for transaction date range
  dateEnd: string | null;   // ISO timestamp - optional filter for transaction date range
  status: ReconciliationStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Reconciliation with joined account display data
 * Used in Settings Manager to show account name/currency alongside reconciliation
 */
export interface ReconciliationWithAccount extends Reconciliation {
  accountName: string;
  accountColor: string;
  accountCurrency: string;
}

/**
 * Real-time reconciliation math summary
 * Formula: Difference = Ending Balance - (Beginning Balance + Linked Sum)
 * isBalanced = true when Difference = 0
 */
export interface ReconciliationSummary {
  beginningBalance: number;
  endingBalance: number;
  linkedSum: number;      // Sum of amount_home for all linked transactions
  linkedCount: number;    // Number of transactions linked to this reconciliation
  difference: number;     // The "gap" that needs to be reconciled
  isBalanced: boolean;    // TRUE when difference = 0 (reconciliation complete)
}
