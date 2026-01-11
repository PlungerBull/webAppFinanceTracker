import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionsApi } from '../api/transactions';
import type {
  CreateTransactionFormData,
  CreateTransactionLedgerData,
  UpdateTransactionFormData
} from '../schemas/transaction.schema';
import type { TransactionFilters } from '../api/filters';
import { PAGINATION } from '@/lib/constants';
import { calculateBalanceDeltas, calculateDeleteDelta, calculateCreateDelta, toCents, fromCents } from '@/lib/utils/balance-logic';
import type { TransactionView } from '@/types/domain';
import { toast } from 'sonner';

export function useTransactions(filters?: TransactionFilters) {
  const query = useInfiniteQuery({
    queryKey: ['transactions', 'infinite', filters],
    queryFn: ({ pageParam = 0 }) =>
      transactionsApi.getAllPaginated(filters, {
        offset: pageParam,
        limit: PAGINATION.DEFAULT_PAGE_SIZE,
      }),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.data.length < PAGINATION.DEFAULT_PAGE_SIZE) {
        return undefined; // No more pages
      }
      const nextOffset = allPages.reduce((acc, page) => acc + page.data.length, 0);
      return nextOffset;
    },
    initialPageParam: 0,
    placeholderData: (previousData) => previousData,
  });

  // Flatten pages for UI consumption
  const flattenedData = query.data?.pages.flatMap(page => page.data) ?? [];
  const totalCount = query.data?.pages[0]?.count ?? null;

  return {
    ...query,
    data: flattenedData,
    totalCount,
  };
}

export function useTransaction(id: string) {
  return useQuery({
    queryKey: ['transactions', id],
    queryFn: () => transactionsApi.getById(id),
    enabled: !!id,
  });
}

