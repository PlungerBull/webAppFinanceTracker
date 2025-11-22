import { useMemo } from 'react';
import { useAccounts } from '@/features/accounts/hooks/use-accounts';
import { ACCOUNT, ACCOUNT_UI } from '@/lib/constants';

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
      // Filter out balances without account_id
      if (!balance.account_id) return;

      const existing = grouped.get(balance.account_id) || [];
      grouped.set(balance.account_id, [...existing, balance]);
    });

    return Array.from(grouped.entries()).map(([account_id, balances]) => ({
      account_id,
      name: balances[0].name ?? ACCOUNT_UI.LABELS.UNKNOWN_ACCOUNT,
      color: balances[0].color || ACCOUNT.DEFAULT_COLOR,
      balances: balances.sort((a, b) =>
        (a.currency ?? '').localeCompare(b.currency ?? '')
      ),
    }));
  }, [accounts]);

  return {
    groupedAccounts,
    isLoading,
    accounts, // Also return raw accounts in case needed
  };
}

/**
 * Return type for useGroupedAccounts hook
 */
export type GroupedAccount = {
  account_id: string;
  name: string;
  color: string;
  balances: Array<{
    account_id: string | null;
    currency: string | null;
    balance: number | null;
    name: string | null;
    color: string | null;
  }>;
};

export type UseGroupedAccountsReturn = {
  groupedAccounts: GroupedAccount[];
  isLoading: boolean;
  accounts: any[]; // Raw accounts array
};
