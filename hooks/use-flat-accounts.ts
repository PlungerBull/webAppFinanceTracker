import { useMemo } from 'react';
import { useAccounts } from '@/features/accounts/hooks/use-accounts';
import type { AccountBalance } from '@/types/domain';

/**
 * Flat account hook for sidebar display (one row per currency)
 * Replaces useGroupedAccounts - no grouping, just filtering and sorting
 */
export function useFlatAccounts() {
  const { data: accounts, isLoading } = useAccounts();

  const flatAccounts = useMemo(() => {
    if (!accounts) return [];

    return accounts
      .filter(acc => acc.isVisible === true)
      .map(acc => ({
        ...acc,
        // ✅ REGEX ANCHORING: Only strip currency suffix at end of string
        // Matches " (USD)", " (PEN)", etc. but NOT " (Joint) " in middle
        // Preserves user-defined parentheses like "Savings (Joint) (USD)"
        cleanName: (acc.name ?? '').replace(/\s\([A-Z]{3,4}\)$/, ''),
      }))
      .sort((a, b) => {
        // Sort by type, then name, then currency
        const typeOrder = ['checking', 'savings', 'credit_card', 'investment', 'loan', 'cash', 'other'];
        const typeA = typeOrder.indexOf(a.type ?? 'other');
        const typeB = typeOrder.indexOf(b.type ?? 'other');

        if (typeA !== typeB) return typeA - typeB;
        if (a.cleanName !== b.cleanName) return a.cleanName.localeCompare(b.cleanName);
        return (a.currencyCode ?? '').localeCompare(b.currencyCode ?? '');
      });
  }, [accounts]);

  return { flatAccounts, isLoading };
}

export type FlatAccount = AccountBalance & { cleanName: string };
