/**
 * Reference Data Orchestrator Hook
 *
 * Provides cross-feature reference data (accounts, categories, currencies)
 * without creating feature-to-feature coupling.
 *
 * This hook is the "Orchestrator" for shared data that multiple features need.
 * Components use this instead of importing directly from feature hooks.
 *
 * ARCHITECTURE PATTERN:
 * - Components import from @/lib/hooks/use-reference-data
 * - This hook internally uses feature hooks (allowed for lib/)
 * - Features never import from other features
 *
 * @module lib/hooks/use-reference-data
 */

import { useQuery } from '@tanstack/react-query';
import { QUERY_CONFIG, QUERY_KEYS } from '@/lib/constants';
import type { AccountViewEntity } from '@/domain/accounts';
import type { LeafCategoryEntity } from '@/domain/categories';
import type { Currency } from '@/types/domain';

// Import feature hooks - allowed in lib/ as the orchestration layer
import { useAccounts } from '@/features/accounts/hooks/use-accounts';
import { useLeafCategoriesQuery } from '@/features/categories/hooks/use-categories';
import { currenciesApi } from '@/features/currencies/api/currencies';

/**
 * Reference data shape returned by the hook
 */
export interface ReferenceData {
  /** All accounts with view data */
  accounts: AccountViewEntity[];
  /** Leaf categories (assignable to transactions) */
  categories: LeafCategoryEntity[];
  /** Global currencies list */
  currencies: Currency[];
  /** Combined loading state */
  isLoading: boolean;
  /** Whether accounts are loading */
  isLoadingAccounts: boolean;
  /** Whether categories are loading */
  isLoadingCategories: boolean;
  /** Whether currencies are loading */
  isLoadingCurrencies: boolean;
}

/**
 * Orchestrator hook for cross-feature reference data.
 *
 * Provides accounts, categories, and currencies without feature coupling.
 * Use this in components that need reference data from multiple features.
 *
 * @example
 * ```typescript
 * function TransactionForm() {
 *   const { accounts, categories, isLoading } = useReferenceData();
 *
 *   if (isLoading) return <Loading />;
 *
 *   return (
 *     <form>
 *       <AccountSelector accounts={accounts} />
 *       <CategorySelector categories={categories} />
 *     </form>
 *   );
 * }
 * ```
 */
export function useReferenceData(): ReferenceData {
  // Accounts
  const {
    data: accounts = [],
    isLoading: isLoadingAccounts,
  } = useAccounts();

  // Categories (leaf only - assignable to transactions)
  const {
    data: categories = [],
    isLoading: isLoadingCategories,
  } = useLeafCategoriesQuery();

  // Currencies
  const {
    data: currencies = [],
    isLoading: isLoadingCurrencies,
  } = useQuery({
    queryKey: QUERY_KEYS.CURRENCIES,
    queryFn: currenciesApi.getAll,
    staleTime: QUERY_CONFIG.STALE_TIME.LONG,
  });

  return {
    accounts,
    categories,
    currencies,
    isLoading: isLoadingAccounts || isLoadingCategories || isLoadingCurrencies,
    isLoadingAccounts,
    isLoadingCategories,
    isLoadingCurrencies,
  };
}

/**
 * Hook for accounts only.
 *
 * Use this when you only need accounts data.
 * More efficient than useReferenceData if you don't need categories/currencies.
 */
export function useAccountsData(): {
  accounts: AccountViewEntity[];
  isLoading: boolean;
} {
  const { data: accounts = [], isLoading } = useAccounts();
  return { accounts, isLoading };
}

/**
 * Hook for leaf categories only.
 *
 * Use this when you only need categories data.
 * More efficient than useReferenceData if you don't need accounts/currencies.
 */
export function useCategoriesData(): {
  categories: LeafCategoryEntity[];
  isLoading: boolean;
} {
  const { data: categories = [], isLoading } = useLeafCategoriesQuery();
  return { categories, isLoading };
}

/**
 * Hook for currencies only.
 *
 * Use this when you only need currencies data.
 * More efficient than useReferenceData if you don't need accounts/categories.
 */
export function useCurrenciesData(): {
  currencies: Currency[];
  isLoading: boolean;
} {
  const { data: currencies = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.CURRENCIES,
    queryFn: currenciesApi.getAll,
    staleTime: QUERY_CONFIG.STALE_TIME.LONG,
  });
  return { currencies, isLoading };
}
