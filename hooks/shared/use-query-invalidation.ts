import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/lib/constants';

/**
 * Centralized query invalidation utilities
 * Eliminates 24+ manual invalidation calls across 8 files
 *
 * @returns Object with various invalidation methods
 *
 * @example
 * ```tsx
 * const { invalidateAccounts, invalidateAll } = useQueryInvalidation();
 *
 * // After creating an account
 * await invalidateAccounts();
 *
 * // After clearing all data
 * await invalidateAll();
 * ```
 */
export function useQueryInvalidation() {
  const queryClient = useQueryClient();

  /**
   * Invalidate all data queries
   * Use after operations that affect multiple entities (e.g., data import, clear all)
   */
  const invalidateAll = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRANSACTIONS.ALL }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CURRENCIES }),
    ]);
  }, [queryClient]);

  /**
   * Invalidate account-related queries
   * Use after creating, updating, or deleting accounts
   */
  const invalidateAccounts = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNT_CURRENCIES() }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRANSACTIONS.ALL }),
    ]);
  }, [queryClient]);

  /**
   * Invalidate category-related queries
   * Use after creating, updating, or deleting categories
   */
  const invalidateCategories = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRANSACTIONS.ALL }),
    ]);
  }, [queryClient]);

  /**
   * Invalidate transaction-related queries
   * Use after creating, updating, or deleting transactions
   */
  const invalidateTransactions = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRANSACTIONS.ALL }),
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.TRANSACTIONS.MONTHLY_SPENDING(6),
      }),
    ]);
  }, [queryClient]);

  /**
   * Invalidate currency-related queries
   * Use after adding or removing currencies
   */
  const invalidateCurrencies = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CURRENCIES }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNT_CURRENCIES() }),
    ]);
  }, [queryClient]);

  /**
   * Invalidate a specific account's currencies
   * Use after modifying currencies for a specific account
   */
  const invalidateAccountCurrencies = useCallback(
    async (accountId?: string) => {
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.ACCOUNT_CURRENCIES(accountId),
      });
    },
    [queryClient]
  );

  return {
    invalidateAll,
    invalidateAccounts,
    invalidateCategories,
    invalidateTransactions,
    invalidateCurrencies,
    invalidateAccountCurrencies,
  };
}

/**
 * Return type for useQueryInvalidation hook
 */
export type UseQueryInvalidationReturn = {
  invalidateAll: () => Promise<void>;
  invalidateAccounts: () => Promise<void>;
  invalidateCategories: () => Promise<void>;
  invalidateTransactions: () => Promise<void>;
  invalidateCurrencies: () => Promise<void>;
  invalidateAccountCurrencies: (accountId?: string) => Promise<void>;
};
