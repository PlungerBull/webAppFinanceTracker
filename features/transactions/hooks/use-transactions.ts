/**
 * Transaction React Query Hooks (Refactored with Service Layer)
 *
 * React Query hooks for transaction operations using the new service layer.
 *
 * MIGRATION STATUS: Active development
 * - Using new service layer (features/transactions/services)
 * - Using domain entities (TransactionViewEntity with INTEGER CENTS)
 * - Preserving all optimistic update logic (UI-specific)
 * - Retry logic moved to service layer
 *
 * @module use-transactions
 */

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PAGINATION, createQueryOptions } from '@/lib/constants';
import { calculateBalanceDeltas, calculateCreateDelta, calculateDeleteDelta, toCents, fromCents } from '@/lib/utils/balance-logic';
import { toast } from 'sonner';
import { useTransactionService } from './use-transaction-service';
import type { TransactionViewEntity, CreateTransactionDTO, UpdateTransactionDTO } from '../domain';
import type { TransactionFilters, BulkUpdateTransactionDTO, BulkUpdateResult } from '../domain/types';
import type {
  TransactionInfiniteCache,
  InfinitePage,
} from '@/lib/query/cache-types';

/**
 * Legacy account cache shape (uses decimal balance, not cents)
 * TODO: Migrate to AccountViewEntity with currentBalanceCents
 */
interface AccountCacheItem {
  id: string;
  currentBalance: number; // Decimal, NOT cents (legacy shape)
  [key: string]: unknown;
}

/**
 * Hook for fetching paginated transactions with infinite scroll
 *
 * Uses service layer for data fetching.
 * Preserves optimistic updates for zero-latency UX.
 *
 * CTO MANDATE: Orchestrator Rule
 * Query is disabled until service is ready (local database initialized).
 *
 * @param filters - Optional transaction filters
 * @returns Infinite query result with flattened data
 */
export function useTransactions(filters?: TransactionFilters) {
  const service = useTransactionService();

  const query = useInfiniteQuery({
    queryKey: ['transactions', 'infinite', filters],
    queryFn: async ({ pageParam = 0 }) => {
      // CTO MANDATE: Orchestrator Rule - service checked by enabled
      const result = await service!.getAllPaginated(filters, {
        offset: pageParam,
        limit: PAGINATION.DEFAULT_PAGE_SIZE,
      });

      // Transform to match old API shape for backward compatibility
      return {
        data: result.data,
        count: result.total,
      };
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.data.length < PAGINATION.DEFAULT_PAGE_SIZE) {
        return undefined; // No more pages
      }
      const nextOffset = allPages.reduce((acc, page) => acc + page.data.length, 0);
      return nextOffset;
    },
    initialPageParam: 0,
    placeholderData: (previousData) => previousData,
    ...createQueryOptions('TRANSACTIONAL'),
    // CTO MANDATE: Orchestrator Rule - wait for service
    enabled: !!service,
  });

  // Flatten pages for UI consumption
  const flattenedData = query.data?.pages.flatMap((page) => page.data) ?? [];
  const totalCount = query.data?.pages[0]?.count ?? null;

  return {
    ...query,
    data: flattenedData,
    totalCount,
  };
}

/**
 * Hook for fetching single transaction by ID
 *
 * CTO MANDATE: Orchestrator Rule
 * Query is disabled until service is ready.
 *
 * @param id - Transaction ID (UUID)
 * @returns Query result with transaction data
 */
export function useTransaction(id: string) {
  const service = useTransactionService();

  return useQuery({
    queryKey: ['transactions', id],
    queryFn: () => service!.getById(id),
    ...createQueryOptions('TRANSACTIONAL'),
    // CTO MANDATE: Orchestrator Rule - wait for service AND id
    enabled: !!id && !!service,
  });
}

/**
 * Hook for adding transactions to the ledger
 *
 * Requires complete data (CreateTransactionDTO).
 * Implements optimistic updates for zero-latency UX.
 *
 * CRITICAL: Amounts must be INTEGER CENTS (CTO Mandate #3)
 * - UI should convert dollars → cents before calling
 * - Service/repository expect amountCents (integer)
 *
 * CTO MANDATE: Orchestrator Rule
 * Throws if service not ready - callers should guard with isReady check.
 *
 * @returns Mutation with optimistic updates
 */
