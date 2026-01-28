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

import type { Database } from '@/types/supabase';
import type {
  Category,
  CategoryWithCount,
  ParentCategoryWithCount,

  UserSettings,
  Reconciliation,
  ReconciliationStatus,
  ReconciliationSummary,
} from '@/types/domain';
import type { InboxItemViewEntity } from '@/features/inbox/domain/entities';
import type { AccountViewEntity } from '@/features/accounts/domain/entities';
import type { TransactionViewEntity } from '@/features/transactions/domain/entities';
import { toSafeInteger, toSafeIntegerOrZero } from '@/lib/utils/bigint-safety';
import { toCents } from '@/lib/utils/cents-conversion';

// ============================================================================
// DATABASE TO DOMAIN TRANSFORMERS
// ============================================================================

/**
 * Transforms a database bank_accounts row to domain Account type
 * NEW: Includes groupId, currencyCode, and type
 *
 * SYNC FIELDS (Phase 2a):
 * - version: Optimistic concurrency control via global_transaction_version
 * - deletedAt: Tombstone pattern for distributed sync
 */
export function dbAccountToDomain(
  dbAccount: Database['public']['Tables']['bank_accounts']['Row']
) {
  // Type assertion for sync fields added by migration 20260126000000
  const syncRow = dbAccount as typeof dbAccount & {
    version?: number;
    deleted_at?: string | null;
  };

  return {
    id: dbAccount.id,
    version: syncRow.version ?? 1,
    groupId: dbAccount.group_id,
    name: dbAccount.name,
    color: dbAccount.color,
    currencyCode: dbAccount.currency_code,
    type: dbAccount.type,
    userId: dbAccount.user_id,
    isVisible: dbAccount.is_visible,
    createdAt: dbAccount.created_at,
    updatedAt: dbAccount.updated_at,
    deletedAt: syncRow.deleted_at ?? null,
  } as const;
}

/**
 * Transforms a database category row to domain Category type
 *
 * SYNC FIELDS (Phase 2a):
 * - version: Optimistic concurrency control via global_transaction_version
 * - deletedAt: Tombstone pattern for distributed sync
 */
