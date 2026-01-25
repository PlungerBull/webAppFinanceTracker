/**
 * Unit Tests for useBulkSelection Hook
 *
 * CTO MANDATE: Unit test the Domain Controller before integration.
 *
 * Tests cover:
 * - Selection toggle (normal, Cmd/Ctrl, Shift)
 * - Range selection
 * - Selection cleanup on filter changes
 * - Bulk apply (standard and reconciliation paths)
 * - Callback invocation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBulkSelection } from '../use-bulk-selection';
import type { TransactionViewEntity } from '../../domain';

// Mock the Zustand store with explicit types to avoid TypeScript literal inference
const mockStoreState: {
  selectedIds: Set<string>;
  selectedTransactions: Map<string, { id: string; version: number }>;
  isBulkMode: boolean;
  stagedUpdates: Record<string, unknown>;
  lastSelectedIndex: number | null;
  toggleSelection: ReturnType<typeof vi.fn>;
  selectRange: ReturnType<typeof vi.fn>;
  clearSelection: ReturnType<typeof vi.fn>;
  setStagedUpdate: ReturnType<typeof vi.fn>;
  clearStagedUpdates: ReturnType<typeof vi.fn>;
  enterBulkMode: ReturnType<typeof vi.fn>;
  exitBulkMode: ReturnType<typeof vi.fn>;
  hasSelection: ReturnType<typeof vi.fn>;
  canApply: ReturnType<typeof vi.fn>;
  getSelectedIds: ReturnType<typeof vi.fn>;
  getSelectedVersions: ReturnType<typeof vi.fn>;
  getSelectedPairs: ReturnType<typeof vi.fn>;
} = {
  selectedIds: new Set<string>(),
  selectedTransactions: new Map<string, { id: string; version: number }>(),
  isBulkMode: false,
  stagedUpdates: {},
  lastSelectedIndex: null,
  toggleSelection: vi.fn(),
  selectRange: vi.fn(),
  clearSelection: vi.fn(),
  setStagedUpdate: vi.fn(),
  clearStagedUpdates: vi.fn(),
  enterBulkMode: vi.fn(),
  exitBulkMode: vi.fn(),
  hasSelection: vi.fn(() => false),
  canApply: vi.fn(() => false),
  getSelectedIds: vi.fn(() => []),
  getSelectedVersions: vi.fn(() => []),
  getSelectedPairs: vi.fn(() => []),
};

vi.mock('@/stores/transaction-selection-store', () => ({
  useTransactionSelection: () => mockStoreState,
}));

// Mock the mutation hooks
const mockBulkUpdateMutate = vi.fn();
const mockLinkMutate = vi.fn();
const mockUnlinkMutate = vi.fn();

vi.mock('../use-transactions', () => ({
  useBulkUpdateTransactions: () => ({
    mutateAsync: mockBulkUpdateMutate,
    isPending: false,
  }),
}));

vi.mock('@/features/reconciliations/hooks/use-reconciliations', () => ({
  useLinkTransactions: () => ({
    mutateAsync: mockLinkMutate,
    isPending: false,
  }),
  useUnlinkTransactions: () => ({
    mutateAsync: mockUnlinkMutate,
    isPending: false,
  }),
}));

// Helper to create mock transactions
function createMockTransaction(id: string, version = 1): TransactionViewEntity {
  return {
    id,
    version,
    userId: 'user-1',
    amountCents: 1000,
    amountHomeCents: 1000,
    currencyOriginal: 'USD',
    exchangeRate: 1,
    accountId: 'account-1',
    categoryId: 'category-1',
    transferId: null,
    description: `Transaction ${id}`,
    notes: null,
    date: '2024-01-15T10:00:00.000Z',
    createdAt: '2024-01-15T10:00:00.000Z',
    updatedAt: '2024-01-15T10:00:00.000Z',
    deletedAt: null,
    reconciliationId: null,
    cleared: false,
    accountName: 'Test Account',
    accountCurrency: 'USD',
    accountColor: '#000000',
    categoryName: 'Test Category',
    categoryColor: '#FF0000',
    categoryType: 'expense',
    reconciliationStatus: null,
  };
}

// Helper to create mock mouse event
function createMouseEvent(options: Partial<React.MouseEvent> = {}): React.MouseEvent {
  return {
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    ...options,
  } as React.MouseEvent;
}

describe('useBulkSelection', () => {
  const mockTransactions = [
    createMockTransaction('txn-1', 1),
    createMockTransaction('txn-2', 2),
    createMockTransaction('txn-3', 3),
    createMockTransaction('txn-4', 4),
    createMockTransaction('txn-5', 5),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    mockStoreState.selectedIds = new Set();
    mockStoreState.selectedTransactions = new Map();
    mockStoreState.isBulkMode = false;
    mockStoreState.stagedUpdates = {};
    mockStoreState.lastSelectedIndex = null;
    mockStoreState.hasSelection.mockReturnValue(false);
    mockStoreState.canApply.mockReturnValue(false);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('handleToggleSelection', () => {
    it('selects single item on normal click', () => {
      const onFocusTransaction = vi.fn();
      const { result } = renderHook(() =>
        useBulkSelection({
          transactions: mockTransactions,
          onFocusTransaction,
        })
      );

      act(() => {
        result.current.handleToggleSelection('txn-1', 0, createMouseEvent());
      });

      // Should clear selection first, then toggle
      expect(mockStoreState.clearSelection).toHaveBeenCalled();
      expect(mockStoreState.toggleSelection).toHaveBeenCalledWith('txn-1', 0, 1);
      expect(onFocusTransaction).toHaveBeenCalledWith('txn-1');
    });

    it('toggles item on Cmd+Click (macOS)', () => {
      const onFocusTransaction = vi.fn();
      const { result } = renderHook(() =>
        useBulkSelection({
          transactions: mockTransactions,
          onFocusTransaction,
        })
      );

      act(() => {
        result.current.handleToggleSelection(
          'txn-1',
          0,
          createMouseEvent({ metaKey: true })
        );
      });

      // Should NOT clear selection, just toggle
      expect(mockStoreState.clearSelection).not.toHaveBeenCalled();
      expect(mockStoreState.toggleSelection).toHaveBeenCalledWith('txn-1', 0, 1);
      // Should NOT focus (additive selection)
      expect(onFocusTransaction).not.toHaveBeenCalled();
    });

    it('toggles item on Ctrl+Click (Windows/Linux)', () => {
      const { result } = renderHook(() =>
        useBulkSelection({ transactions: mockTransactions })
      );

      act(() => {
        result.current.handleToggleSelection(
          'txn-2',
          1,
          createMouseEvent({ ctrlKey: true })
        );
      });

      expect(mockStoreState.clearSelection).not.toHaveBeenCalled();
      expect(mockStoreState.toggleSelection).toHaveBeenCalledWith('txn-2', 1, 2);
    });

    it('selects range on Shift+Click', () => {
      // Set up lastSelectedIndex
      mockStoreState.lastSelectedIndex = 1;

      const { result } = renderHook(() =>
        useBulkSelection({ transactions: mockTransactions })
      );

      act(() => {
        result.current.handleToggleSelection(
          'txn-4',
          3,
          createMouseEvent({ shiftKey: true })
        );
      });

      // Should select range from index 1 to index 3
      expect(mockStoreState.selectRange).toHaveBeenCalledWith(
        1, // lastSelectedIndex
        3, // current index
        ['txn-1', 'txn-2', 'txn-3', 'txn-4', 'txn-5'], // all IDs
        [1, 2, 3, 4, 5] // all versions
      );
    });

    it('clears all and starts new selection on normal click', () => {
      // Setup: already have selections
      mockStoreState.selectedIds = new Set(['txn-2', 'txn-3']);
      mockStoreState.hasSelection.mockReturnValue(true);

      const onFocusTransaction = vi.fn();
      const { result } = renderHook(() =>
        useBulkSelection({
          transactions: mockTransactions,
          onFocusTransaction,
        })
      );

      act(() => {
        result.current.handleToggleSelection('txn-5', 4, createMouseEvent());
      });

      // Should clear first, then select new item
      expect(mockStoreState.clearSelection).toHaveBeenCalled();
      expect(mockStoreState.toggleSelection).toHaveBeenCalledWith('txn-5', 4, 5);
      expect(onFocusTransaction).toHaveBeenCalledWith('txn-5');
    });
  });

  describe('handleToggleBulkMode', () => {
    it('enters bulk mode when not in bulk mode', () => {
      mockStoreState.isBulkMode = false;

      const { result } = renderHook(() =>
        useBulkSelection({ transactions: mockTransactions })
      );

      act(() => {
        result.current.handleToggleBulkMode();
      });

      expect(mockStoreState.enterBulkMode).toHaveBeenCalled();
      expect(mockStoreState.exitBulkMode).not.toHaveBeenCalled();
    });

    it('exits bulk mode when in bulk mode', () => {
      mockStoreState.isBulkMode = true;

      const { result } = renderHook(() =>
        useBulkSelection({ transactions: mockTransactions })
      );

      act(() => {
        result.current.handleToggleBulkMode();
      });

      expect(mockStoreState.exitBulkMode).toHaveBeenCalled();
      expect(mockStoreState.enterBulkMode).not.toHaveBeenCalled();
    });
  });

  describe('selection cleanup (intersection logic)', () => {
    it('preserves valid selections when filter changes', async () => {
      mockStoreState.isBulkMode = true;
      mockStoreState.selectedIds = new Set(['txn-1', 'txn-2']);
      mockStoreState.hasSelection.mockReturnValue(true);

      const { rerender } = renderHook(
        ({ filterKey }) =>
          useBulkSelection({
            transactions: mockTransactions,
            filterKey,
          }),
        { initialProps: { filterKey: 'search1|none|none' } }
      );

      // Change filter - but all selected IDs are still in transactions
      rerender({ filterKey: 'search2|none|none' });

      // Since txn-1 and txn-2 are still visible, NO toggleSelection should be called
      // (intersection keeps all valid selections)
      expect(mockStoreState.toggleSelection).not.toHaveBeenCalled();
      expect(mockStoreState.clearSelection).not.toHaveBeenCalled();
    });

    it('removes only stale IDs via intersection (not full clear)', async () => {
      mockStoreState.isBulkMode = true;
      mockStoreState.selectedIds = new Set(['txn-1', 'txn-99']); // txn-99 doesn't exist
      mockStoreState.hasSelection.mockReturnValue(true);

      const { rerender } = renderHook(
        ({ filterKey }) =>
          useBulkSelection({
            transactions: mockTransactions,
            filterKey,
          }),
        { initialProps: { filterKey: 'filter1|none|none' } }
      );

      // Clear mocks from initial render before testing rerender behavior
      vi.clearAllMocks();

      // Trigger filter change to run cleanup effect
      rerender({ filterKey: 'filter2|none|none' });

      // CTO Mandate: True intersection - only stale IDs removed
      // txn-99 is not in mockTransactions, so it should be toggled off
      // txn-1 should remain selected (NOT cleared!)
      expect(mockStoreState.toggleSelection).toHaveBeenCalledWith('txn-99', -1, 1);
      expect(mockStoreState.toggleSelection).toHaveBeenCalledTimes(1);
      // clearSelection should NOT be called (true intersection, not full clear)
      expect(mockStoreState.clearSelection).not.toHaveBeenCalled();
    });

    it('removes multiple stale IDs via intersection', async () => {
      mockStoreState.isBulkMode = true;
      // 3 selected: 2 valid (txn-1, txn-2), 2 stale (txn-98, txn-99)
      mockStoreState.selectedIds = new Set(['txn-1', 'txn-2', 'txn-98', 'txn-99']);
      mockStoreState.hasSelection.mockReturnValue(true);

      const { rerender } = renderHook(
        ({ filterKey }) =>
          useBulkSelection({
            transactions: mockTransactions,
            filterKey,
          }),
        { initialProps: { filterKey: 'initial|none|none' } }
      );

      // Clear mocks from initial render before testing rerender behavior
      vi.clearAllMocks();

      rerender({ filterKey: 'changed|none|none' });

      // Only stale IDs (txn-98, txn-99) should be toggled off
      expect(mockStoreState.toggleSelection).toHaveBeenCalledWith('txn-98', -1, 1);
      expect(mockStoreState.toggleSelection).toHaveBeenCalledWith('txn-99', -1, 1);
      expect(mockStoreState.toggleSelection).toHaveBeenCalledTimes(2);
    });

    it('does nothing when not in bulk mode', async () => {
      mockStoreState.isBulkMode = false;
      mockStoreState.selectedIds = new Set(['txn-99']); // stale but not in bulk mode

      const { rerender } = renderHook(
        ({ filterKey }) =>
          useBulkSelection({
            transactions: mockTransactions,
            filterKey,
          }),
        { initialProps: { filterKey: 'filter1|none|none' } }
      );

      rerender({ filterKey: 'filter2|none|none' });

      // Not in bulk mode, so no cleanup happens
      expect(mockStoreState.toggleSelection).not.toHaveBeenCalled();
    });

    it('does nothing when selection is empty', async () => {
      mockStoreState.isBulkMode = true;
      mockStoreState.selectedIds = new Set();
      mockStoreState.hasSelection.mockReturnValue(false);

      const { rerender } = renderHook(
        ({ filterKey }) =>
          useBulkSelection({
            transactions: mockTransactions,
            filterKey,
          }),
        { initialProps: { filterKey: 'filter1|none|none' } }
      );

      rerender({ filterKey: 'filter2|none|none' });

      // Empty selection, nothing to clean up
      expect(mockStoreState.toggleSelection).not.toHaveBeenCalled();
    });
  });

  describe('handleBulkApply', () => {
    it('calls onSuccess callback with result counts on success', async () => {
      mockStoreState.canApply.mockReturnValue(true);
      mockStoreState.selectedIds = new Set(['txn-1', 'txn-2']);
      mockStoreState.stagedUpdates = { categoryId: 'new-category' };
      mockStoreState.getSelectedIds.mockReturnValue(['txn-1', 'txn-2']);

      mockBulkUpdateMutate.mockResolvedValue({
        successCount: 2,
        failureCount: 0,
        successIds: ['txn-1', 'txn-2'],
        failures: [],
      });

      const onSuccess = vi.fn();
      const { result } = renderHook(() =>
        useBulkSelection({ transactions: mockTransactions })
      );

      await act(async () => {
        await result.current.handleBulkApply({ onSuccess });
      });

      expect(mockBulkUpdateMutate).toHaveBeenCalledWith({
        transactionIds: ['txn-1', 'txn-2'],
        updates: { categoryId: 'new-category' },
      });
      expect(onSuccess).toHaveBeenCalledWith({
        successCount: 2,
        failureCount: 0,
      });
      expect(mockStoreState.clearSelection).toHaveBeenCalled();
      expect(mockStoreState.clearStagedUpdates).toHaveBeenCalled();
    });

    it('calls onError callback on failure', async () => {
      mockStoreState.canApply.mockReturnValue(true);
      mockStoreState.selectedIds = new Set(['txn-1']);
      mockStoreState.stagedUpdates = { categoryId: 'new-category' };

      const error = new Error('Network error');
      mockBulkUpdateMutate.mockRejectedValue(error);

      const onError = vi.fn();
      const { result } = renderHook(() =>
        useBulkSelection({ transactions: mockTransactions })
      );

      await act(async () => {
        await result.current.handleBulkApply({ onError });
      });

      expect(onError).toHaveBeenCalledWith(error);
    });

    it('calls onError when canApply returns false', async () => {
      mockStoreState.canApply.mockReturnValue(false);

      const onError = vi.fn();
      const { result } = renderHook(() =>
        useBulkSelection({ transactions: mockTransactions })
      );

      await act(async () => {
        await result.current.handleBulkApply({ onError });
      });

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Please select transactions and specify at least one field to update',
        })
      );
      expect(mockBulkUpdateMutate).not.toHaveBeenCalled();
    });

    it('calls onLargeSelection when >= 50 items selected', async () => {
      const largeSelection = new Set(
        Array.from({ length: 50 }, (_, i) => `txn-${i}`)
      );
      mockStoreState.canApply.mockReturnValue(true);
      mockStoreState.selectedIds = largeSelection;
      mockStoreState.stagedUpdates = { categoryId: 'new-category' };

      mockBulkUpdateMutate.mockResolvedValue({
        successCount: 50,
        failureCount: 0,
        successIds: [],
        failures: [],
      });

      const onLargeSelection = vi.fn();
      const { result } = renderHook(() =>
        useBulkSelection({ transactions: mockTransactions })
      );

      await act(async () => {
        await result.current.handleBulkApply({ onLargeSelection });
      });

      expect(onLargeSelection).toHaveBeenCalledWith(50);
    });

    it('uses reconciliation link path when reconciliationId is staged (non-null)', async () => {
      mockStoreState.canApply.mockReturnValue(true);
      mockStoreState.selectedIds = new Set(['txn-1', 'txn-2']);
      mockStoreState.stagedUpdates = { reconciliationId: 'recon-1' };

      mockLinkMutate.mockResolvedValue({
        successCount: 2,
        errorCount: 0,
        errors: [],
      });

      const onSuccess = vi.fn();
      const { result } = renderHook(() =>
        useBulkSelection({ transactions: mockTransactions })
      );

      await act(async () => {
        await result.current.handleBulkApply({ onSuccess });
      });

      expect(mockLinkMutate).toHaveBeenCalledWith({
        reconciliationId: 'recon-1',
        transactionIds: ['txn-1', 'txn-2'],
      });
      expect(mockBulkUpdateMutate).not.toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalledWith({
        successCount: 2,
        failureCount: 0,
      });
    });

    it('uses reconciliation unlink path when reconciliationId is undefined', async () => {
      mockStoreState.canApply.mockReturnValue(true);
      mockStoreState.selectedIds = new Set(['txn-1', 'txn-2']);
      mockStoreState.stagedUpdates = { reconciliationId: undefined };

      mockUnlinkMutate.mockResolvedValue({
        successCount: 2,
        errorCount: 0,
        errors: [],
      });

      const onSuccess = vi.fn();
      const { result } = renderHook(() =>
        useBulkSelection({ transactions: mockTransactions })
      );

      await act(async () => {
        await result.current.handleBulkApply({ onSuccess });
      });

      expect(mockUnlinkMutate).toHaveBeenCalledWith(['txn-1', 'txn-2']);
      expect(mockBulkUpdateMutate).not.toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalledWith({
        successCount: 2,
        failureCount: 0,
      });
    });

    it('uses standard path for category/account/date updates', async () => {
      mockStoreState.canApply.mockReturnValue(true);
      mockStoreState.selectedIds = new Set(['txn-1']);
      mockStoreState.stagedUpdates = {
        categoryId: 'cat-1',
        accountId: 'acc-1',
        date: '2024-02-01T00:00:00.000Z',
      };
      mockStoreState.getSelectedIds.mockReturnValue(['txn-1']);

      mockBulkUpdateMutate.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        successIds: ['txn-1'],
        failures: [],
      });

      const { result } = renderHook(() =>
        useBulkSelection({ transactions: mockTransactions })
      );

      await act(async () => {
        await result.current.handleBulkApply();
      });

      expect(mockBulkUpdateMutate).toHaveBeenCalledWith({
        transactionIds: ['txn-1'],
        updates: {
          categoryId: 'cat-1',
          accountId: 'acc-1',
          date: '2024-02-01T00:00:00.000Z',
        },
      });
      expect(mockLinkMutate).not.toHaveBeenCalled();
      expect(mockUnlinkMutate).not.toHaveBeenCalled();
    });

    it('handles partial success edge case (48/50 succeed)', async () => {
      // CTO Edge Case: Bulk update of 50 items where 2 fail due to version conflicts
      const largeSelection = new Set(
        Array.from({ length: 50 }, (_, i) => `txn-${i}`)
      );
      mockStoreState.canApply.mockReturnValue(true);
      mockStoreState.selectedIds = largeSelection;
      mockStoreState.stagedUpdates = { categoryId: 'new-category' };
      mockStoreState.getSelectedIds.mockReturnValue(Array.from(largeSelection));

      mockBulkUpdateMutate.mockResolvedValue({
        successCount: 48,
        failureCount: 2,
        successIds: Array.from({ length: 48 }, (_, i) => `txn-${i}`),
        failures: [
          { id: 'txn-48', error: 'Version conflict' },
          { id: 'txn-49', error: 'Version conflict' },
        ],
      });

      const onSuccess = vi.fn();
      const onLargeSelection = vi.fn();
      const { result } = renderHook(() =>
        useBulkSelection({ transactions: mockTransactions })
      );

      await act(async () => {
        await result.current.handleBulkApply({ onSuccess, onLargeSelection });
      });

      // Should notify about large selection
      expect(onLargeSelection).toHaveBeenCalledWith(50);

      // Should report partial success
      expect(onSuccess).toHaveBeenCalledWith({
        successCount: 48,
        failureCount: 2,
      });

      // UI callback should receive counts for user-friendly error message
      // e.g., "Updated 48 transactions, 2 failed" (handled by parent component)
    });
  });

  describe('isPendingSync', () => {
    it('returns false when no mutations pending', () => {
      const { result } = renderHook(() =>
        useBulkSelection({ transactions: mockTransactions })
      );

      expect(result.current.isPendingSync).toBe(false);
    });
  });

  describe('state proxying', () => {
    it('exposes selectedIds from store', () => {
      const ids = new Set(['txn-1', 'txn-2']);
      mockStoreState.selectedIds = ids;

      const { result } = renderHook(() =>
        useBulkSelection({ transactions: mockTransactions })
      );

      expect(result.current.selectedIds).toBe(ids);
    });

    it('exposes isBulkMode from store', () => {
      mockStoreState.isBulkMode = true;

      const { result } = renderHook(() =>
        useBulkSelection({ transactions: mockTransactions })
      );

      expect(result.current.isBulkMode).toBe(true);
    });

    it('exposes stagedUpdates from store', () => {
      mockStoreState.stagedUpdates = { categoryId: 'cat-1' };

      const { result } = renderHook(() =>
        useBulkSelection({ transactions: mockTransactions })
      );

      expect(result.current.stagedUpdates).toEqual({ categoryId: 'cat-1' });
    });

    it('computes canApply from store', () => {
      mockStoreState.canApply.mockReturnValue(true);

      const { result } = renderHook(() =>
        useBulkSelection({ transactions: mockTransactions })
      );

      expect(result.current.canApply).toBe(true);
    });

    it('computes hasSelection from store', () => {
      mockStoreState.hasSelection.mockReturnValue(true);

      const { result } = renderHook(() =>
        useBulkSelection({ transactions: mockTransactions })
      );

      expect(result.current.hasSelection).toBe(true);
    });
  });
});
