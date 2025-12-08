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
 * Transforms a database account row to domain Account type
 */
export function dbAccountToDomain(
  dbAccount: Database['public']['Tables']['accounts']['Row']
) {
  return {
    id: dbAccount.id,
    name: dbAccount.name,
    color: dbAccount.color,
    userId: dbAccount.user_id,
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
 * Transforms a database currency row to domain Currency type
 */
export function dbCurrencyToDomain(
  dbCurrency: Database['public']['Tables']['currencies']['Row']
) {
  return {
    code: dbCurrency.code,
    name: dbCurrency.name,
    symbol: dbCurrency.symbol,
    flag: dbCurrency.flag,
    decimalDigits: dbCurrency.decimal_digits,
  } as const;
}

/**
 * Transforms a database account_currencies row to domain AccountCurrency type
 */
export function dbAccountCurrencyToDomain(
  dbAccountCurrency: Database['public']['Tables']['account_currencies']['Row']
) {
  return {
    id: dbAccountCurrency.id,
    accountId: dbAccountCurrency.account_id,
    currencyCode: dbAccountCurrency.currency_code,
    balance: dbAccountCurrency.balance,
    createdAt: dbAccountCurrency.created_at,
    updatedAt: dbAccountCurrency.updated_at,
  } as const;
}

/**
 * Transforms a database transaction row to domain Transaction type
 */
export function dbTransactionToDomain(
  dbTransaction: Database['public']['Tables']['transactions']['Row']
) {
  return {
    id: dbTransaction.id,
    userId: dbTransaction.user_id,
    type: dbTransaction.type,
    amount: dbTransaction.amount,
    currencyCode: dbTransaction.currency_code,
    categoryId: dbTransaction.category_id,
    subcategoryId: dbTransaction.subcategory_id,
    accountId: dbTransaction.account_id,
    description: dbTransaction.description,
    transactionDate: dbTransaction.transaction_date,
    createdAt: dbTransaction.created_at,
    updatedAt: dbTransaction.updated_at,
  } as const;
}

/**
 * Transforms a database transfer row to domain Transfer type
 */
export function dbTransferToDomain(
  dbTransfer: Database['public']['Tables']['transfers']['Row']
) {
  return {
    id: dbTransfer.id,
    userId: dbTransfer.user_id,
    fromAccountId: dbTransfer.from_account_id,
    toAccountId: dbTransfer.to_account_id,
    fromAmount: dbTransfer.from_amount,
    fromCurrencyCode: dbTransfer.from_currency_code,
    toAmount: dbTransfer.to_amount,
    toCurrencyCode: dbTransfer.to_currency_code,
    exchangeRate: dbTransfer.exchange_rate,
    description: dbTransfer.description,
    transferDate: dbTransfer.transfer_date,
    createdAt: dbTransfer.created_at,
    updatedAt: dbTransfer.updated_at,
  } as const;
}

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
}): Database['public']['Tables']['accounts']['Insert'] {
  return {
    name: data.name,
    color: data.color,
    user_id: data.userId,
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
 */
export function domainAccountCurrencyToDbInsert(data: {
  accountId: string;
  currencyCode: string;
  balance: number;
}): Database['public']['Tables']['account_currencies']['Insert'] {
  return {
    account_id: data.accountId,
    currency_code: data.currencyCode,
    balance: data.balance,
  };
}

/**
 * Transforms domain transaction data to database insert format
 */
export function domainTransactionToDbInsert(data: {
  userId: string;
  type: 'income' | 'expense';
  amount: number;
  currencyCode: string;
  categoryId: string | null;
  subcategoryId: string | null;
  accountId: string;
  description: string | null;
  transactionDate: string;
}): Database['public']['Tables']['transactions']['Insert'] {
  return {
    user_id: data.userId,
    type: data.type,
    amount: data.amount,
    currency_code: data.currencyCode,
    category_id: data.categoryId,
    subcategory_id: data.subcategoryId,
    account_id: data.accountId,
    description: data.description,
    transaction_date: data.transactionDate,
  };
}

/**
 * Transforms domain transfer data to database insert format
 */
export function domainTransferToDbInsert(data: {
  userId: string;
  fromAccountId: string;
  toAccountId: string;
  fromAmount: number;
  fromCurrencyCode: string;
  toAmount: number;
  toCurrencyCode: string;
  exchangeRate: number | null;
  description: string | null;
  transferDate: string;
}): Database['public']['Tables']['transfers']['Insert'] {
  return {
    user_id: data.userId,
    from_account_id: data.fromAccountId,
    to_account_id: data.toAccountId,
    from_amount: data.fromAmount,
    from_currency_code: data.fromCurrencyCode,
    to_amount: data.toAmount,
    to_currency_code: data.toCurrencyCode,
    exchange_rate: data.exchangeRate,
    description: data.description,
    transfer_date: data.transferDate,
  };
}

// ============================================================================
// DOMAIN TO DATABASE UPDATE TRANSFORMERS
// ============================================================================

/**
 * Transforms domain account data to database update format
 */
export function domainAccountToDbUpdate(data: {
  name?: string;
  color?: string;
}): Database['public']['Tables']['accounts']['Update'] {
  const update: Database['public']['Tables']['accounts']['Update'] = {};

  if (data.name !== undefined) update.name = data.name;
  if (data.color !== undefined) update.color = data.color;

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
 */
export function domainAccountCurrencyToDbUpdate(data: {
  balance?: number;
}): Database['public']['Tables']['account_currencies']['Update'] {
  const update: Database['public']['Tables']['account_currencies']['Update'] = {};

  if (data.balance !== undefined) update.balance = data.balance;

  return update;
}

/**
 * Transforms domain transaction data to database update format
 */
export function domainTransactionToDbUpdate(data: {
  type?: 'income' | 'expense';
  amount?: number;
  currencyCode?: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  accountId?: string;
  description?: string | null;
  transactionDate?: string;
}): Database['public']['Tables']['transactions']['Update'] {
  const update: Database['public']['Tables']['transactions']['Update'] = {};

  if (data.type !== undefined) update.type = data.type;
  if (data.amount !== undefined) update.amount = data.amount;
  if (data.currencyCode !== undefined) update.currency_code = data.currencyCode;
  if (data.categoryId !== undefined) update.category_id = data.categoryId;
  if (data.subcategoryId !== undefined) update.subcategory_id = data.subcategoryId;
  if (data.accountId !== undefined) update.account_id = data.accountId;
  if (data.description !== undefined) update.description = data.description;
  if (data.transactionDate !== undefined) update.transaction_date = data.transactionDate;

  return update;
}

// ============================================================================
// BATCH TRANSFORMERS
// ============================================================================

/**
 * Transforms an array of database accounts to domain accounts
 */
export function dbAccountsToDomain(
  dbAccounts: Database['public']['Tables']['accounts']['Row'][]
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
 * Transforms an array of database currencies to domain currencies
 */
export function dbCurrenciesToDomain(
  dbCurrencies: Database['public']['Tables']['currencies']['Row'][]
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
// TYPE GUARDS AND VALIDATORS
// ============================================================================

/**
 * Type guard to check if a type is 'income' or 'expense'
 */
export function isTransactionType(value: unknown): value is 'income' | 'expense' {
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
