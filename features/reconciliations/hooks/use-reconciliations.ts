/**
 * @deprecated Import from @/lib/hooks/use-reconciliations instead.
 * This file re-exports from the orchestration layer for backward compatibility.
 */

export {
  useReconciliations,
  useReconciliation,
  useReconciliationSummary,
  useCreateReconciliation,
  useUpdateReconciliation,
  useDeleteReconciliation,
  useLinkTransactions,
  useUnlinkTransactions,
} from '@/lib/hooks/use-reconciliations';
