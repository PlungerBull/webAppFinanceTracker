/**
 * useBulkSelection Hook (Domain Controller)
 *
 * Encapsulates all bulk selection behavior for transactions:
 * - Modifier key handling (Shift, Cmd/Ctrl)
 * - Range selection
 * - Bulk apply orchestration
 * - Selection cleanup on filter changes
 *
 * CTO MANDATES:
 * 1. Domain Controller Pattern - Manages state transitions only
 * 2. No direct side effects (toasts, navigation) - Use callbacks
 * 3. Swift/iOS Portable - State machine can be mirrored in Swift ViewModel
 * 4. Offline-First Ready - Tracks `isPendingSync` for optimistic UI
 *
 * State Machine:
 * - idle: isBulkMode=false, selectedIds=∅
 * - selecting: isBulkMode=true, selectedIds.size >= 0
 * - applying: isBulkMode=true, isPendingSync=true
 *
 * @module use-bulk-selection
 */

import { useEffect, useMemo, useCallback } from 'react';
import { useTransactionSelection } from '@/stores/transaction-selection-store';
import { useBulkUpdateTransactions } from './use-transactions';
import { useLinkTransactions, useUnlinkTransactions } from '@/features/reconciliations/hooks/use-reconciliations';
import type { TransactionViewEntity } from '../domain';

/**
 * Staged updates interface (mirrors store definition)
 */
export interface StagedUpdates {
  categoryId?: string;
  accountId?: string;
  date?: string;
  notes?: string;
  reconciliationId?: string | null;
}

/**
 * Callbacks for bulk apply operation
 * Side effects are passed in, not executed inside the hook (CTO Mandate)
 */
export interface BulkApplyCallbacks {
  /** Called on successful bulk update */
  onSuccess?: (result: { successCount: number; failureCount: number }) => void;
  /** Called on error */
  onError?: (error: Error) => void;
  /** Called when selection is large (>= 50 items) before apply */
  onLargeSelection?: (count: number) => void;
}

/**
 * Options for useBulkSelection hook
 */
export interface UseBulkSelectionOptions {
  /** Current visible transactions (for version tracking and cleanup) */
  transactions: TransactionViewEntity[];
  /** Callback when a transaction should be focused (detail panel) */
  onFocusTransaction?: (id: string) => void;
  /**
   * Stable string key representing filter state
   * CTO Mandate: Use filterKey from useTransactionFilters (no JSON.stringify)
   */
  filterKey?: string;
}

/**
 * Return type for useBulkSelection hook
 */
export interface UseBulkSelectionReturn {
  // State (proxied from Zustand store)
  selectedIds: Set<string>;
  isBulkMode: boolean;
  stagedUpdates: StagedUpdates;
  canApply: boolean;
  hasSelection: boolean;

  // Optimistic UI / Offline-First State
  isPendingSync: boolean;

  // Actions (Platform-Agnostic - no side effects)
  handleToggleBulkMode: () => void;
  handleToggleSelection: (id: string, index: number, event: React.MouseEvent) => void;
  enterBulkMode: () => void;
  clearSelection: () => void;
  setStagedUpdate: (field: keyof StagedUpdates, value: string | null | undefined) => void;
  clearStagedUpdates: () => void;

  // Bulk apply with callbacks (no direct toast dependency)
  handleBulkApply: (callbacks?: BulkApplyCallbacks) => Promise<void>;
}

/**
 * Domain Controller hook for bulk selection operations
 *
 * This hook orchestrates bulk selection state, modifier key handling,
 * and bulk apply mutations. Side effects (toasts, navigation) are
 * passed as callbacks to maintain Swift/iOS portability.
 *
 * @example
 * ```tsx
 * const bulk = useBulkSelection({
 *   transactions,
 *   onFocusTransaction: setSelectedTransactionId,
 *   filterDependencies: [searchQuery, selectedDate, sortBy],
 * });
 *
 * // Apply with callbacks
 * const handleApply = () => bulk.handleBulkApply({
 *   onSuccess: (result) => toast.success(`Updated ${result.successCount}`),
 *   onError: (err) => toast.error(err.message),
 * });
 * ```
 */
