/**
 * Data Transformers - Single Source of Truth for Data Structure Mapping
 *
 * This file contains all conversion logic between:
 * - Database types (database.types.ts) - snake_case from Supabase
 * - Domain types (domain.ts) - application-level types
 * - API request/response types
 *
 * WHY: Eliminates duplication of conversion logic across API layer and forms.
 * If database schema changes, we only update transformers here.
 */

import type { Database } from '@/types/database.types';

// ============================================================================
// DATABASE TO DOMAIN TRANSFORMERS
// ============================================================================

/**
 * Transforms a database bank_accounts row to domain Account type
 */
export function dbAccountToDomain(
  dbAccount: Database['public']['Tables']['bank_accounts']['Row']
) {
  return {
    id: dbAccount.id,
    name: dbAccount.name,
    color: dbAccount.color,
    userId: dbAccount.user_id,
    isVisible: dbAccount.is_visible,
    createdAt: dbAccount.created_at,
    updatedAt: dbAccount.updated_at,
  } as const;
}

/**
 * Transforms a database category row to domain Category type
 */
export function dbCategoryToDomain(
  dbCategory: Database['public']['Tables']['categories']['Row']
) {
  return {
    id: dbCategory.id,
    name: dbCategory.name,
    color: dbCategory.color,
    type: dbCategory.type,
    parentId: dbCategory.parent_id,
    userId: dbCategory.user_id,
    createdAt: dbCategory.created_at,
    updatedAt: dbCategory.updated_at,
  } as const;
}

/**
 * Transforms a database global_currencies row to domain Currency type
 */
export function dbCurrencyToDomain(
  dbCurrency: Database['public']['Tables']['global_currencies']['Row']
) {
  return {
    code: dbCurrency.code,
    name: dbCurrency.name,
    symbol: dbCurrency.symbol,
    flag: dbCurrency.flag,
  } as const;
}

/**
 * Transforms a database account_currencies row to domain AccountCurrency type
 * NOTE: The balance is NOT in the account_currencies table - it's in the account_balances VIEW
 */
export function dbAccountCurrencyToDomain(
  dbAccountCurrency: Database['public']['Tables']['account_currencies']['Row']
) {
  return {
    id: dbAccountCurrency.id,
    accountId: dbAccountCurrency.account_id,
    currencyCode: dbAccountCurrency.currency_code,
    createdAt: dbAccountCurrency.created_at,
    updatedAt: dbAccountCurrency.updated_at,
  } as const;
}

/**
 * Transforms a database transaction row to domain Transaction type
 * NOTE: Actual schema has amount_original, amount_home, currency_original, exchange_rate, date (not transaction_date)
 */
export function dbTransactionToDomain(
  dbTransaction: Database['public']['Tables']['transactions']['Row']
) {
  return {
    id: dbTransaction.id,
    userId: dbTransaction.user_id,
    accountId: dbTransaction.account_id,
    categoryId: dbTransaction.category_id,
    amountOriginal: dbTransaction.amount_original,
    amountHome: dbTransaction.amount_home,
    currencyOriginal: dbTransaction.currency_original,
    exchangeRate: dbTransaction.exchange_rate,
    description: dbTransaction.description,
    notes: dbTransaction.notes,
    date: dbTransaction.date,
    transferId: dbTransaction.transfer_id,
    createdAt: dbTransaction.created_at,
    updatedAt: dbTransaction.updated_at,
  } as const;
}

/**
 * NOTE: There is NO transfers table in the database!
 * Transfers are created through the create_transfer() database function,
 * which creates linked transactions with a shared transfer_id.
 * To work with transfers, use the transactions table and filter by transfer_id.
 */

// ============================================================================
// DOMAIN TO DATABASE INSERT TRANSFORMERS
// ============================================================================

/**
 * Transforms domain account data to database insert format
 */
export function domainAccountToDbInsert(data: {
  name: string;
  color: string;
  userId: string;
  isVisible?: boolean;
}): Database['public']['Tables']['bank_accounts']['Insert'] {
  return {
    name: data.name,
    color: data.color,
    user_id: data.userId,
    is_visible: data.isVisible,
  };
}

/**
 * Transforms domain category data to database insert format
 */
export function domainCategoryToDbInsert(data: {
  name: string;
  color: string;
  type: 'income' | 'expense';
  parentId: string | null;
  userId: string;
}): Database['public']['Tables']['categories']['Insert'] {
  return {
    name: data.name,
    color: data.color,
    type: data.type,
    parent_id: data.parentId,
    user_id: data.userId,
  };
}

/**
 * Transforms domain account currency data to database insert format
 * NOTE: Balance is NOT stored in account_currencies table!
 */
export function domainAccountCurrencyToDbInsert(data: {
  accountId: string;
  currencyCode: string;
}): Database['public']['Tables']['account_currencies']['Insert'] {
  return {
    account_id: data.accountId,
    currency_code: data.currencyCode,
  };
}

