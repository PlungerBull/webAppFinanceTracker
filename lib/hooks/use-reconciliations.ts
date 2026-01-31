/**
 * Reconciliations Orchestrator Hook
 *
 * Provides reconciliation operations for cross-feature use.
 * Wraps the reconciliations feature implementation without creating direct feature coupling.
 *
 * ARCHITECTURE PATTERN:
 * - Components import from @/lib/hooks/use-reconciliations
 * - This hook internally uses the reconciliations feature API
 * - Features never import from @/features/reconciliations/hooks
 *
 * @module lib/hooks/use-reconciliations
 */

'use client';

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { createReconciliationsService } from '@/features/reconciliations/api/reconciliations';
import { toast } from 'sonner';

const QUERY_KEYS = {
  RECONCILIATIONS: {
    ALL: ['reconciliations'] as const,
    BY_ACCOUNT: (accountId: string) => ['reconciliations', 'account', accountId] as const,
    BY_ID: (id: string) => ['reconciliations', id] as const,
    SUMMARY: (id: string) => ['reconciliations', id, 'summary'] as const,
  },
};

function useReconciliationsService() {
  return useMemo(() => {
    const supabase = createClient();
    return createReconciliationsService(supabase);
  }, []);
}

/**
 * Fetch all reconciliations (optionally filtered by account)
 */
export function useReconciliations(accountId?: string) {
  const service = useReconciliationsService();

  return useQuery({
    queryKey: accountId
      ? QUERY_KEYS.RECONCILIATIONS.BY_ACCOUNT(accountId)
      : QUERY_KEYS.RECONCILIATIONS.ALL,
    queryFn: () => service.getAll(accountId),
  });
}

/**
 * Fetch single reconciliation
 */
export function useReconciliation(id: string | null | undefined) {
  const service = useReconciliationsService();

  return useQuery({
    queryKey: QUERY_KEYS.RECONCILIATIONS.BY_ID(id || 'none'),
    queryFn: () => service.getById(id!),
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
  const service = useReconciliationsService();

  return useQuery({
    queryKey: QUERY_KEYS.RECONCILIATIONS.SUMMARY(reconciliationId || 'none'),
    queryFn: () => service.getSummary(reconciliationId!),
    enabled: !!reconciliationId,
    // NO refetchInterval - invalidation handles updates
  });
}

/**
 * Create reconciliation
 */
export function useCreateReconciliation() {
  const queryClient = useQueryClient();
  const service = useReconciliationsService();

  return useMutation({
    mutationFn: (data: Parameters<typeof service.create>[0]) => service.create(data),
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
  const service = useReconciliationsService();

  return useMutation({
    mutationFn: ({ id, updates }: {
      id: string;
      updates: Parameters<typeof service.update>[1]
    }) => service.update(id, updates),
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
 * Delete reconciliation (version-checked soft delete)
 *
 * CTO Mandate: Optimistic concurrency control prevents data loss from
 * concurrent modifications across devices.
 */
export function useDeleteReconciliation() {
  const queryClient = useQueryClient();
  const service = useReconciliationsService();

  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      service.delete(id, version),
    onSuccess: (result) => {
      if (result.success) {
        // Invalidate all reconciliation queries
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.RECONCILIATIONS.ALL });
        // Invalidate transactions (they may have been unlinked)
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        toast.success('Reconciliation deleted successfully');
      } else {
        // Handle specific errors
        if (result.error === 'version_conflict') {
          toast.error('This reconciliation was modified. Please refresh and try again.');
        } else if (result.error === 'reconciliation_completed') {
          toast.error('Cannot delete a completed reconciliation. Change status to draft first.');
        } else if (result.error === 'not_found') {
          toast.error('Reconciliation not found or already deleted.');
        } else {
          toast.error(`Failed to delete reconciliation: ${result.error}`);
        }
      }
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
  const service = useReconciliationsService();

  return useMutation({
    mutationFn: ({ reconciliationId, transactionIds }: {
      reconciliationId: string;
      transactionIds: string[];
    }) => service.linkTransactions(reconciliationId, transactionIds),
    onSuccess: (result, { reconciliationId }) => {
      // CRITICAL: Invalidate transactions query (to refresh cleared flags)
      queryClient.invalidateQueries({ queryKey: ['transactions'] });

      // CRITICAL: Invalidate reconciliation summary (for instant HUD math update)
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.RECONCILIATIONS.SUMMARY(reconciliationId),
      });

      // Show appropriate toast based on results
      if (result.errorCount > 0) {
        // Extract unique error messages (group by error type)
        const errorMessages = result.errors.map(e => e.error);
        const uniqueErrors = [...new Set(errorMessages)];

        // Show detailed error for Sacred Ledger violations and other specific errors
        const errorDetail = uniqueErrors.length === 1
          ? uniqueErrors[0]
          : `${uniqueErrors.join(', ')}`;

        toast.error(
          `Linked ${result.successCount} transactions, ${result.errorCount} failed: ${errorDetail}`,
          { duration: 6000 }
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
  const service = useReconciliationsService();

  return useMutation({
    mutationFn: (transactionIds: string[]) => service.unlinkTransactions(transactionIds),
    onSuccess: (result) => {
      // CRITICAL: Invalidate transactions query (to refresh cleared flags)
      queryClient.invalidateQueries({ queryKey: ['transactions'] });

      // CRITICAL: Invalidate all reconciliation summaries (we don't know which was affected)
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.RECONCILIATIONS.ALL });

      // Show appropriate toast based on results
      if (result.errorCount > 0) {
        // Extract unique error messages (group by error type)
        const errorMessages = result.errors.map(e => e.error);
        const uniqueErrors = [...new Set(errorMessages)];

        // Show detailed error messages
        const errorDetail = uniqueErrors.length === 1
          ? uniqueErrors[0]
          : `${uniqueErrors.join(', ')}`;

        toast.error(
          `Unlinked ${result.successCount} transactions, ${result.errorCount} failed: ${errorDetail}`,
          { duration: 6000 }
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
