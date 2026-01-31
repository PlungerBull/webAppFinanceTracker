/**
 * React Query Cache Type Utilities
 *
 * Type-safe wrappers for setQueryData callbacks to eliminate `any` types.
 *
 * CTO MANDATE: No `any` in query cache operations - data integrity matters.
 *
 * @module query/cache-types
 */

import type { TransactionViewEntity } from '@/features/transactions/domain/entities';
import type { AccountViewEntity } from '@/domain/accounts';

// ============================================================================
// INFINITE QUERY CACHE SHAPES
// ============================================================================

/**
 * Standard infinite query page structure
 */
export interface InfinitePage<T> {
  data: T[];
  count: number;
}

/**
 * Infinite query cache structure
 */
export interface InfiniteQueryData<T> {
  pages: InfinitePage<T>[];
  pageParams: number[];
}

/**
 * Transaction infinite query cache type
 */
export type TransactionInfiniteCache = InfiniteQueryData<TransactionViewEntity>;

// ============================================================================
// LIST QUERY CACHE SHAPES
// ============================================================================

/**
 * Accounts list cache type
 */
export type AccountsCache = AccountViewEntity[];

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if cache data exists
 */
export function hasData<T>(cache: T | undefined): cache is T {
  return cache !== undefined && cache !== null;
}

// ============================================================================
// TRANSACTION CACHE UPDATERS
// ============================================================================

/**
 * Create a type-safe transaction page updater
 */
export function updateTransactionPages(
  cache: TransactionInfiniteCache | undefined,
  updater: (
    pages: InfinitePage<TransactionViewEntity>[]
  ) => InfinitePage<TransactionViewEntity>[]
): TransactionInfiniteCache | undefined {
  if (!hasData(cache)) return cache;

  return {
    ...cache,
    pages: updater(cache.pages),
  };
}

/**
 * Add transaction to first page (for optimistic create)
 */
export function prependTransaction(
  cache: TransactionInfiniteCache | undefined,
  transaction: TransactionViewEntity
): TransactionInfiniteCache | undefined {
  return updateTransactionPages(cache, (pages) => {
    if (pages.length === 0) return pages;

    return [
      {
        ...pages[0],
        data: [transaction, ...pages[0].data],
        count: pages[0].count + 1,
      },
      ...pages.slice(1),
    ];
  });
}

/**
 * Update a specific transaction in cache
 */
export function updateTransactionInCache(
  cache: TransactionInfiniteCache | undefined,
  id: string,
  updates: Partial<TransactionViewEntity>
): TransactionInfiniteCache | undefined {
  return updateTransactionPages(cache, (pages) =>
    pages.map((page) => ({
      ...page,
      data: page.data.map((txn) =>
        txn.id === id ? { ...txn, ...updates } : txn
      ),
    }))
  );
}

/**
 * Remove a transaction from cache (for optimistic delete)
 */
export function removeTransactionFromCache(
  cache: TransactionInfiniteCache | undefined,
  id: string
): TransactionInfiniteCache | undefined {
  return updateTransactionPages(cache, (pages) =>
    pages.map((page) => ({
      ...page,
      data: page.data.filter((txn) => txn.id !== id),
      count: Math.max(0, page.count - 1),
    }))
  );
}

// ============================================================================
// ACCOUNT CACHE UPDATERS
// ============================================================================

/**
 * Create a type-safe accounts list updater
 */
export function updateAccounts(
  cache: AccountsCache | undefined,
  updater: (accounts: AccountViewEntity[]) => AccountViewEntity[]
): AccountsCache | undefined {
  if (!hasData(cache)) return cache;

  return updater(cache);
}

/**
 * Update account balance in cache
 */
export function updateAccountBalance(
  cache: AccountsCache | undefined,
  accountId: string,
  deltaCents: number
): AccountsCache | undefined {
  return updateAccounts(cache, (accounts) =>
    accounts.map((account) =>
      account.id === accountId
        ? {
            ...account,
            currentBalanceCents: account.currentBalanceCents + deltaCents,
          }
        : account
    )
  );
}

/**
 * Find account in cache by ID
 */
export function findAccountInCache(
  cache: AccountsCache | undefined,
  accountId: string
): AccountViewEntity | undefined {
  if (!hasData(cache)) return undefined;
  return cache.find((account) => account.id === accountId);
}
