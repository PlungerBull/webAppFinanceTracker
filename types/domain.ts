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
 * Transaction from transactions_view (most commonly used in UI)
 * This includes joined data from accounts and categories
 *
 * CRITICAL FIELDS (guaranteed non-null by transformer):
 * - id, userId, accountId, accountName: Always present
 * - amountOriginal, amountHome: Always present (defaults to 0)
 * - currencyOriginal: Always present (defaults to 'USD')
 * - exchangeRate: Always present (defaults to 1)
 * - date, createdAt, updatedAt: Always present
 *
 * OPTIONAL FIELDS (can be null):
 * - categoryId, categoryName, categoryColor: Transaction may not have a category
 * - description, notes: Optional user-provided fields
 */
export interface TransactionView {
  // Critical fields - guaranteed non-null
  id: string;
  userId: string;
  accountId: string;
  accountName: string;
  amountOriginal: number;
  amountHome: number;
  currencyOriginal: string;
  exchangeRate: number;
  date: string;
  createdAt: string;
  updatedAt: string;

  // Optional fields - can be null
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  description: string | null;
  notes: string | null;
}

/**
 * Raw transaction from transactions table
 * Use TransactionView instead when displaying in UI
 */
export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  categoryId: string | null;
  amountOriginal: number;
  amountHome: number;
  currencyOriginal: string;
  exchangeRate: number;
  description: string | null;
  notes: string | null;
  date: string;
  transferId: string | null;
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
 */
export interface AccountBalance {
  accountId: string | null;
  groupId: string | null;
  name: string | null;
  currencyCode: string | null;
  type: 'checking' | 'savings' | 'credit_card' | 'investment' | 'loan' | 'cash' | 'other' | null;
  currentBalance: number | null;
}

/**
 * Basic account from bank_accounts table
 * NEW: Each account has ONE currency and belongs to a group
 */
export interface Account {
  id: string;
  groupId: string;
  name: string;
  color: string;
  currencyCode: string;
  type: 'checking' | 'savings' | 'credit_card' | 'investment' | 'loan' | 'cash' | 'other';
  userId: string;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
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

export interface Category {
  id: string;
  name: string;
  color: string;
  type: 'income' | 'expense';
  parentId: string | null;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryWithCount {
  // Critical fields - guaranteed non-null by transformer
  id: string;
  name: string;
  color: string;
  type: 'income' | 'expense';
  transactionCount: number;
  createdAt: string;
  updatedAt: string;

  // Optional fields - can be null
  parentId: string | null;
  userId: string | null;
}

export interface ParentCategoryWithCount {
  id: string;
  name: string;
  color: string;
  type: 'income' | 'expense';
  parentId: string | null;
  transactionCount: number;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// TYPE ALIASES (For backward compatibility)
// ============================================================================

/**
 * Alias for Account - used by some components that reference BankAccount
 */
export type BankAccount = Account;