export function useBulkSelection({
  transactions,
  onFocusTransaction,
  filterKey = '',
}: UseBulkSelectionOptions): UseBulkSelectionReturn {
  // Access Zustand store
  const {
    selectedIds,
    isBulkMode,
    stagedUpdates,
    lastSelectedIndex,
    toggleSelection,
    selectRange,
    clearSelection,
    setStagedUpdate,
    clearStagedUpdates,
    enterBulkMode,
    exitBulkMode,
    hasSelection,
    canApply,
    getSelectedIds,
  } = useTransactionSelection();

  // Mutation hooks
  const bulkUpdateMutation = useBulkUpdateTransactions();
  const linkTransactionsMutation = useLinkTransactions();
  const unlinkTransactionsMutation = useUnlinkTransactions();

  // Compute isPendingSync from mutation states
  const isPendingSync = useMemo(
    () =>
      bulkUpdateMutation.isPending ||
      linkTransactionsMutation.isPending ||
      unlinkTransactionsMutation.isPending,
    [bulkUpdateMutation.isPending, linkTransactionsMutation.isPending, unlinkTransactionsMutation.isPending]
  );

  // Build lookup maps for version tracking
  const transactionVersionMap = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach((t) => map.set(t.id, t.version));
    return map;
  }, [transactions]);

  const allTransactionIds = useMemo(
    () => transactions.map((t) => t.id),
    [transactions]
  );

  const allTransactionVersions = useMemo(
    () => transactions.map((t) => t.version),
    [transactions]
  );

  /**
   * CTO Enhancement: Selection Intersection Effect
   * When filters change, selectedIds may reference transactions no longer visible.
   * TRUE INTERSECTION: Remove only stale IDs, preserve valid selections.
   *
   * Example: User selects 50 items, changes filter, 48 remain visible
   * Result: Keep 48 selected, remove 2 stale (not full clear!)
   */
  useEffect(() => {
    if (!isBulkMode || selectedIds.size === 0) return;

    const visibleIds = new Set(allTransactionIds);
    const staleIds = Array.from(selectedIds).filter((id) => !visibleIds.has(id));

    if (staleIds.length > 0) {
      // CTO Mandate: True intersection - remove only stale IDs, not full clear
      // This preserves valid selections while removing items no longer visible
      staleIds.forEach((staleId) => {
        // Get the version for this stale ID (default to 1 if not found)
        const version = transactionVersionMap.get(staleId) ?? 1;
        toggleSelection(staleId, -1, version);
      });
    }
  }, [filterKey, isBulkMode, selectedIds, allTransactionIds, transactionVersionMap, toggleSelection]);

  /**
   * Toggle bulk mode on/off
   */
  const handleToggleBulkMode = useCallback(() => {
    if (isBulkMode) {
      exitBulkMode();
    } else {
      enterBulkMode();
    }
  }, [isBulkMode, enterBulkMode, exitBulkMode]);

  /**
   * Handle selection toggle with modifier key support
   *
   * Selection Logic (Platform-Agnostic):
   * - Normal Click: Reset + Select + Focus
   * - Cmd/Ctrl+Click: Toggle individual item (additive)
   * - Shift+Click: Range selection from last selected
   */
  const handleToggleSelection = useCallback(
    (id: string, index: number, event: React.MouseEvent) => {
      const hasModifierKey = event.shiftKey || event.metaKey || event.ctrlKey;
      const version = transactionVersionMap.get(id) ?? 1;

      if (event.shiftKey && lastSelectedIndex !== null) {
        // Shift+Click: Range selection from last selected to current
        selectRange(lastSelectedIndex, index, allTransactionIds, allTransactionVersions);
      } else if (hasModifierKey) {
        // Cmd/Ctrl+Click: Toggle individual item (additive selection)
        toggleSelection(id, index, version);
      } else {
        // Normal Click: RESET behavior (like Finder/Windows Explorer)
        // Clear all selections, focus this item, start new selection set
        clearSelection();
        toggleSelection(id, index, version);
        onFocusTransaction?.(id);
      }
    },
    [
      lastSelectedIndex,
      allTransactionIds,
      allTransactionVersions,
      transactionVersionMap,
      selectRange,
      toggleSelection,
      clearSelection,
      onFocusTransaction,
    ]
  );

  /**
   * Handle bulk apply with callbacks (no direct toast dependency)
   *
   * Bifurcated path:
   * 1. Reconciliation linking/unlinking (if reconciliationId in stagedUpdates)
   * 2. Standard bulk update for other fields
   */
  const handleBulkApply = useCallback(
    async (callbacks?: BulkApplyCallbacks) => {
      const { onSuccess, onError, onLargeSelection } = callbacks ?? {};

      // Validation
      if (!canApply()) {
        onError?.(new Error('Please select transactions and specify at least one field to update'));
        return;
      }

      // Large selection warning (callback, not toast)
      if (selectedIds.size >= 50) {
        onLargeSelection?.(selectedIds.size);
      }

      try {
        // Handle reconciliation linking/unlinking separately
        if ('reconciliationId' in stagedUpdates) {
          const reconciliationId = stagedUpdates.reconciliationId;

          if (reconciliationId === undefined) {
            // Unlink transactions
            const result = await unlinkTransactionsMutation.mutateAsync(Array.from(selectedIds));
            onSuccess?.({
              successCount: result.successCount,
              failureCount: result.errorCount,
            });
          } else if (reconciliationId) {
            // Link transactions to reconciliation
            const result = await linkTransactionsMutation.mutateAsync({
              reconciliationId,
              transactionIds: Array.from(selectedIds),
            });
            onSuccess?.({
              successCount: result.successCount,
              failureCount: result.errorCount,
            });
          }

          // Clear selections and staged updates after successful operation
          clearSelection();
          clearStagedUpdates();
          return;
        }

        // Standard bulk update for other fields
        const result = await bulkUpdateMutation.mutateAsync({
          transactionIds: getSelectedIds(),
          updates: stagedUpdates,
        });

        onSuccess?.({
          successCount: result.successCount,
          failureCount: result.failureCount,
        });

        // Clear selections and staged updates after successful operation
        clearSelection();
        clearStagedUpdates();
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Failed to update transactions'));
      }
    },
    [
      canApply,
      selectedIds,
      stagedUpdates,
      getSelectedIds,
      bulkUpdateMutation,
      linkTransactionsMutation,
      unlinkTransactionsMutation,
      clearSelection,
      clearStagedUpdates,
    ]
  );

  return {
    // State
    selectedIds,
    isBulkMode,
    stagedUpdates,
    canApply: canApply(),
    hasSelection: hasSelection(),
    isPendingSync,

    // Actions
    handleToggleBulkMode,
    handleToggleSelection,
    enterBulkMode,
    clearSelection,
    setStagedUpdate,
    clearStagedUpdates,
    handleBulkApply,
  };
}
