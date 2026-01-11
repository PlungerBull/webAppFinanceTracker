import { create } from 'zustand';

interface StagedUpdates {
  categoryId?: string;
  accountId?: string;
  date?: string;
  notes?: string;
  reconciliationId?: string | null;
}

/**
 * Selected transaction with version for optimistic concurrency control
 * Version is required for version-checked bulk updates
 */
interface SelectedTransaction {
  id: string;
  version: number;
}

interface TransactionSelectionState {
  // Selection state - NEW: Track ID + version pairs for optimistic locking
  selectedTransactions: Map<string, SelectedTransaction>; // Key = transaction ID
  selectedIds: Set<string>; // DEPRECATED: Keep for backward compatibility during migration
  lastSelectedIndex: number | null;
  isBulkMode: boolean;

  // Staged updates (field-level intent tracking)
  stagedUpdates: StagedUpdates;

  // Actions
  toggleSelection: (id: string, index: number, version?: number) => void;
  selectRange: (startIndex: number, endIndex: number, allTransactionIds: string[], allTransactionVersions?: number[]) => void;
  clearSelection: () => void;
  setStagedUpdate: (field: keyof StagedUpdates, value: string | null | undefined) => void;
  clearStagedUpdates: () => void;
  enterBulkMode: () => void;
  exitBulkMode: () => void;

  // Computed getters
  hasSelection: () => boolean;
  canApply: () => boolean;

  // NEW: Version-aware getters for bulk operations
  getSelectedIds: () => string[];
  getSelectedVersions: () => number[];
  getSelectedPairs: () => SelectedTransaction[];
}

export const useTransactionSelection = create<TransactionSelectionState>((set, get) => ({
  selectedTransactions: new Map(),
  selectedIds: new Set(), // DEPRECATED: Kept for backward compatibility
  lastSelectedIndex: null,
  isBulkMode: false,
  stagedUpdates: {},

  toggleSelection: (id, index, version = 1) => set((state) => {
    const newSelectedTransactions = new Map(state.selectedTransactions);
    const newSelectedIds = new Set(state.selectedIds);

    if (newSelectedTransactions.has(id)) {
      newSelectedTransactions.delete(id);
      newSelectedIds.delete(id); // Keep deprecated Set in sync
    } else {
      newSelectedTransactions.set(id, { id, version });
      newSelectedIds.add(id); // Keep deprecated Set in sync
    }

    return {
      selectedTransactions: newSelectedTransactions,
      selectedIds: newSelectedIds,
      lastSelectedIndex: index,
    };
  }),

  selectRange: (startIndex, endIndex, allTransactionIds, allTransactionVersions = []) => set((state) => {
    const newSelectedTransactions = new Map(state.selectedTransactions);
    const newSelectedIds = new Set(state.selectedIds);
    const [min, max] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];

    // Only select items within loaded range (virtualization safety)
    for (let i = min; i <= max; i++) {
      if (i >= 0 && i < allTransactionIds.length && allTransactionIds[i]) {
        const id = allTransactionIds[i];
        const version = allTransactionVersions[i] ?? 1; // Default to version 1 if not provided
        newSelectedTransactions.set(id, { id, version });
        newSelectedIds.add(id); // Keep deprecated Set in sync
      }
    }

    return {
      selectedTransactions: newSelectedTransactions,
      selectedIds: newSelectedIds,
      lastSelectedIndex: endIndex,
    };
  }),

  clearSelection: () => set({
    selectedTransactions: new Map(),
    selectedIds: new Set(),
    lastSelectedIndex: null,
  }),

  setStagedUpdate: (field, value) => set((state) => {
    const newStaged = { ...state.stagedUpdates };
    if (value === undefined) {
      delete newStaged[field]; // Reset to "No Change"
    } else if (field === 'reconciliationId') {
      // reconciliationId can be string | null
      newStaged.reconciliationId = value;
    } else {
      // Other fields are string only (filter out null)
      if (value !== null) {
        newStaged[field] = value;
      }
    }
    return { stagedUpdates: newStaged };
  }),

  clearStagedUpdates: () => set({ stagedUpdates: {} }),

  enterBulkMode: () => set({ isBulkMode: true }),

  exitBulkMode: () => set({
    isBulkMode: false,
    selectedTransactions: new Map(),
    selectedIds: new Set(),
    lastSelectedIndex: null,
    stagedUpdates: {},
  }),

  hasSelection: () => get().selectedTransactions.size > 0,

  canApply: () => {
    const { selectedTransactions, stagedUpdates } = get();
    return selectedTransactions.size > 0 && Object.keys(stagedUpdates).length > 0;
  },

  // NEW: Version-aware getters for bulk operations
  getSelectedIds: () => {
    return Array.from(get().selectedTransactions.keys());
  },

  getSelectedVersions: () => {
    return Array.from(get().selectedTransactions.values()).map(txn => txn.version);
  },

  getSelectedPairs: () => {
    return Array.from(get().selectedTransactions.values());
  },
}));