/**
 * Transforms domain transaction data to database insert format
 * NOTE: No 'type' or 'subcategory_id' fields. Uses amount_original, amount_home, currency_original, exchange_rate
 */
export function domainTransactionToDbInsert(data: {
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
  transferId?: string | null;
}): Database['public']['Tables']['transactions']['Insert'] {
  return {
    user_id: data.userId,
    account_id: data.accountId,
    category_id: data.categoryId,
    amount_original: data.amountOriginal,
    amount_home: data.amountHome,
    currency_original: data.currencyOriginal,
    exchange_rate: data.exchangeRate,
    description: data.description,
    notes: data.notes,
    date: data.date,
    transfer_id: data.transferId,
  };
}

/**
 * NOTE: There is NO transfers INSERT type!
 * Use the create_transfer() database function instead.
 * See Database['public']['Functions']['create_transfer'] for the args type.
 */

// ============================================================================
// DOMAIN TO DATABASE UPDATE TRANSFORMERS
// ============================================================================

/**
 * Transforms domain account data to database update format
 */
export function domainAccountToDbUpdate(data: {
  name?: string;
  color?: string;
  isVisible?: boolean;
}): Database['public']['Tables']['bank_accounts']['Update'] {
  const update: Database['public']['Tables']['bank_accounts']['Update'] = {};

  if (data.name !== undefined) update.name = data.name;
  if (data.color !== undefined) update.color = data.color;
  if (data.isVisible !== undefined) update.is_visible = data.isVisible;

  return update;
}

/**
 * Transforms domain category data to database update format
 */
export function domainCategoryToDbUpdate(data: {
  name?: string;
  color?: string;
  type?: 'income' | 'expense';
  parentId?: string | null;
}): Database['public']['Tables']['categories']['Update'] {
  const update: Database['public']['Tables']['categories']['Update'] = {};

  if (data.name !== undefined) update.name = data.name;
  if (data.color !== undefined) update.color = data.color;
  if (data.type !== undefined) update.type = data.type;
  if (data.parentId !== undefined) update.parent_id = data.parentId;

  return update;
}

/**
 * Transforms domain account currency data to database update format
 * NOTE: There are no updatable fields besides the FK columns (which you shouldn't update)
 */
export function domainAccountCurrencyToDbUpdate(data: {
  currencyCode?: string;
}): Database['public']['Tables']['account_currencies']['Update'] {
  const update: Database['public']['Tables']['account_currencies']['Update'] = {};

  if (data.currencyCode !== undefined) update.currency_code = data.currencyCode;

  return update;
}

/**
 * Transforms domain transaction data to database update format
 */
export function domainTransactionToDbUpdate(data: {
  accountId?: string;
  categoryId?: string | null;
  amountOriginal?: number;
  amountHome?: number;
  currencyOriginal?: string;
  exchangeRate?: number;
  description?: string | null;
  notes?: string | null;
  date?: string;
  transferId?: string | null;
}): Database['public']['Tables']['transactions']['Update'] {
  const update: Database['public']['Tables']['transactions']['Update'] = {};

  if (data.accountId !== undefined) update.account_id = data.accountId;
  if (data.categoryId !== undefined) update.category_id = data.categoryId;
  if (data.amountOriginal !== undefined) update.amount_original = data.amountOriginal;
  if (data.amountHome !== undefined) update.amount_home = data.amountHome;
  if (data.currencyOriginal !== undefined) update.currency_original = data.currencyOriginal;
  if (data.exchangeRate !== undefined) update.exchange_rate = data.exchangeRate;
  if (data.description !== undefined) update.description = data.description;
  if (data.notes !== undefined) update.notes = data.notes;
  if (data.date !== undefined) update.date = data.date;
  if (data.transferId !== undefined) update.transfer_id = data.transferId;

  return update;
}

// ============================================================================
// BATCH TRANSFORMERS
// ============================================================================

/**
 * Transforms an array of database bank_accounts to domain accounts
 */
export function dbAccountsToDomain(
  dbAccounts: Database['public']['Tables']['bank_accounts']['Row'][]
) {
  return dbAccounts.map(dbAccountToDomain);
}

/**
 * Transforms an array of database categories to domain categories
 */
export function dbCategoriesToDomain(
  dbCategories: Database['public']['Tables']['categories']['Row'][]
) {
  return dbCategories.map(dbCategoryToDomain);
}

/**
 * Transforms an array of database global_currencies to domain currencies
 */
export function dbCurrenciesToDomain(
  dbCurrencies: Database['public']['Tables']['global_currencies']['Row'][]
) {
  return dbCurrencies.map(dbCurrencyToDomain);
}

/**
 * Transforms an array of database transactions to domain transactions
 */
