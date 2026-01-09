import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionsApi } from '../api/transactions';
import type {
  CreateTransactionFormData,
  CreateTransactionLedgerData,
  UpdateTransactionFormData
} from '../schemas/transaction.schema';
import type { TransactionFilters } from '../api/filters';
import { PAGINATION } from '@/lib/constants';

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
    mutationFn: (data: CreateTransactionLedgerData) => transactionsApi.create(data),
    onSuccess: () => {
      // Invalidate all transaction-related queries (including category counts)
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTransactionFormData }) =>
      transactionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useUpdateTransactionBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: {
      id: string;
      updates: {
        description?: string;
        amount?: number;
        accountId?: string;
        categoryId?: string;
        date?: string;
        notes?: string;
      };
    }) => transactionsApi.updateBatch(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => transactionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useBulkUpdateTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ids, updates }: {
      ids: string[];
      updates: {
        categoryId?: string;
        accountId?: string;
        date?: string;
        notes?: string;
      };
    }) => transactionsApi.bulkUpdate(ids, updates),
    onSuccess: (data) => {
      // Invalidate all transaction queries (including infinite query)
      queryClient.invalidateQueries({ queryKey: ['transactions'] });

      // Invalidate accounts (balances may have changed)
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