export function useAddTransaction() {
  const service = useTransactionService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['add-transaction'],
    mutationFn: (data: CreateTransactionDTO) => {
      if (!service) {
        throw new Error('Service not ready. Please wait for initialization.');
      }
      return service.create(data);
    },

    onMutate: async (data) => {
      // 1. Cancel outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['transactions'] });
      await queryClient.cancelQueries({ queryKey: ['accounts'] });

      // 2. Snapshot current state for rollback
      const previousInfinite = queryClient.getQueryData(['transactions', 'infinite']);
      const previousAccounts = queryClient.getQueryData(['accounts']);

      // 3. Generate client-side UUID for optimistic update
      const optimisticId = crypto.randomUUID();

      // 4. Create optimistic transaction object (with INTEGER CENTS)
      const optimisticTransaction: TransactionViewEntity = {
        id: optimisticId,
        version: 1, // New transactions start at version 1
        userId: '', // Will be set by server
        accountId: data.accountId,
        categoryId: data.categoryId ?? null,
        description: data.description ?? null,
        amountCents: data.amountCents, // INTEGER CENTS
        amountHomeCents: data.amountCents, // Simplified - will be calculated by server
        currencyOriginal: null, // Will be set by server
        exchangeRate: 1, // Will be calculated by server
        date: data.date,
        notes: data.notes ?? null,
        sourceText: data.sourceText ?? null,
        inboxId: data.inboxId ?? null,
        transferId: null,
        reconciliationId: null,
        cleared: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
        // View-specific fields (will be populated by server)
        accountName: '',
        // REMOVED: accountCurrency (Ghost Prop - use currencyOriginal instead)
        accountColor: null,
        categoryName: null,
        categoryColor: null,
        categoryType: null,
        reconciliationStatus: null,
      };

      // 5. Optimistically add transaction to ALL infinite queries
      queryClient.setQueriesData(
        {
          queryKey: ['transactions', 'infinite'],
          predicate: (query) =>
            query.queryKey[0] === 'transactions' && query.queryKey[1] === 'infinite',
        },
        (old: TransactionInfiniteCache | undefined) => {
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
      // Balance logic now accepts INTEGER CENTS directly
      const balanceDelta = calculateCreateDelta({
        accountId: data.accountId,
        amountCents: data.amountCents,
      });

      queryClient.setQueryData<AccountCacheItem[]>(['accounts'], (old) => {
        if (!old) return old;

        return old.map((account: AccountCacheItem) => {
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

    onError: (err: Error, variables, context) => {
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

/**
 * Hook for updating transactions
 *
 * Auto-retry on version conflicts handled by service layer.
 * Implements optimistic updates for zero-latency UX.
 *
 * CTO MANDATE: Orchestrator Rule
 * Throws if service not ready - callers should guard with isReady check.
 *
 * @returns Mutation with optimistic updates and conflict handling
 */
export function useUpdateTransaction() {
  const service = useTransactionService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['update-transaction'],
    mutationFn: async ({ id, data }: { id: string; data: UpdateTransactionDTO }) => {
      if (!service) {
        throw new Error('Service not ready. Please wait for initialization.');
      }
      // Service layer handles retry logic automatically
      return service.update(id, data);
    },

    onMutate: async ({ id, data }) => {
      // 1. Cancel outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['transactions'] });
      await queryClient.cancelQueries({ queryKey: ['accounts'] });

      // 2. Snapshot current state for rollback
      const previousInfinite = queryClient.getQueryData(['transactions', 'infinite']);
      const previousSingle = queryClient.getQueryData(['transactions', id]);
      const previousAccounts = queryClient.getQueryData(['accounts']);

      // 3. Get current transaction for balance delta calculation
      const current = queryClient.getQueryData<TransactionViewEntity>(['transactions', id]);

      // 4. Calculate balance deltas (old state → new state)
      // Uses calculateBalanceDeltas for proper handling of account changes
      let balanceDeltas: ReturnType<typeof calculateBalanceDeltas> | null = null;
      if (current && (current.amountCents !== data.amountCents || current.accountId !== data.accountId)) {
        // Account or amount changed - calculate proper deltas
        balanceDeltas = calculateBalanceDeltas(
          { accountId: current.accountId, amountCents: current.amountCents },
          { accountId: data.accountId, amountCents: data.amountCents }
        );
      }

      // 5. Optimistically update transaction in all queries
      const optimisticUpdate: Partial<TransactionViewEntity> = {
        accountId: data.accountId,
        categoryId: data.categoryId ?? null,
        description: data.description ?? null,
        amountCents: data.amountCents,
        amountHomeCents: data.amountCents, // Simplified
        date: data.date,
        notes: data.notes ?? null,
        version: data.version + 1, // Optimistically increment version
        updatedAt: new Date().toISOString(),
      };

      // Update infinite queries
      queryClient.setQueriesData(
        {
          queryKey: ['transactions', 'infinite'],
          predicate: (query) =>
            query.queryKey[0] === 'transactions' && query.queryKey[1] === 'infinite',
        },
        (old: TransactionInfiniteCache | undefined) => {
          if (!old) return old;

          return {
            ...old,
            pages: old.pages.map((page: InfinitePage<TransactionViewEntity>) => ({
              ...page,
              data: page.data.map((txn: TransactionViewEntity) =>
                txn.id === id ? { ...txn, ...optimisticUpdate } : txn
              ),
            })),
          };
        }
      );

      // Update single transaction query
      queryClient.setQueryData<TransactionViewEntity>(['transactions', id], (old) => {
        if (!old) return old;
        return { ...old, ...optimisticUpdate };
      });

      // 6. Optimistically update account balance if needed
      // balanceDeltas is an array (may have 1 or 2 entries for account changes)
      if (balanceDeltas && balanceDeltas.length > 0) {
        queryClient.setQueryData<AccountCacheItem[]>(['accounts'], (old) => {
          if (!old) return old;

          return old.map((account: AccountCacheItem) => {
            // Find any delta for this account
            const delta = balanceDeltas.find((d) => d.accountId === account.id);
            if (!delta) return account;

            const currentBalanceCents = toCents(account.currentBalance ?? 0);
            return {
              ...account,
              currentBalance: fromCents(currentBalanceCents + delta.deltaCents),
            };
          });
        });
      }

      return { previousInfinite, previousSingle, previousAccounts };
    },

    onError: (err: Error, variables, context) => {
      // Rollback on failure
      if (context?.previousInfinite) {
        queryClient.setQueryData(['transactions', 'infinite'], context.previousInfinite);
      }
      if (context?.previousSingle) {
        queryClient.setQueryData(['transactions', variables.id], context.previousSingle);
      }
      if (context?.previousAccounts) {
        queryClient.setQueryData(['accounts'], context.previousAccounts);
      }

      toast.error('Failed to update transaction');
    },

    onSettled: () => {
      // Always refetch in background
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

/**
 * Hook for deleting transactions
 *
 * Implements soft delete with optimistic updates.
 *
 * CTO MANDATE: Orchestrator Rule
 * Throws if service not ready - callers should guard with isReady check.
 *
 * @returns Mutation with optimistic updates
 */
export function useDeleteTransaction() {
  const service = useTransactionService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['delete-transaction'],
    mutationFn: async ({ id, version }: { id: string; version: number }) => {
      if (!service) {
        throw new Error('Service not ready. Please wait for initialization.');
      }
      return service.delete(id, version);
    },

    onMutate: async ({ id }) => {
      // 1. Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['transactions'] });
      await queryClient.cancelQueries({ queryKey: ['accounts'] });

      // 2. Snapshot current state
      const previousInfinite = queryClient.getQueryData(['transactions', 'infinite']);
      const previousAccounts = queryClient.getQueryData(['accounts']);

      // 3. Get transaction for balance delta
      const deletedTxn = queryClient.getQueryData<TransactionViewEntity>(['transactions', id]);

      // 4. Optimistically remove transaction from all queries
      queryClient.setQueriesData(
        {
          queryKey: ['transactions', 'infinite'],
          predicate: (query) =>
            query.queryKey[0] === 'transactions' && query.queryKey[1] === 'infinite',
        },
        (old: TransactionInfiniteCache | undefined) => {
          if (!old) return old;

          return {
            ...old,
            pages: old.pages.map((page: InfinitePage<TransactionViewEntity>) => ({
              ...page,
              data: page.data.filter((txn: TransactionViewEntity) => txn.id !== id),
              count: Math.max(0, (page.count ?? 0) - 1),
            })),
          };
        }
      );

      // 5. Optimistically update account balance (subtract transaction amount)
      // Balance logic now accepts INTEGER CENTS directly
      if (deletedTxn) {
        const balanceDelta = calculateDeleteDelta({
          accountId: deletedTxn.accountId,
          amountCents: deletedTxn.amountCents,
        });

        queryClient.setQueryData<AccountCacheItem[]>(['accounts'], (old) => {
          if (!old) return old;

          return old.map((account: AccountCacheItem) => {
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

    onError: (err: Error, variables, context) => {
      // Rollback on failure
      if (context?.previousInfinite) {
        queryClient.setQueryData(['transactions', 'infinite'], context.previousInfinite);
      }
      if (context?.previousAccounts) {
        queryClient.setQueryData(['accounts'], context.previousAccounts);
      }

      toast.error('Failed to delete transaction');
    },

    onSuccess: () => {
      toast.success('Transaction deleted');
    },

    onSettled: () => {
      // Always refetch in background
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

/**
 * Hook for batch updating transaction fields
 *
 * Used by unified detail panel for partial updates.
 *
 * CTO MANDATE: Orchestrator Rule
 * Throws if service not ready - callers should guard with isReady check.
 *
 * @returns Mutation for batch updates
 */
export function useUpdateTransactionBatch() {
  const service = useTransactionService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['update-transaction-batch'],
    mutationFn: async ({
      id,
      updates,
      version,
    }: {
      id: string;
      updates: Partial<CreateTransactionDTO>;
      version: number;
    }) => {
      if (!service) {
        throw new Error('Service not ready. Please wait for initialization.');
      }
      return service.updateBatch(id, updates, version);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

/**
 * Hook for bulk updating multiple transactions
 *
 * CTO MANDATE: TRUE OPTIMISTIC UI
 * Uses TanStack Query onMutate pattern for zero-latency UX.
 * Updates cache immediately (within 16ms), before Supabase responds.
 *
 * @returns Mutation for bulk operations
 */
export function useBulkUpdateTransactions() {
  const service = useTransactionService();
  const queryClient = useQueryClient();

  return useMutation<
    BulkUpdateResult,
    Error,
    BulkUpdateTransactionDTO,
    { previousQueries: [unknown, unknown][] }
  >({
    mutationKey: ['bulk-update-transactions'],
    mutationFn: (data: BulkUpdateTransactionDTO) => {
      if (!service) {
        throw new Error('Service not ready. Please wait for initialization.');
      }
      return service.bulkUpdate(data);
    },

    /**
     * Optimistic Update: Immediately update the cache before server responds
     * This gives users zero-latency feedback for their actions.
     */
    onMutate: async (newData: BulkUpdateTransactionDTO) => {
      // 1. Cancel any outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['transactions'] });

      // 2. Snapshot all transaction queries for potential rollback
      const previousQueries = queryClient.getQueriesData<{
        pages: Array<{ data: TransactionViewEntity[]; count: number }>;
        pageParams: number[];
      }>({ queryKey: ['transactions', 'infinite'] });

      // 3. Optimistically update all matching transactions in cache
      const { transactionIds, updates } = newData;
      const idsToUpdate = new Set(transactionIds);

      queryClient.setQueriesData<{
        pages: Array<{ data: TransactionViewEntity[]; count: number }>;
        pageParams: number[];
      }>(
        { queryKey: ['transactions', 'infinite'] },
        (old) => {
          if (!old) return old;

          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: page.data.map((transaction) => {
                if (idsToUpdate.has(transaction.id)) {
                  // Apply optimistic updates
                  return {
                    ...transaction,
                    ...updates,
                    // Increment version optimistically (server will confirm)
                    version: transaction.version + 1,
                  };
                }
                return transaction;
              }),
            })),
          };
        }
      );

      // 4. Return context with snapshot for rollback
      return { previousQueries };
    },

    /**
     * Rollback: Restore cache to previous state on error
     */
    onError: (_err, _newData, context) => {
      // Restore all queries to their previous state
      if (context?.previousQueries) {
        context.previousQueries.forEach((entry) => {
          const [queryKey, data] = entry as [readonly unknown[], unknown];
          queryClient.setQueryData(queryKey, data);
        });
      }
    },

    /**
     * Settlement: Invalidate to ensure server-authoritative data
     * This runs after success OR error to sync with truth.
     */
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

/**
 * Hook for fetching category counts
 *
 * CTO MANDATE: Orchestrator Rule
 * Query is disabled until service is ready.
 *
 * @param filters - Optional transaction filters
 * @returns Query result with category counts
 */
export function useCategoryCounts(filters?: TransactionFilters) {
  const service = useTransactionService();

  return useQuery({
    queryKey: ['transactions', 'category-counts', filters],
    queryFn: () => service!.getCategoryCounts(filters),
    ...createQueryOptions('TRANSACTIONAL'),
    // CTO MANDATE: Orchestrator Rule - wait for service
    enabled: !!service,
  });
}