export function dbTransactionsToDomain(
  dbTransactions: Database['public']['Tables']['transactions']['Row'][]
) {
  return dbTransactions.map(dbTransactionToDomain);
}

// ============================================================================
// VIEW TRANSFORMERS
// ============================================================================

/**
 * Transforms a database account_balances view row to domain type
 * NOTE: This is a VIEW, not a table. It includes calculated balances.
 */
export function dbAccountBalanceToDomain(
  dbAccountBalance: Database['public']['Views']['account_balances']['Row']
) {
  return {
    id: dbAccountBalance.id,
    accountId: dbAccountBalance.account_id,
    name: dbAccountBalance.name,
    color: dbAccountBalance.color,
    currency: dbAccountBalance.currency,
    isVisible: dbAccountBalance.is_visible,
    startingBalance: dbAccountBalance.starting_balance,
    transactionSum: dbAccountBalance.transaction_sum,
    currentBalance: dbAccountBalance.current_balance,
    userId: dbAccountBalance.user_id,
    createdAt: dbAccountBalance.created_at,
    updatedAt: dbAccountBalance.updated_at,
  } as const;
}

/**
 * Transforms an array of account_balances view rows
 */
export function dbAccountBalancesToDomain(
  dbAccountBalances: Database['public']['Views']['account_balances']['Row'][]
) {
  return dbAccountBalances.map(dbAccountBalanceToDomain);
}

/**
 * Transforms a database transactions_view row to domain type
 * NOTE: This is a VIEW that includes joined data from accounts and categories
 */
export function dbTransactionViewToDomain(
  dbTransactionView: Database['public']['Views']['transactions_view']['Row']
) {
  return {
    id: dbTransactionView.id,
    userId: dbTransactionView.user_id,
    accountId: dbTransactionView.account_id,
    accountName: dbTransactionView.account_name,
    categoryId: dbTransactionView.category_id,
    categoryName: dbTransactionView.category_name,
    categoryColor: dbTransactionView.category_color,
    amountOriginal: dbTransactionView.amount_original,
    amountHome: dbTransactionView.amount_home,
    currencyOriginal: dbTransactionView.currency_original,
    exchangeRate: dbTransactionView.exchange_rate,
    description: dbTransactionView.description,
    notes: dbTransactionView.notes,
    date: dbTransactionView.date,
    createdAt: dbTransactionView.created_at,
    updatedAt: dbTransactionView.updated_at,
  } as const;
}

/**
 * Transforms an array of transactions_view rows
 */
export function dbTransactionViewsToDomain(
  dbTransactionViews: Database['public']['Views']['transactions_view']['Row'][]
) {
  return dbTransactionViews.map(dbTransactionViewToDomain);
}

/**
 * Transforms a database categories_with_counts view row to domain type
 */
export function dbCategoryWithCountToDomain(
  dbCategory: Database['public']['Views']['categories_with_counts']['Row']
) {
  return {
    id: dbCategory.id,
    name: dbCategory.name,
    color: dbCategory.color,
    type: dbCategory.type,
    parentId: dbCategory.parent_id,
    transactionCount: dbCategory.transaction_count,
    userId: dbCategory.user_id,
    createdAt: dbCategory.created_at,
    updatedAt: dbCategory.updated_at,
  } as const;
}

/**
 * Transforms an array of categories_with_counts view rows
 */
export function dbCategoriesWithCountsToDomain(
  dbCategories: Database['public']['Views']['categories_with_counts']['Row'][]
) {
  return dbCategories.map(dbCategoryWithCountToDomain);
}

/**
 * Transforms a database parent_categories_with_counts view row to domain type
 */
export function dbParentCategoryWithCountToDomain(
  dbCategory: Database['public']['Views']['parent_categories_with_counts']['Row']
) {
  return {
    id: dbCategory.id,
    name: dbCategory.name,
    color: dbCategory.color,
    type: dbCategory.type,
    parentId: dbCategory.parent_id,
    transactionCount: dbCategory.transaction_count,
    userId: dbCategory.user_id,
    createdAt: dbCategory.created_at,
    updatedAt: dbCategory.updated_at,
  } as const;
}

/**
 * Transforms an array of parent_categories_with_counts view rows
 */
export function dbParentCategoriesWithCountsToDomain(
  dbCategories: Database['public']['Views']['parent_categories_with_counts']['Row'][]
) {
  return dbCategories.map(dbParentCategoryWithCountToDomain);
}

// ============================================================================
// TYPE GUARDS AND VALIDATORS
// ============================================================================

/**
 * Type guard to check if a type is 'income' or 'expense'
 * NOTE: This is for categories, NOT transactions (transactions don't have a type field)
 */
export function isCategoryType(value: unknown): value is 'income' | 'expense' {
  return value === 'income' || value === 'expense';
}

/**
 * Type guard to check if a value is a valid UUID
 */
export function isValidUUID(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Type guard to check if a value is a valid date string
 */
export function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
}
