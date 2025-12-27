import { useMemo } from 'react';
import { useAccounts } from '@/features/accounts/hooks/use-accounts';
import { ACCOUNT, ACCOUNT_UI } from '@/lib/constants';
import type { AccountBalance } from '@/types/domain';

/**
 * Hook to group account balances by group_id
 * NEW CONTAINER PATTERN: Multiple accounts (one per currency) share the same group_id
 *
 * @returns Grouped accounts with balances sorted by currency
 *
 * @example
 * ```tsx
 * const { groupedAccounts, isLoading } = useGroupedAccounts();
 *
 * groupedAccounts.forEach(account => {
 *   console.log(account.name, account.balances); // "Chase Visa" -> [{currency: "USD", amount: 100}, {currency: "PEN", amount: 500}]
 * });
 * ```
 */
export function useGroupedAccounts() {
  const { data: accounts = [], isLoading } = useAccounts();

  const groupedAccounts = useMemo(() => {
    const grouped = new Map<string, typeof accounts>();

    accounts.forEach((balance) => {
      // Filter out balances without groupId
      if (!balance.groupId) return;

      const existing = grouped.get(balance.groupId) || [];
      grouped.set(balance.groupId, [...existing, balance]);
    });

    return Array.from(grouped.entries()).map(([groupId, balances]) => {
      const first = balances[0];
      const name = first.name ?? ACCOUNT_UI.LABELS.UNKNOWN_ACCOUNT;

      return {
        groupId,
        name: name,
        // TODO: color field not available in account_balances view - using default
        // View needs migration to add: SELECT ba.color
        color: ACCOUNT.DEFAULT_COLOR,
        type: first.type || 'checking',
        balances: balances
          .map((b) => ({
            accountId: b.accountId!,
            currency: b.currencyCode ?? 'USD',
            amount: b.currentBalance ?? 0,
          }))
          .sort((a, b) => a.currency.localeCompare(b.currency)),
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
 * NEW CONTAINER PATTERN: Grouped by group_id with simplified structure
 */
export type GroupedAccount = {
  groupId: string;
  name: string; // Clean name without currency suffix
  color: string;
  type: 'checking' | 'savings' | 'credit_card' | 'investment' | 'loan' | 'cash' | 'other';
  balances: Array<{
    accountId: string; // Individual account ID (one per currency)
    currency: string; // e.g., "USD", "PEN"
    amount: number;
  }>;
};

export type UseGroupedAccountsReturn = {
  data: GroupedAccount[]; // For React Query pattern destructuring
  groupedAccounts: GroupedAccount[];
  isLoading: boolean;
  accounts: AccountBalance[]; // Raw accounts array
};
