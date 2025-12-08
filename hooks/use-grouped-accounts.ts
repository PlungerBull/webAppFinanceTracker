import { useMemo } from 'react';
import { useAccounts } from '@/features/accounts/hooks/use-accounts';
import { ACCOUNT, ACCOUNT_UI } from '@/lib/constants';
import type { AccountBalance } from '@/types/domain';

/**
 * Hook to group account balances by account_id
 * Extracts grouping logic from account-list.tsx
 *
 * @returns Grouped accounts with balances sorted by currency
 *
 * @example
 * ```tsx
 * const { groupedAccounts, isLoading } = useGroupedAccounts();
 *
 * groupedAccounts.forEach(account => {
 *   console.log(account.name, account.balances);
 * });
 * ```
 */
export function useGroupedAccounts() {
  const { data: accounts = [], isLoading } = useAccounts();

  const groupedAccounts = useMemo(() => {
    const grouped = new Map<string, typeof accounts>();

    accounts.forEach((balance) => {
      // Filter out balances without accountId
      if (!balance.accountId) return;

      const existing = grouped.get(balance.accountId) || [];
      grouped.set(balance.accountId, [...existing, balance]);
    });

    return Array.from(grouped.entries()).map(([accountId, balances]) => {
      const first = balances[0];
      return {
        accountId,
        userId: first.userId!,
        name: first.name ?? ACCOUNT_UI.LABELS.UNKNOWN_ACCOUNT,
        color: first.color || ACCOUNT.DEFAULT_COLOR,
        isVisible: first.isVisible ?? true,
        createdAt: first.createdAt!,
        updatedAt: first.updatedAt!,
        balances: balances.sort((a, b) =>
          (a.currency ?? '').localeCompare(b.currency ?? '')
        ),
      };
    });
  }, [accounts]);

  return {
    data: groupedAccounts, // Renamed for consistency with other hooks (React Query pattern)
    groupedAccounts, // Keep for backward compatibility
    isLoading,
    accounts, // Also return raw accounts in case needed
  };
}

/**
 * Return type for useGroupedAccounts hook
 */
export type GroupedAccount = {
  accountId: string;
  userId: string;
  name: string;
  color: string;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
  balances: AccountBalance[];
};

export type UseGroupedAccountsReturn = {
  data: GroupedAccount[]; // For React Query pattern destructuring
  groupedAccounts: GroupedAccount[];
  isLoading: boolean;
  accounts: AccountBalance[]; // Raw accounts array
};