export function dbCategoryToDomain(
  dbCategory: Database['public']['Tables']['categories']['Row']
): Category {
  // Type assertion for sync fields added by migration 20260126000001
  const syncRow = dbCategory as typeof dbCategory & {
    version?: number;
    deleted_at?: string | null;
  };

  return {
    id: dbCategory.id,
    version: syncRow.version ?? 1,
    name: dbCategory.name,
    color: dbCategory.color,
    type: dbCategory.type as 'income' | 'expense',
    parentId: dbCategory.parent_id,
    userId: dbCategory.user_id,
    createdAt: dbCategory.created_at,
    updatedAt: dbCategory.updated_at,
    deletedAt: syncRow.deleted_at ?? null,
  };
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

// NOTE: account_balances view was removed in migration 20251229013916_drop_redundant_account_balances_view.sql
// The view was replaced with direct queries to bank_accounts table for O(1) performance.
// If you need account balance data, query bank_accounts directly (see accountsApi.getAll()).

/**
 * Transforms a database transaction_inbox row to domain InboxItemViewEntity type
 *
 * WARNING: This transformer is for RAW TABLE rows only.
 * currencyCode will be null because the table doesn't have currency.
 * For display with currency, use dbInboxItemViewToDomain() with transaction_inbox_view.
 *
 * CTO MANDATE: Critical fields (id, user_id) must throw on null - table columns are NOT NULL
 */
export function dbInboxItemToDomain(
  dbInboxItem: Database['public']['Tables']['transaction_inbox']['Row']
): InboxItemViewEntity {
  // Table has NOT NULL constraints on id and user_id, but TypeScript doesn't know that
  // These checks are defensive and should never throw in practice
  if (!dbInboxItem.id) {
    throw new Error('InboxItemEntity: id cannot be null - database constraint violation');
  }
  if (!dbInboxItem.user_id) {
    throw new Error('InboxItemEntity: user_id cannot be null - database constraint violation');
  }

  return {
    id: dbInboxItem.id,
    userId: dbInboxItem.user_id,
    amountCents: toSafeInteger(dbInboxItem.amount_cents),  // BIGINT → safe number
    currencyCode: null,  // Not available from raw table - use view for currency
    description: dbInboxItem.description,
    date: dbInboxItem.date,
    sourceText: dbInboxItem.source_text,
    accountId: dbInboxItem.account_id,
    categoryId: dbInboxItem.category_id,
    exchangeRate: dbInboxItem.exchange_rate,
    notes: dbInboxItem.notes,
    status: (dbInboxItem.status ?? 'pending') as 'pending' | 'processed' | 'ignored',
    createdAt: dbInboxItem.created_at ?? new Date().toISOString(),
    updatedAt: dbInboxItem.updated_at ?? new Date().toISOString(),
    version: (dbInboxItem as any).version ?? 1,
    deletedAt: (dbInboxItem as any).deleted_at ?? null,
  };
}

/**
 * Transforms a database transaction_inbox_view row to domain InboxItemViewEntity type
 * VIEW TRANSFORMER: Includes currency from account JOIN and display fields
 * Use this for UI display - it has complete data including currencyCode from account
 *
 * CTO MANDATE: All optional fields use null (not undefined) for iOS Swift compatibility
 * CTO MANDATE: Critical fields (id, userId) must throw on null - no magic fallbacks
 *
 * @throws Error if id or userId is null (data integrity failure)
 */
export function dbInboxItemViewToDomain(
  dbInboxItemView: Database['public']['Views']['transaction_inbox_view']['Row']
): InboxItemViewEntity {
  // CTO MANDATE: Critical fields must throw on null - no magic fallbacks
  if (!dbInboxItemView.id) {
    throw new Error('InboxItemViewEntity: id cannot be null - data integrity failure');
  }
  if (!dbInboxItemView.user_id) {
    throw new Error('InboxItemViewEntity: user_id cannot be null - data integrity failure');
  }

  return {
    id: dbInboxItemView.id,
    userId: dbInboxItemView.user_id,
    amountCents: toSafeInteger(dbInboxItemView.amount_cents),  // BIGINT → safe number
    currencyCode: dbInboxItemView.currency_original ?? null,  // From view alias (bank_accounts.currency_code)
    description: dbInboxItemView.description ?? null,
    date: dbInboxItemView.date ?? null,
    sourceText: dbInboxItemView.source_text ?? null,
    accountId: dbInboxItemView.account_id ?? null,
    categoryId: dbInboxItemView.category_id ?? null,
    exchangeRate: dbInboxItemView.exchange_rate ?? null,
    notes: dbInboxItemView.notes ?? null,
    status: (dbInboxItemView.status ?? 'pending') as 'pending' | 'processed' | 'ignored',
    createdAt: dbInboxItemView.created_at ?? new Date().toISOString(),  // Fallback to now if missing
    updatedAt: dbInboxItemView.updated_at ?? new Date().toISOString(),  // Fallback to now if missing
    version: (dbInboxItemView as any).version ?? 1,
    deletedAt: (dbInboxItemView as any).deleted_at ?? null,

    // Joined display data (from view columns) - these use undefined for "not present"
    // This is valid because the entity type declares these as optional
    account: dbInboxItemView.account_id ? {
      id: dbInboxItemView.account_id,
      name: dbInboxItemView.account_name ?? null,
      currencyCode: dbInboxItemView.currency_original ?? null,
      currencySymbol: null,
    } : undefined,
    category: dbInboxItemView.category_id ? {
      id: dbInboxItemView.category_id,
      name: dbInboxItemView.category_name ?? null,
      color: dbInboxItemView.category_color ?? null,
    } : undefined,
  };
}

/**
 * Transforms an array of transaction_inbox_view rows
 */
export function dbInboxItemViewsToDomain(
  dbInboxItemViews: Database['public']['Views']['transaction_inbox_view']['Row'][]
): InboxItemViewEntity[] {
  return dbInboxItemViews.map(dbInboxItemViewToDomain);
}

/**
 * Transforms a database transaction row to domain Transaction type
 * NOTE: currency_original removed from table - now derived from account via transactions_view
 * This transformer is for raw table rows only. Use transactions_view for currency access.
 */
export function dbTransactionToDomain(
  dbTransaction: Database['public']['Tables']['transactions']['Row']
) {
  return {
    id: dbTransaction.id,
    userId: dbTransaction.user_id,
    accountId: dbTransaction.account_id,
    categoryId: dbTransaction.category_id,
    amountCents: toSafeIntegerOrZero(dbTransaction.amount_cents),        // BIGINT → safe number
    amountHomeCents: toSafeIntegerOrZero(dbTransaction.amount_home_cents), // BIGINT → safe number
    // NOTE: currency_original removed from table - now derived from account via transactions_view
    currencyOriginal: undefined as any,  // REMOVED from table schema - use transactions_view instead
    exchangeRate: dbTransaction.exchange_rate,
    description: dbTransaction.description,
    notes: dbTransaction.notes,
    sourceText: dbTransaction.source_text ?? undefined,  // NEW: null → undefined
    date: dbTransaction.date,
    transferId: dbTransaction.transfer_id,
    inboxId: dbTransaction.inbox_id ?? undefined,        // NEW: null → undefined
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
// VIEW TRANSFORMERS (Joined Data)
// ============================================================================

/**
 * Database row type for bank_accounts with joined global_currencies
 */
type DbAccountViewRow = Database['public']['Tables']['bank_accounts']['Row'] & {
  global_currencies: { symbol: string } | null;
};

/**
 * Transforms a database bank_accounts row (with global_currencies JOIN) to AccountViewEntity
 *
 * CTO MANDATE: No magic display defaults in data layer.
 * - currencySymbol: null if JOIN failed (not '' or '$')
 * - id, userId, groupId: pass through (NOT NULL in schema)
 *
 * SYNC FIELDS (Phase 2a):
 * - version: Optimistic concurrency control
 * - deletedAt: Tombstone pattern
 */
export function dbAccountViewToDomain(
  dbRow: DbAccountViewRow
): AccountViewEntity {
  const syncRow = dbRow as DbAccountViewRow & {
    version?: number;
    deleted_at?: string | null;
  };

  return {
    id: dbRow.id,
    version: syncRow.version ?? 1,
    userId: dbRow.user_id,
    groupId: dbRow.group_id,
    name: dbRow.name,
    type: dbRow.type as AccountViewEntity['type'],
    currencyCode: dbRow.currency_code,
    color: dbRow.color,
    currentBalanceCents: toCents(dbRow.current_balance),
    isVisible: dbRow.is_visible,
    createdAt: dbRow.created_at,
    updatedAt: dbRow.updated_at,
    deletedAt: syncRow.deleted_at ?? null,
    currencySymbol: dbRow.global_currencies?.symbol ?? null,
  };
}

/**
 * Transforms an array of bank_accounts rows (with JOIN) to AccountViewEntity[]
 */
export function dbAccountViewsToDomain(
  dbRows: DbAccountViewRow[]
): AccountViewEntity[] {
  return dbRows.map(dbAccountViewToDomain);
}

/**
 * Transforms a database transactions_view row to TransactionViewEntity
 *
 * CTO MANDATE: Strict integrity on critical fields.
 * - id, userId: THROW if null (data integrity failure, matches inbox pattern)
 * - Joined display fields: null (NOT magic strings like 'Unknown Account')
 * - Amounts: Direct BIGINT pass-through via Number()
 *
 * @throws Error if id or userId is null
 */
export function dbTransactionViewToDomain(
  dbView: Database['public']['Views']['transactions_view']['Row']
): TransactionViewEntity {
  if (!dbView.id) {
    throw new Error('TransactionViewEntity: id cannot be null - data integrity failure');
  }
  if (!dbView.user_id) {
    throw new Error('TransactionViewEntity: user_id cannot be null - data integrity failure');
  }

  return {
    id: dbView.id,
    version: dbView.version ?? 1,
    userId: dbView.user_id,
    accountId: dbView.account_id ?? '',
    categoryId: dbView.category_id ?? null,

    // SACRED INTEGER ARITHMETIC: Direct BIGINT pass-through
    amountCents: Number(dbView.amount_cents ?? 0),
    amountHomeCents: Number(dbView.amount_home_cents ?? 0),

    // Currency and exchange
    currencyOriginal: dbView.currency_original ?? null as any,
    exchangeRate: Number(dbView.exchange_rate ?? 1),

    // Transfer and reconciliation
    transferId: dbView.transfer_id ?? null,
    reconciliationId: dbView.reconciliation_id ?? null,
    cleared: dbView.cleared ?? false,

    // Dates
    date: dbView.date ?? new Date().toISOString(),
    createdAt: dbView.created_at ?? new Date().toISOString(),
    updatedAt: dbView.updated_at ?? new Date().toISOString(),
    deletedAt: dbView.deleted_at ?? null,

    // Text fields
    description: dbView.description ?? null,
    notes: dbView.notes ?? null,
    sourceText: dbView.source_text ?? null,
    inboxId: dbView.inbox_id ?? null,

    // Joined display fields — null, NOT magic strings
    accountName: dbView.account_name ?? null,
    accountCurrency: dbView.account_currency ?? null,
    accountColor: dbView.account_color ?? null,
    categoryName: dbView.category_name ?? null,
    categoryColor: dbView.category_color ?? null,
    categoryType: (dbView.category_type as 'income' | 'expense' | 'opening_balance' | null) ?? null,
    reconciliationStatus: (dbView.reconciliation_status as 'draft' | 'completed' | null) ?? null,
  };
}

/**
 * Transforms an array of transactions_view rows
 */
export function dbTransactionViewsToDomain(
  dbViews: Database['public']['Views']['transactions_view']['Row'][]
): TransactionViewEntity[] {
  return dbViews.map(dbTransactionViewToDomain);
}

// ============================================================================
// DOMAIN TO DATABASE INSERT TRANSFORMERS
// ============================================================================

/**
 * Transforms domain account data to database insert format
 * TODO: DEPRECATED - Use create_account_group RPC instead (container pattern)
 * This function is for old schema where accounts could be created without currency
 */
// export function domainAccountToDbInsert(data: {
//   name: string;
//   color: string;
//   userId: string;
//   isVisible?: boolean;
// }): Database['public']['Tables']['bank_accounts']['Insert'] {
//   return {
//     name: data.name,
//     color: data.color,
//     user_id: data.userId,
//     is_visible: data.isVisible,
//     // currency_code: MISSING - Required in new schema
//     // group_id: MISSING - Required in new schema
//     // type: MISSING - Required in new schema
//   };
// }

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
 * Transforms domain inbox item data to database insert format
 * SCRATCHPAD MODE: amount and description are now optional
 * Converts undefined → null for database storage
 * NOTE: currency_original removed from table - now derived from account via transaction_inbox_view
 */
export function domainInboxItemToDbInsert(data: {
  userId: string;
  amountCents?: number;         // Optional for scratchpad mode - INTEGER CENTS
  // currencyOriginal removed - derived from account via view
  description?: string;            // Optional for scratchpad mode
  date?: string;
  sourceText?: string;
  accountId?: string;
  categoryId?: string;
  exchangeRate?: number;
  notes?: string;
  status?: 'pending' | 'processed' | 'ignored';
}): Database['public']['Tables']['transaction_inbox']['Insert'] {
  return {
    user_id: data.userId,
    amount_cents: data.amountCents ?? null,
    // currency_original: REMOVED - now derived from account_id via JOIN in transaction_inbox_view
    description: data.description ?? null,           // undefined → null for database
    date: data.date ?? null,                         // undefined → null for database
    source_text: data.sourceText ?? null,            // undefined → null for database
    account_id: data.accountId ?? null,              // undefined → null for database
    category_id: data.categoryId ?? null,            // undefined → null for database
    exchange_rate: data.exchangeRate ?? null,        // undefined → null for database
    notes: data.notes ?? null,                       // NEW: undefined → null for database
    status: data.status,
  };
}

/**
 * Transforms domain account currency data to database insert format
 * TODO: DEPRECATED - account_currencies table no longer exists (container pattern)
 * Use create_account_group RPC to create account rows with currencies
 */
// export function domainAccountCurrencyToDbInsert(data: {
//   accountId: string;
//   currencyCode: string;
// }): Database['public']['Tables']['account_currencies']['Insert'] {
//   return {
//     account_id: data.accountId,
//     currency_code: data.currencyCode,
//   };
// }

/**
 * Transforms domain transaction data to database insert format
 * NOTE: currency_original removed from table - now derived from account via transactions_view
 * Do NOT use this for direct inserts - use RPC functions instead (create_transfer, promote_inbox_item, import_transactions)
 */
export function domainTransactionToDbInsert(data: {
  userId: string;
  accountId: string;
  categoryId: string | null;
  amountCents: number;
  amountHomeCents: number;
  // currencyOriginal removed - derived from account via view
  exchangeRate: number;
  description: string | null;
  notes: string | null;
  sourceText?: string | null;  // NEW
  date: string;
  transferId?: string | null;
  inboxId?: string | null;     // NEW
}): Database['public']['Tables']['transactions']['Insert'] {
  return {
    user_id: data.userId,
    account_id: data.accountId,
    category_id: data.categoryId,
    amount_cents: data.amountCents,        // INTEGER CENTS → BIGINT (direct pass-through)
    amount_home_cents: data.amountHomeCents,  // INTEGER CENTS → BIGINT (direct pass-through)
    // currency_original: REMOVED - now derived from account_id via JOIN in transactions_view
    exchange_rate: data.exchangeRate,
    description: data.description,
    notes: data.notes,
    source_text: data.sourceText,  // NEW
    date: data.date,
    transfer_id: data.transferId,
    inbox_id: data.inboxId,        // NEW
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
 * TODO: DEPRECATED - account_currencies table no longer exists (container pattern)
 */
// export function domainAccountCurrencyToDbUpdate(data: {
//   currencyCode?: string;
// }): Database['public']['Tables']['account_currencies']['Update'] {
//   const update: Database['public']['Tables']['account_currencies']['Update'] = {};
//   if (data.currencyCode !== undefined) update.currency_code = data.currencyCode;
//   return update;
// }

/**
 * Transforms domain transaction data to database update format
 * NOTE: currency_original removed from table - now derived from account via transactions_view
 */
export function domainTransactionToDbUpdate(data: {
  accountId?: string;
  categoryId?: string | null;
  amountCents?: number;
  amountHomeCents?: number;
  // currencyOriginal removed - derived from account via view
  exchangeRate?: number;
  description?: string | null;
  notes?: string | null;
  date?: string;
  transferId?: string | null;
}): Database['public']['Tables']['transactions']['Update'] {
  const update: Database['public']['Tables']['transactions']['Update'] = {};

  if (data.accountId !== undefined) update.account_id = data.accountId;
  if (data.categoryId !== undefined) update.category_id = data.categoryId;
  if (data.amountCents !== undefined) update.amount_cents = data.amountCents;             // INTEGER CENTS → BIGINT
  if (data.amountHomeCents !== undefined) update.amount_home_cents = data.amountHomeCents; // INTEGER CENTS → BIGINT
  // currency_original: REMOVED - now derived from account_id via JOIN in transactions_view
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
 * Transforms an array of database transaction_inbox items to domain inbox items
 */
export function dbInboxItemsToDomain(
  dbInboxItems: Database['public']['Tables']['transaction_inbox']['Row'][]
): InboxItemViewEntity[] {
  return dbInboxItems.map(dbInboxItemToDomain);
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
 * NOTE: categories_with_counts view is incomplete (missing color, userId, createdAt, updatedAt)
 * Use dbCategoryToDomain with categories table instead
 */
// Removed dbCategoryWithCountToDomain and dbCategoriesWithCountsToDomain
// since the view is missing critical fields

/**
 * Transforms a database parent_categories_with_counts view row to domain type
 *
 * SYNC FIELDS (Phase 2a):
 * - version: Optimistic concurrency control via global_transaction_version
 * - deletedAt: Tombstone pattern for distributed sync
 */
export function dbParentCategoryWithCountToDomain(
  dbCategory: Database['public']['Views']['parent_categories_with_counts']['Row']
): ParentCategoryWithCount {
  // Type assertion for sync fields added by migration 20260126000001
  const syncRow = dbCategory as typeof dbCategory & {
    version?: number;
    deleted_at?: string | null;
  };

  return {
    id: dbCategory.id || '',
    version: syncRow.version ?? 1,
    name: dbCategory.name || null,
    color: dbCategory.color || null,
    type: (dbCategory.type as 'income' | 'expense') || 'expense',
    parentId: dbCategory.parent_id,
    transactionCount: dbCategory.transaction_count ?? 0,
    userId: dbCategory.user_id,
    createdAt: dbCategory.created_at || new Date().toISOString(),
    updatedAt: dbCategory.updated_at || new Date().toISOString(),
    deletedAt: syncRow.deleted_at ?? null,
  };
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

/**
 * Transforms a database user_settings row to domain UserSettings type
 */
export function dbUserSettingsToDomain(
  dbSettings: Database['public']['Tables']['user_settings']['Row']
): UserSettings {
  return {
    userId: dbSettings.user_id,
    mainCurrency: dbSettings.main_currency,
    startOfWeek: dbSettings.start_of_week,
    theme: dbSettings.theme,
    transactionSortPreference: dbSettings.transaction_sort_preference as 'date' | 'created_at',
    createdAt: dbSettings.created_at,
    updatedAt: dbSettings.updated_at,
  };
}

// ============================================================================
// RECONCILIATION TRANSFORMERS
// ============================================================================

/**
 * Transforms a database reconciliations row to domain Reconciliation type
 */
export function dbReconciliationToDomain(
  dbReconciliation: Database['public']['Tables']['reconciliations']['Row']
): Reconciliation {
  return {
    id: dbReconciliation.id,
    userId: dbReconciliation.user_id,
    accountId: dbReconciliation.account_id,
    name: dbReconciliation.name,
    beginningBalance: toSafeIntegerOrZero(dbReconciliation.beginning_balance),  // BIGINT → safe number
    endingBalance: toSafeIntegerOrZero(dbReconciliation.ending_balance),        // BIGINT → safe number
    dateStart: dbReconciliation.date_start,
    dateEnd: dbReconciliation.date_end,
    status: dbReconciliation.status as ReconciliationStatus,
    createdAt: dbReconciliation.created_at,
    updatedAt: dbReconciliation.updated_at,
  };
}

/**
 * Transforms an array of reconciliations
 */
export function dbReconciliationsToDomain(
  dbReconciliations: Database['public']['Tables']['reconciliations']['Row'][]
): Reconciliation[] {
  return dbReconciliations.map(dbReconciliationToDomain);
}

/**
 * Transforms domain reconciliation data to database insert format
 */
export function domainReconciliationToDbInsert(data: {
  userId: string;
  accountId: string;
  name: string;
  beginningBalance: number;
  endingBalance: number;
  dateStart?: string | null;
  dateEnd?: string | null;
  status?: ReconciliationStatus;
}): Database['public']['Tables']['reconciliations']['Insert'] {
  return {
    user_id: data.userId,
    account_id: data.accountId,
    name: data.name,
    beginning_balance: data.beginningBalance,
    ending_balance: data.endingBalance,
    date_start: data.dateStart ?? null,
    date_end: data.dateEnd ?? null,
    status: data.status,
  };
}

/**
 * Transforms domain reconciliation data to database update format
 */
export function domainReconciliationToDbUpdate(data: {
  name?: string;
  beginningBalance?: number;
  endingBalance?: number;
  dateStart?: string | null;
  dateEnd?: string | null;
  status?: ReconciliationStatus;
}): Database['public']['Tables']['reconciliations']['Update'] {
  const update: Database['public']['Tables']['reconciliations']['Update'] = {};

  if (data.name !== undefined) update.name = data.name;
  if (data.beginningBalance !== undefined) update.beginning_balance = data.beginningBalance;
  if (data.endingBalance !== undefined) update.ending_balance = data.endingBalance;
  if (data.dateStart !== undefined) update.date_start = data.dateStart;
  if (data.dateEnd !== undefined) update.date_end = data.dateEnd;
  if (data.status !== undefined) update.status = data.status;

  return update;
}

/**
 * Transforms RPC reconciliation summary to domain type
 * The RPC returns JSONB, so we need to handle the transformation carefully
 */
export function dbReconciliationSummaryToDomain(
  dbSummary: any  // JSONB from RPC - not strictly typed
): ReconciliationSummary {
  return {
    beginningBalance: Number(dbSummary.beginningBalance),
    endingBalance: Number(dbSummary.endingBalance),
    linkedSum: Number(dbSummary.linkedSum),
    linkedCount: Number(dbSummary.linkedCount),
    difference: Number(dbSummary.difference),
    isBalanced: Boolean(dbSummary.isBalanced),
  };
}
