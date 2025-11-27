import { useMemo } from 'react';
import { useAccounts } from '@/features/accounts/hooks/use-accounts';
import { ACCOUNT, ACCOUNT_UI } from '@/lib/constants';
import type { Database } from '@/types/database.types';

type AccountBalance = Database['public']['Views']['account_balances']['Row'];

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

    return Array.from(grouped.entries()).map(([account_id, balances]) => {
      const first = balances[0];
      return {
        account_id,
        user_id: first.user_id!,
        name: first.name ?? ACCOUNT_UI.LABELS.UNKNOWN_ACCOUNT,
        color: first.color || ACCOUNT.DEFAULT_COLOR,
        is_visible: first.is_visible ?? true,
        created_at: first.created_at!,
        updated_at: first.updated_at!,
        balances: balances.sort((a, b) =>
          (a.currency ?? '').localeCompare(b.currency ?? '')
        ),
      };
    });
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
  user_id: string;
  name: string;
  color: string;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
  balances: AccountBalance[];
};

export type UseGroupedAccountsReturn = {
  groupedAccounts: GroupedAccount[];
  isLoading: boolean;
  accounts: AccountBalance[]; // Raw accounts array
};
