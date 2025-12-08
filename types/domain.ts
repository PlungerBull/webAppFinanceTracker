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
 */
export interface TransactionView {
  id: string | null;
  userId: string | null;
  accountId: string | null;
  accountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  amountOriginal: number | null;
  amountHome: number | null;
  currencyOriginal: string | null;
  exchangeRate: number | null;
  description: string | null;
  notes: string | null;
  date: string | null;
  createdAt: string | null;
  updatedAt: string | null;
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
 */
export interface AccountBalance {
  id: string | null;
  accountId: string | null;
  name: string | null;
  color: string | null;
  currency: string | null;
  isVisible: boolean | null;
  startingBalance: number | null;
  transactionSum: number | null;
  currentBalance: number | null;
  userId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * Basic account from bank_accounts table
 */
export interface Account {
  id: string;
  name: string;
  color: string;
  userId: string;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountCurrency {
  id: string;
  accountId: string;
  currencyCode: string;
  createdAt: string | null;
  updatedAt: string | null;
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
  id: string | null;
  name: string | null;
  color: string | null;
  type: 'income' | 'expense' | null;
  parentId: string | null;
  transactionCount: number | null;
  userId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
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
