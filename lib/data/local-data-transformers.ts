/**
 * Local Data Transformers - WatermelonDB Model → Domain Entity
 *
 * Bridge layer that converts WatermelonDB camelCase models to the same
 * domain entity types produced by the Supabase (remote) transformers
 * in data-transformers.ts.
 *
 * SINGLE INTERFACE RULE (CTO Mandate):
 * Every function here returns the EXACT same domain entity type as its
 * Supabase counterpart. React components never need to know the data source.
 *
 * NULL HANDLING (CTO Mandate):
 * - Missing joined data → null (NEVER magic strings like 'Unknown Account')
 * - Missing optional fields → null (NEVER empty string '')
 * - Critical fields (id, userId) → pass through (NOT NULL in WatermelonDB schema)
 *
 * @module local-data-transformers
 */

import type { AccountModel, CategoryModel, TransactionModel, InboxModel, CurrencyModel } from '@/lib/local-db';
import type { AccountViewEntity } from '@/features/accounts/domain/entities';
import type { CategoryEntity } from '@/features/categories/domain/entities';
import type { TransactionViewEntity } from '@/features/transactions/domain/entities';
import type { InboxItemViewEntity } from '@/features/inbox/domain/entities';

// ============================================================================
// ACCOUNT TRANSFORMERS
// ============================================================================

/**
 * Transforms a WatermelonDB AccountModel to AccountViewEntity.
 *
 * Requires a pre-fetched currency map for batch efficiency (No N+1).
 * The caller is responsible for batch-fetching currencies.
 *
 * @param model - WatermelonDB AccountModel instance
 * @param currencyMap - Map of currency code → CurrencyModel (batch-fetched)
 * @returns AccountViewEntity identical to dbAccountViewToDomain() output
 */
export function localAccountViewToDomain(
  model: AccountModel,
  currencyMap: Map<string, CurrencyModel>
): AccountViewEntity {
  const currency = currencyMap.get(model.currencyCode);

  return {
    id: model.id,
    version: model.version,
    userId: model.userId,
    groupId: model.groupId,
    name: model.name,
    type: model.type,
    currencyCode: model.currencyCode,
    color: model.color,
    currentBalanceCents: Math.round(model.currentBalanceCents),
    isVisible: model.isVisible,
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString(),
    deletedAt: model.deletedAt ? new Date(model.deletedAt).toISOString() : null,
    currencySymbol: currency?.symbol ?? null,
  };
}

/**
 * Batch transform AccountModels to AccountViewEntities.
 */
export function localAccountViewsToDomain(
  models: AccountModel[],
  currencyMap: Map<string, CurrencyModel>
): AccountViewEntity[] {
  return models.map((m) => localAccountViewToDomain(m, currencyMap));
}

// ============================================================================
// CATEGORY TRANSFORMERS
// ============================================================================

/**
 * Transforms a WatermelonDB CategoryModel to CategoryEntity.
 *
 * @param model - WatermelonDB CategoryModel instance
 * @returns CategoryEntity identical to dbCategoryToDomain() output
 */
export function localCategoryToDomain(model: CategoryModel): CategoryEntity {
  return {
    id: model.id,
    // System categories have null userId, user categories have string userId
    // Type assertion needed until CategoryEntity.userId is updated to string | null
    userId: (model.userId ?? null) as CategoryEntity['userId'],
    name: model.name,
    color: model.color,
    type: model.type,
    parentId: model.parentId,
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString(),
    version: model.version,
    deletedAt: model.deletedAt ? new Date(model.deletedAt).toISOString() : null,
  };
}

/**
 * Batch transform CategoryModels to CategoryEntities.
 */
export function localCategoriesToDomain(models: CategoryModel[]): CategoryEntity[] {
  return models.map(localCategoryToDomain);
}

// ============================================================================
// TRANSACTION TRANSFORMERS
// ============================================================================

/**
 * Transforms a WatermelonDB TransactionModel to TransactionViewEntity.
 *
 * Requires pre-fetched account and category maps for batch efficiency (No N+1).
 *
 * CTO MANDATE: Joined display fields use null, NOT magic strings.
 * If the account was deleted or not found → accountName: null (not 'Unknown Account').
 * If currency is missing → currencyOriginal: null (not 'USD').
 *
 * @param model - WatermelonDB TransactionModel instance
 * @param accountMap - Map of account ID → AccountModel (batch-fetched)
 * @param categoryMap - Map of category ID → CategoryModel (batch-fetched)
 * @returns TransactionViewEntity identical to dbTransactionViewToDomain() output
 */
