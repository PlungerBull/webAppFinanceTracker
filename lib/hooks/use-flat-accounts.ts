import { useMemo } from 'react';
import { useAccounts, type AccountViewEntity } from '@/features/accounts/hooks/use-accounts';

/**
 * Flat account hook for sidebar display (one row per currency)
 * Replaces useGroupedAccounts - no grouping, just filtering and sorting
 *
 * Returns AccountViewEntity[] - the new domain standard.
 * Components must use: id (not accountId), currentBalanceCents (not currentBalance)
 */
export function useFlatAccounts() {
  const { data: accounts, isLoading } = useAccounts();

  const flatAccounts = useMemo(() => {
    if (!accounts) return [];

    return accounts
      .filter(acc => acc.isVisible === true)
      .sort((a, b) => {
        // Sort by type, then name, then currency
        const typeOrder = ['checking', 'savings', 'credit_card', 'investment', 'loan', 'cash', 'other'];
        const typeA = typeOrder.indexOf(a.type ?? 'other');
        const typeB = typeOrder.indexOf(b.type ?? 'other');

        if (typeA !== typeB) return typeA - typeB;
        if (a.name !== b.name) return a.name.localeCompare(b.name);
        return a.currencyCode.localeCompare(b.currencyCode);
      });
  }, [accounts]);

  return { flatAccounts, isLoading };
}

// Export the new entity type
export type FlatAccount = AccountViewEntity;
