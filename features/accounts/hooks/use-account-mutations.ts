/**
 * Account Mutation Hooks
 *
 * React Query mutation hooks for account operations.
 * Includes optimistic updates for Zero-Latency UX.
 *
 * CTO Mandate: ALL mutation hooks must include onMutate for instant cache updates.
 *
 * @module use-account-mutations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/lib/constants';
import { useAccountService } from './use-account-service';
import type {
  CreateAccountDTO,
  UpdateAccountDTO,
  AccountViewEntity,
} from '../domain';

/**
 * Use Create Account
 *
 * Mutation hook for creating a new account group.
 * Invalidates accounts cache on success.
 *
 * @example
 * ```typescript
 * const { mutate, isPending } = useCreateAccount();
 *
 * mutate({
 *   name: 'Main Checking',
 *   type: 'checking',
 *   color: '#3b82f6',
 *   currencies: ['USD'],
 * });
 * ```
 */
export function useCreateAccount() {
  const service = useAccountService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateAccountDTO) => service.create(data),
    onSuccess: () => {
      // Invalidate accounts list to refetch with new account
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
    },
  });
}

/**
 * Use Update Account
 *
 * Mutation hook for updating an account.
 * Includes optimistic updates for Zero-Latency UX.
 *
 * @example
 * ```typescript
 * const { mutate, isPending } = useUpdateAccount();
 *
 * mutate({
 *   id: 'account-uuid',
 *   data: {
 *     name: 'Updated Name',
 *     color: '#22c55e',
 *     version: 1,
 *   },
 * });
 * ```
 */
export function useUpdateAccount() {
  const service = useAccountService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAccountDTO }) =>
      service.update(id, data),

    // Optimistic update for instant UI feedback
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.ACCOUNTS });

      // Snapshot current state for rollback
      const previousAccounts = queryClient.getQueryData<AccountViewEntity[]>(
        QUERY_KEYS.ACCOUNTS
      );

      // Optimistically update cache
      if (previousAccounts) {
        queryClient.setQueryData<AccountViewEntity[]>(
          QUERY_KEYS.ACCOUNTS,
          previousAccounts.map((account) =>
            account.id === id
              ? {
                  ...account,
                  ...(data.name !== undefined && { name: data.name }),
                  ...(data.color !== undefined && { color: data.color }),
                  ...(data.isVisible !== undefined && {
                    isVisible: data.isVisible,
                  }),
                  updatedAt: new Date().toISOString(),
                }
              : account
          )
        );
      }

      return { previousAccounts };
    },

    // Rollback on error
    onError: (_err, _variables, context) => {
      if (context?.previousAccounts) {
        queryClient.setQueryData(QUERY_KEYS.ACCOUNTS, context.previousAccounts);
      }
    },

    // Refetch after success to ensure consistency
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
    },
  });
}

/**
 * Use Delete Account
 *
 * Mutation hook for deleting an account.
 * Includes optimistic updates for Zero-Latency UX.
 *
 * @example
 * ```typescript
 * const { mutate, isPending } = useDeleteAccount();
 *
 * mutate('account-uuid');
 * ```
 */
export function useDeleteAccount() {
  const service = useAccountService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => service.delete(id),

    // Optimistic removal for instant UI feedback
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.ACCOUNTS });

      // Snapshot current state for rollback
      const previousAccounts = queryClient.getQueryData<AccountViewEntity[]>(
        QUERY_KEYS.ACCOUNTS
      );

      // Optimistically remove from cache
      if (previousAccounts) {
        queryClient.setQueryData<AccountViewEntity[]>(
          QUERY_KEYS.ACCOUNTS,
          previousAccounts.filter((account) => account.id !== id)
        );
      }

      return { previousAccounts };
    },

    // Rollback on error
    onError: (_err, _id, context) => {
      if (context?.previousAccounts) {
        queryClient.setQueryData(QUERY_KEYS.ACCOUNTS, context.previousAccounts);
      }
    },

    // Refetch after success to ensure consistency
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
      // Also invalidate transactions as they may reference deleted account
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.TRANSACTIONS.ALL,
      });
    },
  });
}
