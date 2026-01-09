import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reconciliationsApi } from '../api/reconciliations';
import { toast } from 'sonner';

const QUERY_KEYS = {
  RECONCILIATIONS: {
    ALL: ['reconciliations'] as const,
    BY_ACCOUNT: (accountId: string) => ['reconciliations', 'account', accountId] as const,
    BY_ID: (id: string) => ['reconciliations', id] as const,
    SUMMARY: (id: string) => ['reconciliations', id, 'summary'] as const,
  },
};

/**
 * Fetch all reconciliations (optionally filtered by account)
 */
export function useReconciliations(accountId?: string) {
  return useQuery({
    queryKey: accountId
      ? QUERY_KEYS.RECONCILIATIONS.BY_ACCOUNT(accountId)
      : QUERY_KEYS.RECONCILIATIONS.ALL,
    queryFn: () => reconciliationsApi.getAll(accountId),
  });
}

/**
 * Fetch single reconciliation
 */
export function useReconciliation(id: string | null | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.RECONCILIATIONS.BY_ID(id || 'none'),
    queryFn: () => reconciliationsApi.getById(id!),
    enabled: !!id,
  });
}

/**
 * Fetch reconciliation summary (real-time math)
 *
 * IMPORTANT: NO POLLING - uses query invalidation instead
 * CTO Directive: Rely on TanStack Query invalidation upon mutation success
 * (link/unlink mutations invalidate this query for instant updates)
 */
export function useReconciliationSummary(reconciliationId: string | null | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.RECONCILIATIONS.SUMMARY(reconciliationId || 'none'),
    queryFn: () => reconciliationsApi.getSummary(reconciliationId!),
    enabled: !!reconciliationId,
    // NO refetchInterval - invalidation handles updates
  });
}

/**
 * Create reconciliation
 */
export function useCreateReconciliation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reconciliationsApi.create,
    onSuccess: (data) => {
      // Invalidate reconciliation lists
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.RECONCILIATIONS.ALL });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.RECONCILIATIONS.BY_ACCOUNT(data.accountId),
      });
      toast.success('Reconciliation created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create reconciliation: ${error.message}`);
    },
  });
}

/**
 * Update reconciliation
 */
export function useUpdateReconciliation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: {
      id: string;
      updates: Parameters<typeof reconciliationsApi.update>[1]
    }) => reconciliationsApi.update(id, updates),
    onSuccess: (data) => {
      // Invalidate reconciliation lists and specific reconciliation
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.RECONCILIATIONS.ALL });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.RECONCILIATIONS.BY_ACCOUNT(data.accountId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.RECONCILIATIONS.BY_ID(data.id),
      });
      // Also invalidate summary in case status changed
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.RECONCILIATIONS.SUMMARY(data.id),
      });
      toast.success('Reconciliation updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update reconciliation: ${error.message}`);
    },
  });
}

/**
 * Delete reconciliation
 */
export function useDeleteReconciliation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reconciliationsApi.delete,
    onSuccess: () => {
      // Invalidate all reconciliation queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.RECONCILIATIONS.ALL });
      toast.success('Reconciliation deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete reconciliation: ${error.message}`);
    },
  });
}

/**
 * Link transactions to reconciliation
 *
 * CRITICAL: Invalidates reconciliation summary on success for instant HUD updates
 */
export function useLinkTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reconciliationId, transactionIds }: {
      reconciliationId: string;
      transactionIds: string[];
    }) => reconciliationsApi.linkTransactions(reconciliationId, transactionIds),
    onSuccess: (result, { reconciliationId }) => {
      // CRITICAL: Invalidate transactions query (to refresh cleared flags)
      queryClient.invalidateQueries({ queryKey: ['transactions'] });

      // CRITICAL: Invalidate reconciliation summary (for instant HUD math update)
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.RECONCILIATIONS.SUMMARY(reconciliationId),
      });

      // Show appropriate toast based on results
      if (result.errorCount > 0) {
        toast.error(
          `Linked ${result.successCount} transactions, ${result.errorCount} failed.`,
          { duration: 5000 }
        );
      } else {
        toast.success(`Successfully linked ${result.successCount} transactions`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to link transactions: ${error.message}`);
    },
  });
}

/**
 * Unlink transactions from reconciliation
 *
 * CRITICAL: Invalidates reconciliation summary on success for instant HUD updates
 */
export function useUnlinkTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reconciliationsApi.unlinkTransactions,
    onSuccess: (result) => {
      // CRITICAL: Invalidate transactions query (to refresh cleared flags)
      queryClient.invalidateQueries({ queryKey: ['transactions'] });

      // CRITICAL: Invalidate all reconciliation summaries (we don't know which was affected)
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.RECONCILIATIONS.ALL });

      // Show appropriate toast based on results
      if (result.errorCount > 0) {
        toast.error(
          `Unlinked ${result.successCount} transactions, ${result.errorCount} failed.`,
          { duration: 5000 }
        );
      } else {
        toast.success(`Successfully unlinked ${result.successCount} transactions`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to unlink transactions: ${error.message}`);
    },
  });
}