// Hook for adding transactions to the LEDGER (requires complete data)
// This hook enforces strict validation - all required fields must be present
// For incomplete/draft transactions, use the inbox API instead
export function useAddTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['add-transaction'],
    mutationFn: (data: CreateTransactionLedgerData) => transactionsApi.create(data),

    onMutate: async (data) => {
      // 1. Cancel outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['transactions'] });
      await queryClient.cancelQueries({ queryKey: ['accounts'] });

      // 2. Snapshot current state for rollback
      const previousInfinite = queryClient.getQueryData(['transactions', 'infinite']);
      const previousAccounts = queryClient.getQueryData(['accounts']);

      // 3. Generate client-side UUID for optimistic update
      const optimisticId = crypto.randomUUID();

      // 4. Create optimistic transaction object
      const optimisticTransaction: TransactionView = {
        id: optimisticId,
        version: 1, // New transactions start at version 1
        userId: '', // Will be set by server
        accountId: data.account_id,
        categoryId: data.category_id ?? null,
        description: data.description ?? '',
        amountOriginal: data.amount_original,
        amountHome: data.amount_original, // Simplified - will be calculated by server
        currencyOriginal: '', // Will be set by server trigger
        date: data.date,
        notes: data.notes ?? null,
        exchangeRate: data.exchange_rate,
        type: 'expense', // Will be derived by server
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // View-specific fields (will be populated by server)
        accountName: '',
        accountCurrencyCode: '',
        categoryName: null,
        categoryColor: null,
      };

      // 5. Optimistically add transaction to ALL infinite queries
      queryClient.setQueriesData(
        {
          queryKey: ['transactions', 'infinite'],
          predicate: (query) => query.queryKey[0] === 'transactions' && query.queryKey[1] === 'infinite',
        },
        (old: any) => {
          if (!old) return old;

          // Add to first page (most recent transactions)
          const newPages = [...old.pages];
          if (newPages.length > 0) {
            newPages[0] = {
              ...newPages[0],
              data: [optimisticTransaction, ...newPages[0].data],
              count: (newPages[0].count ?? 0) + 1,
            };
          }

          return {
            ...old,
            pages: newPages,
          };
        }
      );

      // 6. Optimistically update account balance (add transaction amount)
      const balanceDelta = calculateCreateDelta({
        accountId: data.account_id,
        amountOriginal: data.amount_original,
      });

      queryClient.setQueryData(['accounts'], (old: any) => {
        if (!old) return old;

        return old.map((account: any) => {
          if (account.id !== balanceDelta.accountId) return account;

          const currentBalanceCents = toCents(account.currentBalance ?? 0);
          return {
            ...account,
            currentBalance: fromCents(currentBalanceCents + balanceDelta.deltaCents),
          };
        });
      });

      return { previousInfinite, previousAccounts, optimisticId };
    },

    onError: (err: any, variables, context) => {
      // Rollback on failure
      if (context?.previousInfinite) {
        queryClient.setQueryData(['transactions', 'infinite'], context.previousInfinite);
      }
      if (context?.previousAccounts) {
        queryClient.setQueryData(['accounts'], context.previousAccounts);
      }

      toast.error('Failed to create transaction');
    },

    onSettled: () => {
      // Always refetch in background to get server-generated fields
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['update-transaction'],
    mutationFn: async ({ id, data }: { id: string; data: UpdateTransactionFormData }) => {
      const result = await transactionsApi.update(id, data);

      // Auto-retry on version conflict (max 2 attempts)
      if (result.conflict) {
        const freshTxn = await transactionsApi.getById(id);
        const retryData = { ...data, version: freshTxn.version };
        const retryResult = await transactionsApi.update(id, retryData);

        if (retryResult.conflict) {
          throw new Error('VERSION_CONFLICT_AFTER_RETRY');
        }

        return retryResult.data!;
      }

      return result.data!;
    },

    onMutate: async ({ id, data }) => {
      // 1. Cancel outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['transactions'] });
      await queryClient.cancelQueries({ queryKey: ['accounts'] });

      // 2. Snapshot current state for rollback
      const previousInfinite = queryClient.getQueryData(['transactions', 'infinite']);
      const previousAccounts = queryClient.getQueryData(['accounts']);

      // 3. Optimistically update transaction in ALL infinite queries (across all filters)
      // CRITICAL: Use setQueriesData (plural) to update transaction in every filter view
      queryClient.setQueriesData(
        {
          queryKey: ['transactions', 'infinite'],
          predicate: (query) => query.queryKey[0] === 'transactions' && query.queryKey[1] === 'infinite',
        },
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              data: page.data.map((txn: TransactionView) =>
                txn.id === id
                  ? {
                      ...txn,
                      description: data.description ?? txn.description,
                      amountOriginal: data.amount_original ?? txn.amountOriginal,
                      accountId: data.account_id ?? txn.accountId,
                      categoryId: data.category_id ?? txn.categoryId,
                      date: data.date ?? txn.date,
                      notes: data.notes ?? txn.notes,
                      exchangeRate: data.exchange_rate ?? txn.exchangeRate,
                      version: txn.version + 1, // Optimistic version bump
                    }
                  : txn
              ),
            })),
          };
        }
      );

      // 4. Optimistically update account balance if amount/account changed
      // CRITICAL: Use centralized balance logic (mirrors database trigger)
      if (data.amount_original !== undefined || data.account_id !== undefined) {
        queryClient.setQueryData(['accounts'], (old: any) => {
          if (!old) return old;

          // Find the transaction to calculate balance delta
          const oldTxn = (previousInfinite as any)?.pages
            ?.flatMap((p: any) => p.data)
            ?.find((t: TransactionView) => t.id === id);

          if (!oldTxn) return old;

          // Use centralized balance logic utility (Debt Prevention #1)
          const balanceDeltas = calculateBalanceDeltas(
            { accountId: oldTxn.accountId, amountOriginal: oldTxn.amountOriginal },
            {
              accountId: data.account_id ?? oldTxn.accountId,
              amountOriginal: data.amount_original ?? oldTxn.amountOriginal,
            }
          );

          // Apply deltas to affected accounts
          return old.map((account: any) => {
            const delta = balanceDeltas.find(d => d.accountId === account.id);
            if (!delta) return account;

            const currentBalanceCents = toCents(account.currentBalance ?? 0);
            return {
              ...account,
              currentBalance: fromCents(currentBalanceCents + delta.deltaCents),
            };
          });
        });
      }

      return { previousInfinite, previousAccounts };
    },

    onError: (err: any, variables, context) => {
      // Rollback on failure
      if (context?.previousInfinite) {
        queryClient.setQueryData(['transactions', 'infinite'], context.previousInfinite);
      }
      if (context?.previousAccounts) {
        queryClient.setQueryData(['accounts'], context.previousAccounts);
      }

      // Show error toast
      if (err.message === 'VERSION_CONFLICT_AFTER_RETRY') {
        toast.error('Transaction updated by another user. Please refresh and try again.', {
          action: {
            label: 'Refresh',
            onClick: () => {
              queryClient.invalidateQueries({ queryKey: ['transactions'] });
              queryClient.invalidateQueries({ queryKey: ['accounts'] });
            },
          },
        });
      } else {
        toast.error('Failed to update transaction');
      }
    },

    onSettled: () => {
      // Always refetch in background to ensure local "illusion" matches server "truth"
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useUpdateTransactionBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['update-transaction-batch'],
    mutationFn: async ({ id, updates, version }: {
      id: string;
      version: number;
      updates: {
        description?: string;
        amountOriginal?: number;
        accountId?: string;
        categoryId?: string;
        date?: string;
        notes?: string;
        exchangeRate?: number;
      };
    }) => {
      const result = await transactionsApi.updateBatch(id, updates, version);

      // Auto-retry on version conflict (max 2 attempts)
      if (result.conflict) {
        const freshTxn = await transactionsApi.getById(id);
        const retryResult = await transactionsApi.updateBatch(id, updates, freshTxn.version);

        if (retryResult.conflict) {
          throw new Error('VERSION_CONFLICT_AFTER_RETRY');
        }

        return retryResult.data!;
      }

      return result.data!;
    },

    onMutate: async ({ id, updates }) => {
      // 1. Cancel outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['transactions'] });
      await queryClient.cancelQueries({ queryKey: ['accounts'] });

      // 2. Snapshot current state for rollback
      const previousInfinite = queryClient.getQueryData(['transactions', 'infinite']);
      const previousAccounts = queryClient.getQueryData(['accounts']);

      // 3. Optimistically update transaction in ALL infinite queries
      queryClient.setQueriesData(
        {
          queryKey: ['transactions', 'infinite'],
          predicate: (query) => query.queryKey[0] === 'transactions' && query.queryKey[1] === 'infinite',
        },
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              data: page.data.map((txn: TransactionView) =>
                txn.id === id
                  ? {
                      ...txn,
                      description: updates.description !== undefined ? updates.description : txn.description,
                      amountOriginal: updates.amountOriginal !== undefined ? updates.amountOriginal : txn.amountOriginal,
                      accountId: updates.accountId !== undefined ? updates.accountId : txn.accountId,
                      categoryId: updates.categoryId !== undefined ? updates.categoryId : txn.categoryId,
                      date: updates.date !== undefined ? updates.date : txn.date,
                      notes: updates.notes !== undefined ? updates.notes : txn.notes,
                      exchangeRate: updates.exchangeRate !== undefined ? updates.exchangeRate : txn.exchangeRate,
                      version: txn.version + 1, // Optimistic version bump
                    }
                  : txn
              ),
            })),
          };
        }
      );

      // 4. Optimistically update account balance if amount/account changed
      if (updates.amountOriginal !== undefined || updates.accountId !== undefined) {
        queryClient.setQueryData(['accounts'], (old: any) => {
          if (!old) return old;

          // Find the transaction to calculate balance delta
          const oldTxn = (previousInfinite as any)?.pages
            ?.flatMap((p: any) => p.data)
            ?.find((t: TransactionView) => t.id === id);

          if (!oldTxn) return old;

          // Use centralized balance logic utility
          const balanceDeltas = calculateBalanceDeltas(
            { accountId: oldTxn.accountId, amountOriginal: oldTxn.amountOriginal },
            {
              accountId: updates.accountId ?? oldTxn.accountId,
              amountOriginal: updates.amountOriginal ?? oldTxn.amountOriginal,
            }
          );

          // Apply deltas to affected accounts
          return old.map((account: any) => {
            const delta = balanceDeltas.find(d => d.accountId === account.id);
            if (!delta) return account;

            const currentBalanceCents = toCents(account.currentBalance ?? 0);
            return {
              ...account,
              currentBalance: fromCents(currentBalanceCents + delta.deltaCents),
            };
          });
        });
      }

      return { previousInfinite, previousAccounts };
    },

    onError: (err: any, variables, context) => {
      // Rollback on failure
      if (context?.previousInfinite) {
        queryClient.setQueryData(['transactions', 'infinite'], context.previousInfinite);
      }
      if (context?.previousAccounts) {
        queryClient.setQueryData(['accounts'], context.previousAccounts);
      }

      // Show error toast
      if (err.message === 'VERSION_CONFLICT_AFTER_RETRY') {
        toast.error('Transaction updated by another user. Please refresh and try again.', {
          action: {
            label: 'Refresh',
            onClick: () => {
              queryClient.invalidateQueries({ queryKey: ['transactions'] });
              queryClient.invalidateQueries({ queryKey: ['accounts'] });
            },
          },
        });
      } else {
        toast.error('Failed to update transaction');
      }
    },

    onSettled: () => {
      // Always refetch in background to ensure cache matches server
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['delete-transaction'],
    mutationFn: async ({ id, version }: { id: string; version: number }) => {
      const result = await transactionsApi.delete(id, version);

      // Version conflict - show confirmation dialog
      if (result.conflict) {
        throw new Error('VERSION_CONFLICT_DELETE');
      }

      if (!result.success) {
        throw new Error('DELETE_FAILED');
      }

      return result;
    },

    onMutate: async ({ id }) => {
      // 1. Cancel outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['transactions'] });
      await queryClient.cancelQueries({ queryKey: ['accounts'] });

      // 2. Snapshot current state for rollback
      const previousInfinite = queryClient.getQueryData(['transactions', 'infinite']);
      const previousAccounts = queryClient.getQueryData(['accounts']);

      // Find the transaction to calculate balance delta
      const deletedTxn = (previousInfinite as any)?.pages
        ?.flatMap((p: any) => p.data)
        ?.find((t: TransactionView) => t.id === id);

      // 3. Optimistically remove transaction from ALL infinite queries
      queryClient.setQueriesData(
        {
          queryKey: ['transactions', 'infinite'],
          predicate: (query) => query.queryKey[0] === 'transactions' && query.queryKey[1] === 'infinite',
        },
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              data: page.data.filter((txn: TransactionView) => txn.id !== id),
              count: Math.max(0, (page.count ?? 0) - 1),
            })),
          };
        }
      );

      // 4. Optimistically update account balance (subtract transaction amount)
      if (deletedTxn) {
        const balanceDelta = calculateDeleteDelta({
          accountId: deletedTxn.accountId,
          amountOriginal: deletedTxn.amountOriginal,
        });

        queryClient.setQueryData(['accounts'], (old: any) => {
          if (!old) return old;

          return old.map((account: any) => {
            if (account.id !== balanceDelta.accountId) return account;

            const currentBalanceCents = toCents(account.currentBalance ?? 0);
            return {
              ...account,
              currentBalance: fromCents(currentBalanceCents + balanceDelta.deltaCents),
            };
          });
        });
      }

      return { previousInfinite, previousAccounts, deletedTxn };
    },

    onError: (err: any, variables, context) => {
      // Rollback on failure
      if (context?.previousInfinite) {
        queryClient.setQueryData(['transactions', 'infinite'], context.previousInfinite);
      }
      if (context?.previousAccounts) {
        queryClient.setQueryData(['accounts'], context.previousAccounts);
      }

      // Show error toast with confirmation option for version conflict
      if (err.message === 'VERSION_CONFLICT_DELETE') {
        toast.error('This transaction has been modified. Are you sure you want to delete it?', {
          action: {
            label: 'Confirm Delete',
            onClick: async () => {
              // Fetch latest version and delete
              try {
                const freshTxn = await transactionsApi.getById(variables.id);
                await transactionsApi.delete(variables.id, freshTxn.version);
                queryClient.invalidateQueries({ queryKey: ['transactions'] });
                queryClient.invalidateQueries({ queryKey: ['accounts'] });
                toast.success('Transaction deleted');
              } catch (error) {
                toast.error('Failed to delete transaction');
              }
            },
          },
        });
      } else {
        toast.error('Failed to delete transaction');
      }
    },

    onSettled: () => {
      // Always refetch in background to ensure cache matches server
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useBulkUpdateTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['bulk-update-transactions'],
    mutationFn: ({ ids, versions, updates }: {
      ids: string[];
      versions: number[];
      updates: {
        categoryId?: string;
        accountId?: string;
        date?: string;
        notes?: string;
      };
    }) => transactionsApi.bulkUpdate(ids, versions, updates),

    onMutate: async ({ ids, updates }) => {
      // 1. Cancel outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['transactions'] });
      await queryClient.cancelQueries({ queryKey: ['accounts'] });

      // 2. Snapshot current state for rollback
      const previousInfinite = queryClient.getQueryData(['transactions', 'infinite']);
      const previousAccounts = queryClient.getQueryData(['accounts']);

      // 3. Optimistically update ALL matching transactions in ALL infinite queries
      queryClient.setQueriesData(
        {
          queryKey: ['transactions', 'infinite'],
          predicate: (query) => query.queryKey[0] === 'transactions' && query.queryKey[1] === 'infinite',
        },
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              data: page.data.map((txn: TransactionView) => {
                if (!ids.includes(txn.id)) return txn;

                // Apply updates to matching transaction
                return {
                  ...txn,
                  categoryId: updates.categoryId !== undefined ? updates.categoryId : txn.categoryId,
                  accountId: updates.accountId !== undefined ? updates.accountId : txn.accountId,
                  date: updates.date !== undefined ? updates.date : txn.date,
                  notes: updates.notes !== undefined ? updates.notes : txn.notes,
                  version: txn.version + 1, // Optimistic version bump
                };
              }),
            })),
          };
        }
      );

      // 4. Optimistically update account balances if account changed
      // NOTE: Bulk updates with account changes can affect multiple accounts
      if (updates.accountId !== undefined) {
        const affectedTransactions = (previousInfinite as any)?.pages
          ?.flatMap((p: any) => p.data)
          ?.filter((t: TransactionView) => ids.includes(t.id));

        if (affectedTransactions && affectedTransactions.length > 0) {
          queryClient.setQueryData(['accounts'], (old: any) => {
            if (!old) return old;

            // Calculate cumulative balance deltas for each account
            const accountDeltas: Record<string, number> = {};

            affectedTransactions.forEach((txn: TransactionView) => {
              const balanceDeltas = calculateBalanceDeltas(
                { accountId: txn.accountId, amountOriginal: txn.amountOriginal },
                { accountId: updates.accountId!, amountOriginal: txn.amountOriginal }
              );

              balanceDeltas.forEach(delta => {
                accountDeltas[delta.accountId] = (accountDeltas[delta.accountId] || 0) + delta.deltaCents;
              });
            });

            // Apply cumulative deltas to accounts
            return old.map((account: any) => {
              const deltaCents = accountDeltas[account.id];
              if (!deltaCents) return account;

              const currentBalanceCents = toCents(account.currentBalance ?? 0);
              return {
                ...account,
                currentBalance: fromCents(currentBalanceCents + deltaCents),
              };
            });
          });
        }
      }

      return { previousInfinite, previousAccounts };
    },

    onSuccess: (data) => {
      // Show summary toast
      if (data.errorCount > 0) {
        toast.error(`Updated ${data.successCount} transactions, ${data.errorCount} failed`, {
          description: data.errors.length > 0
            ? data.errors[0].error
            : 'Some transactions could not be updated',
        });
      } else {
        toast.success(`Successfully updated ${data.successCount} transactions`);
      }
    },

    onError: (err: any, variables, context) => {
      // Rollback on failure
      if (context?.previousInfinite) {
        queryClient.setQueryData(['transactions', 'infinite'], context.previousInfinite);
      }
      if (context?.previousAccounts) {
        queryClient.setQueryData(['accounts'], context.previousAccounts);
      }

      toast.error('Failed to update transactions');
    },

    onSettled: () => {
      // Always refetch in background to ensure cache matches server
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

// Hook to get category counts for filter dropdown (server-side aggregation)
// This ensures accurate counts even with pagination
export function useCategoryCounts(filters?: {
  accountId?: string;
  categoryIds?: string[];
  searchQuery?: string;
  date?: Date | string;
  sortBy?: 'date' | 'created_at';
}) {
  return useQuery({
    queryKey: ['transactions', 'category-counts', filters],
    queryFn: () => transactionsApi.getCategoryCounts(filters),
    // Cache for 1 minute - counts don't change frequently
    staleTime: 60 * 1000,
  });
}