export function localTransactionViewToDomain(
  model: TransactionModel,
  accountMap: Map<string, AccountModel>,
  categoryMap: Map<string, CategoryModel>
): TransactionViewEntity {
  const account = accountMap.get(model.accountId);
  const category = model.categoryId ? categoryMap.get(model.categoryId) : null;

  return {
    id: model.id,
    version: model.version,
    userId: model.userId,
    accountId: model.accountId,
    categoryId: model.categoryId,
    amountCents: Math.round(model.amountCents),
    amountHomeCents: Math.round(model.amountHomeCents),
    currencyOriginal: account?.currencyCode ?? null,
    exchangeRate: model.exchangeRate,
    transferId: model.transferId,
    reconciliationId: model.reconciliationId,
    cleared: model.cleared,
    date: model.date.toISOString(),
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString(),
    deletedAt: model.deletedAt ? new Date(model.deletedAt).toISOString() : null,
    description: model.description,
    notes: model.notes,
    sourceText: model.sourceText ?? null,
    inboxId: model.inboxId ?? null,

    // Joined display fields — null, NOT magic strings
    accountName: account?.name ?? null,
    // REMOVED: accountCurrency (Ghost Prop - use currencyOriginal instead)
    accountColor: account?.color ?? null,
    categoryName: category?.name ?? null,
    categoryColor: category?.color ?? null,
    categoryType: (category?.type as 'income' | 'expense' | 'opening_balance') ?? null,
    reconciliationStatus: null, // TODO: Join reconciliation in Phase 3
  };
}

/**
 * Batch transform TransactionModels to TransactionViewEntities.
 */
export function localTransactionViewsToDomain(
  models: TransactionModel[],
  accountMap: Map<string, AccountModel>,
  categoryMap: Map<string, CategoryModel>
): TransactionViewEntity[] {
  return models.map((m) => localTransactionViewToDomain(m, accountMap, categoryMap));
}

// ============================================================================
// INBOX TRANSFORMERS
// ============================================================================

/**
 * Transforms a WatermelonDB InboxModel to InboxItemViewEntity.
 *
 * Requires pre-fetched maps for batch efficiency (No N+1).
 *
 * @param model - WatermelonDB InboxModel instance
 * @param accountMap - Map of account ID → AccountModel (batch-fetched)
 * @param categoryMap - Map of category ID → CategoryModel (batch-fetched)
 * @param currencyMap - Map of currency code → CurrencyModel (batch-fetched)
 * @returns InboxItemViewEntity identical to dbInboxItemViewToDomain() output
 */
export function localInboxItemViewToDomain(
  model: InboxModel,
  accountMap: Map<string, AccountModel>,
  categoryMap: Map<string, CategoryModel>,
  currencyMap: Map<string, CurrencyModel>
): InboxItemViewEntity {
  const account = model.accountId ? accountMap.get(model.accountId) : null;
  const category = model.categoryId ? categoryMap.get(model.categoryId) : null;
  const currency = account ? currencyMap.get(account.currencyCode) : null;

  const entity: InboxItemViewEntity = {
    id: model.id,
    userId: model.userId,
    amountCents: model.amountCents !== null ? Math.round(model.amountCents) : null,
    currencyCode: account?.currencyCode ?? null,
    description: model.description,
    date: model.date?.toISOString() ?? null,
    sourceText: model.sourceText,
    accountId: model.accountId,
    categoryId: model.categoryId,
    exchangeRate: model.exchangeRate,
    notes: model.notes,
    status: model.status,
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString(),
    version: model.version,
    deletedAt: model.deletedAt ? new Date(model.deletedAt).toISOString() : null,

    // Joined display data — null for missing, not magic strings
    account: account ? {
      id: account.id,
      name: account.name,
      currencyCode: account.currencyCode,
      currencySymbol: currency?.symbol ?? null,
    } : undefined,
    category: category ? {
      id: category.id,
      name: category.name,
      color: category.color,
    } : undefined,
  };

  return entity;
}

/**
 * Batch transform InboxModels to InboxItemViewEntities.
 */
export function localInboxItemViewsToDomain(
  models: InboxModel[],
  accountMap: Map<string, AccountModel>,
  categoryMap: Map<string, CategoryModel>,
  currencyMap: Map<string, CurrencyModel>
): InboxItemViewEntity[] {
  return models.map((m) => localInboxItemViewToDomain(m, accountMap, categoryMap, currencyMap));
}
