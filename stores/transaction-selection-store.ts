import { create } from 'zustand';

interface StagedUpdates {
  categoryId?: string;
  accountId?: string;
  date?: string;
  notes?: string;
}

interface TransactionSelectionState {
  // Selection state
  selectedIds: Set<string>;
  lastSelectedIndex: number | null;
  isBulkMode: boolean;

  // Staged updates (field-level intent tracking)
  stagedUpdates: StagedUpdates;

  // Actions
  toggleSelection: (id: string, index: number) => void;
  selectRange: (startIndex: number, endIndex: number, allTransactionIds: string[]) => void;
  clearSelection: () => void;
  setStagedUpdate: (field: keyof StagedUpdates, value: string | undefined) => void;
  clearStagedUpdates: () => void;
  enterBulkMode: () => void;
  exitBulkMode: () => void;

  // Computed getters
  hasSelection: () => boolean;
  canApply: () => boolean;
}

export const useTransactionSelection = create<TransactionSelectionState>((set, get) => ({
  selectedIds: new Set(),
  lastSelectedIndex: null,
  isBulkMode: false,
  stagedUpdates: {},

  toggleSelection: (id, index) => set((state) => {
    const newSelected = new Set(state.selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    return {
      selectedIds: newSelected,
      lastSelectedIndex: index,
    };
  }),

  selectRange: (startIndex, endIndex, allTransactionIds) => set((state) => {
    const newSelected = new Set(state.selectedIds);
    const [min, max] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];

    // Only select items within loaded range (virtualization safety)
    for (let i = min; i <= max; i++) {
      if (i >= 0 && i < allTransactionIds.length && allTransactionIds[i]) {
        newSelected.add(allTransactionIds[i]);
      }
    }

    return {
      selectedIds: newSelected,
      lastSelectedIndex: endIndex,
    };
  }),

  clearSelection: () => set({
    selectedIds: new Set(),
    lastSelectedIndex: null,
  }),

  setStagedUpdate: (field, value) => set((state) => {
    const newStaged = { ...state.stagedUpdates };
    if (value === undefined) {
      delete newStaged[field]; // Reset to "No Change"
    } else {
      newStaged[field] = value;
    }
    return { stagedUpdates: newStaged };
  }),

  clearStagedUpdates: () => set({ stagedUpdates: {} }),

  enterBulkMode: () => set({ isBulkMode: true }),

  exitBulkMode: () => set({
    isBulkMode: false,
    selectedIds: new Set(),
    lastSelectedIndex: null,
    stagedUpdates: {},
  }),

  hasSelection: () => get().selectedIds.size > 0,

  canApply: () => {
    const { selectedIds, stagedUpdates } = get();
    return selectedIds.size > 0 && Object.keys(stagedUpdates).length > 0;
  },
}));
