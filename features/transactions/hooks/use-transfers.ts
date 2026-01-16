/**
 * Transfer Mutation Hooks
 *
 * React Query mutation hooks for transfer operations.
 * Uses the new service layer with Repository Pattern.
 *
 * CTO Mandate: Zero-Latency UX with optimistic updates.
 *
 * @module use-transfers
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/lib/constants';
import { useTransferService } from './use-transfer-service';
import type { CreateTransferDTO } from '../domain';
import type { AccountViewEntity } from '@/features/accounts/domain';

/**
 * Use Create Transfer
 *
 * Mutation hook for creating a transfer between two accounts.
 * Includes optimistic updates for Zero-Latency UX.
 *
 * CTO Mandate: Atomic Transfer Protocol - uses create_transfer RPC exclusively.
 *
 * @example
 * ```typescript
 * const { mutate, isPending } = useCreateTransfer();
 *
 * mutate({
 *   fromAccountId: 'source-uuid',
 *   toAccountId: 'dest-uuid',
 *   sentAmountCents: 10000,     // $100.00
 *   receivedAmountCents: 10000, // Same currency
 *   date: new Date().toISOString(),
 *   description: 'Savings transfer',
 * });
 * ```
 */
export function useCreateTransfer() {
  const service = useTransferService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTransferDTO) => service.create(data),

    // Optimistic update: Immediately adjust account balances
    onMutate: async (data) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.ACCOUNTS });

      // Snapshot current state for rollback
      const previousAccounts = queryClient.getQueryData<AccountViewEntity[]>(
        QUERY_KEYS.ACCOUNTS
      );

      // Optimistically update account balances
      if (previousAccounts) {
        queryClient.setQueryData<AccountViewEntity[]>(
          QUERY_KEYS.ACCOUNTS,
          previousAccounts.map((account) => {
            if (account.id === data.fromAccountId) {
              // Deduct from source account
              return {
                ...account,
                currentBalanceCents: account.currentBalanceCents - data.sentAmountCents,
                updatedAt: new Date().toISOString(),
              };
            }
            if (account.id === data.toAccountId) {
              // Add to destination account
              return {
                ...account,
                currentBalanceCents: account.currentBalanceCents + data.receivedAmountCents,
                updatedAt: new Date().toISOString(),
              };
            }
            return account;
          })
        );
      }

      return { previousAccounts };
    },

    // Rollback on error
    onError: (_err, _data, context) => {
      if (context?.previousAccounts) {
        queryClient.setQueryData(QUERY_KEYS.ACCOUNTS, context.previousAccounts);
      }
    },

    // Refetch after success to ensure consistency
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRANSACTIONS.ALL });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
    },
  });
}
