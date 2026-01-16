import { useMemo } from 'react';
import { useAccounts, type AccountViewEntity } from '@/features/accounts/hooks/use-accounts';
import { ACCOUNT, ACCOUNT_UI } from '@/lib/constants';

/**
 * Hook to group account balances by group_id
 * NEW CONTAINER PATTERN: Multiple accounts (one per currency) share the same group_id
 *
 * Uses AccountViewEntity internally - the new domain standard.
 *
 * @returns Grouped accounts with balances sorted by currency
 *
 * @example
 * ```tsx
 * const { groupedAccounts, isLoading } = useGroupedAccounts();
 *
 * groupedAccounts.forEach(account => {
 *   console.log(account.name, account.balances);
 *   // "Chase Visa" -> [{accountId: "uuid", currency: "USD", amountCents: 10050}]
 * });
 * ```
 */
export function useGroupedAccounts() {
  const { data: accounts = [], isLoading } = useAccounts();

  const groupedAccounts = useMemo(() => {
    const grouped = new Map<string, AccountViewEntity[]>();

    accounts.forEach((account) => {
      const existing = grouped.get(account.groupId) || [];
      grouped.set(account.groupId, [...existing, account]);
    });

    return Array.from(grouped.entries()).map(([groupId, groupAccounts]) => {
      const first = groupAccounts[0];

      return {
        groupId,
        name: first.name ?? ACCOUNT_UI.LABELS.UNKNOWN_ACCOUNT,
        color: first.color ?? ACCOUNT.DEFAULT_COLOR,
        type: first.type,
        balances: groupAccounts
          .map((acc) => ({
            accountId: acc.id,  // Use id, not accountId
            currency: acc.currencyCode,
            amountCents: acc.currentBalanceCents,  // Use integer cents, not decimal
          }))
          .sort((a, b) => a.currency.localeCompare(b.currency)),
      };
    });
  }, [accounts]);

  return {
    data: groupedAccounts,
    groupedAccounts,
    isLoading,
    accounts,
  };
}

/**
 * Return type for useGroupedAccounts hook
 * NEW CONTAINER PATTERN: Grouped by group_id with simplified structure
 *
 * UPDATED: Uses id (not accountId) and amountCents (not amount decimal)
 */
export type GroupedAccount = {
  groupId: string;
  name: string;
  color: string;
  type: 'checking' | 'savings' | 'credit_card' | 'investment' | 'loan' | 'cash' | 'other';
  balances: Array<{
    accountId: string;  // Individual account ID (one per currency)
    currency: string;   // e.g., "USD", "PEN"
    amountCents: number;  // INTEGER CENTS (e.g., 1050 for $10.50)
  }>;
};

export type UseGroupedAccountsReturn = {
  data: GroupedAccount[];
  groupedAccounts: GroupedAccount[];
  isLoading: boolean;
  accounts: AccountViewEntity[];
};
