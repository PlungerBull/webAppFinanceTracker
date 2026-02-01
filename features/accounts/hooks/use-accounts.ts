/**
 * Account Query Hooks
 *
 * React Query hooks for fetching account data.
 * Uses the new service layer with Repository Pattern.
 *
 * CTO MANDATES:
 * - Orchestrator Rule: Service may be null, queries use enabled flag
 * - Returns AccountViewEntity - the new domain entity standard
 *
 * UI components must use: id (not accountId), currentBalanceCents (not currentBalance)
 *
 * @module use-accounts
 */

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, createQueryOptions } from '@/lib/constants';
import { useAccountService } from './use-account-service';
import type { AccountFilters } from '../domain';

// Re-export entity type for consumers
export type { AccountViewEntity } from '../domain';

/**
 * Use Accounts
 *
 * Query hook for fetching all accounts.
 * Returns AccountViewEntity[] - the new domain standard.
 *
 * CTO MANDATE: Orchestrator Rule
 * Query is disabled until service is ready.
 *
 * @param filters - Optional filters
 * @returns Query result with accounts array
 *
 * @example
 * ```typescript
 * function AccountList() {
 *   const { data: accounts, isLoading, error } = useAccounts();
 *
 *   if (isLoading) return <Loading />;
 *   if (error) return <Error message={error.message} />;
 *
 *   return (
 *     <ul>
 *       {accounts.map(account => (
 *         <li key={account.id}>
 *           {account.name} - {formatCents(account.currentBalanceCents)}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useAccounts(filters?: AccountFilters) {
  const service = useAccountService();

  return useQuery({
    queryKey: QUERY_KEYS.ACCOUNTS,
    queryFn: () => {
      if (!service) {
        throw new Error('Account service not ready');
      }
      return service.getAll(filters);
    },
    ...createQueryOptions('STRUCTURAL'),
    enabled: !!service, // CTO MANDATE: Orchestrator Rule
  });
}

/**
 * Use Account
 *
 * Query hook for fetching a single account by ID.
 *
 * CTO MANDATE: Orchestrator Rule
 * Query is disabled until service is ready.
 *
 * @param id - Account ID
 * @returns Query result with account entity
 *
 * @example
 * ```typescript
 * function AccountDetail({ id }: { id: string }) {
 *   const { data: account, isLoading } = useAccount(id);
 *
 *   if (isLoading) return <Loading />;
 *   if (!account) return <NotFound />;
 *
 *   return <div>{account.name}</div>;
 * }
 * ```
 */
export function useAccount(id: string) {
  const service = useAccountService();

  return useQuery({
    queryKey: [...QUERY_KEYS.ACCOUNTS, id],
    queryFn: () => {
      if (!service) {
        throw new Error('Account service not ready');
      }
      return service.getById(id);
    },
    ...createQueryOptions('STRUCTURAL'),
    enabled: !!service && !!id, // CTO MANDATE: Orchestrator Rule
  });
}

/**
 * Use Accounts By Group
 *
 * Query hook for fetching accounts in a specific group.
 *
 * CTO MANDATE: Orchestrator Rule
 * Query is disabled until service is ready.
 *
 * @param groupId - Account group ID
 * @returns Query result with accounts array
 */
export function useAccountsByGroup(groupId: string) {
  const service = useAccountService();

  return useQuery({
    queryKey: [...QUERY_KEYS.ACCOUNTS, 'group', groupId],
    queryFn: () => {
      if (!service) {
        throw new Error('Account service not ready');
      }
      return service.getByGroupId(groupId);
    },
    ...createQueryOptions('STRUCTURAL'),
    enabled: !!service && !!groupId, // CTO MANDATE: Orchestrator Rule
  });
}
