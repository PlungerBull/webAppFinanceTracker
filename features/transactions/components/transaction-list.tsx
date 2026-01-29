'use client';

/**
 * TransactionList Component (Dumb Virtualizer)
 *
 * A virtualized list component that renders transactions using TanStack Virtual.
 * This is a "dumb component" - it only accepts data and callbacks, no filter logic.
 *
 * CTO MANDATES:
 * 1. Dumb Component - No filter UI, no URL knowledge, no hooks for filtering
 * 2. Uses memoized TransactionRow for performance (1000+ rows without lag)
 * 3. Composition Pattern - Parent passes data, this component renders
 *
 * @module transaction-list
 */

import { useRef, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Loader2 } from 'lucide-react';
import { TRANSACTIONS, PAGINATION } from '@/lib/constants';
import { useIsMobile } from '@/lib/hooks/use-is-mobile';
import { TransactionRow, type TransactionRowData } from './transaction-row';
import type { TransactionViewEntity } from '../domain';

/**
 * Normalized transaction type for display
 * Converts integer cents to decimal for display
 */
type TransactionListRow = Omit<TransactionViewEntity, 'amountCents' | 'amountHomeCents'> & {
  displayAmount: number | null;
  amountHome: number | null;
};

/**
 * Props for TransactionList (Dumb Virtualizer)
 *
 * Minimal focused props - no filter UI props.
 * Filter bar is rendered as sibling by parent component.
 */
export interface TransactionListProps {
  /** Transaction data to display */
  transactions: TransactionViewEntity[];
  /** Loading state */
  isLoading: boolean;
  /** Fetching next page state (infinite scroll) */
  isFetchingNextPage?: boolean;
  /** Whether more pages exist */
  hasNextPage?: boolean;
  /** Fetch next page callback */
  fetchNextPage?: () => void;
  /** Currently focused transaction ID (detail panel) */
  selectedTransactionId: string | null;
  /** Callback when transaction focus changes */
  onTransactionSelect?: (id: string) => void;

  // Bulk selection props
  /** Whether bulk mode is active */
  isBulkMode?: boolean;
  /** Set of selected transaction IDs */
  selectedIds?: Set<string>;
  /** Toggle bulk mode handler */
  onToggleBulkMode?: () => void;
  /** Toggle selection handler */
  onToggleSelection?: (id: string, index: number, event: React.MouseEvent) => void;
  /** Enter bulk mode handler (for modifier key auto-enter) */
  onEnterBulkMode?: () => void;

  // Scroll control
  /** Index to scroll to (controlled by parent) */
  scrollToIndex?: number;

  // Optional display props (for standalone use without FilterBar)
  /** Page title (shows simple header if provided) */
  title?: string | null;
  /** Total count of items (display only) */
  totalCount?: number | null;
  /** Display variant: 'default' shows title header, 'compact' hides it */
  variant?: 'default' | 'compact';
}

/**
 * Dumb virtualizer component for transaction list
 *
 * Renders a virtualized list of transactions using TanStack Virtual.
 * Filter UI is NOT included - parent renders TransactionFilterBar as sibling.
 *
 * @example
 * ```tsx
 * // Parent component
 * <div className="flex flex-col">
 *   <TransactionFilterBar {...filterProps} />
 *   <TransactionList
 *     transactions={transactions}
 *     isLoading={isLoading}
 *     selectedTransactionId={selectedId}
 *     onTransactionSelect={setSelectedId}
 *     isBulkMode={bulk.isBulkMode}
 *     selectedIds={bulk.selectedIds}
 *     onToggleSelection={bulk.handleToggleSelection}
 *   />
 * </div>
 * ```
 */
export function TransactionList({
  transactions,
  isLoading,
  isFetchingNextPage = false,
  hasNextPage = false,
  fetchNextPage,
  selectedTransactionId,
  onTransactionSelect,
  isBulkMode = false,
  selectedIds = new Set(),
  onToggleBulkMode,
  onToggleSelection,
  onEnterBulkMode,
  scrollToIndex,
  title,
  totalCount,
  variant = 'default',
}: TransactionListProps) {
  // Normalize transactions to ensure decimal amounts for display
  const normalizedTransactions: TransactionListRow[] = transactions.map((t) => {
    const hasAmountCents = 'amountCents' in t;

    return {
      ...t,
      displayAmount: hasAmountCents
        ? (t as TransactionViewEntity).amountCents / 100
        : (t as TransactionListRow).displayAmount,
      amountHome: hasAmountCents
        ? (t as TransactionViewEntity).amountHomeCents / 100
        : (t as TransactionListRow).amountHome,
    } as TransactionListRow;
  });

  // Parent ref for virtualizer
  const parentRef = useRef<HTMLDivElement>(null);

  // Detect mobile viewport for virtualizer recalculation
  const isMobile = useIsMobile();

  // Initialize virtualizer
  const virtualizer = useVirtualizer({
    count: normalizedTransactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => PAGINATION.VIRTUAL_ITEM_SIZE_ESTIMATE,
    overscan: PAGINATION.OVERSCAN,
  });

  // Trigger virtualizer recalculation when viewport changes (mobile header appears/disappears)
  useEffect(() => {
    virtualizer.measure();
  }, [isMobile, virtualizer]);

  // Infinite scroll trigger
  const virtualItems = virtualizer.getVirtualItems();
  const lastVirtualItem = virtualItems[virtualItems.length - 1];

  useEffect(() => {
    if (!lastVirtualItem || !fetchNextPage) return;

    // Trigger fetch when user scrolls near the end
    if (
      lastVirtualItem.index >= normalizedTransactions.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [lastVirtualItem, normalizedTransactions.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Controlled scroll to index (for filter resets)
  useEffect(() => {
    if (scrollToIndex !== undefined) {
      virtualizer.scrollToIndex(scrollToIndex, { align: 'start' });
    }
  }, [scrollToIndex, virtualizer]);

  /**
   * Handle row selection
   * Supports two modes:
   * 1. Bulk selection mode: Delegate to onToggleSelection with modifier key handling
   * 2. Simple mode (InboxTable): Delegate to onTransactionSelect for detail panel
   */
  const handleRowSelect = useCallback(
    (id: string, index: number, event: React.MouseEvent) => {
      // Check for modifier keys - these should trigger bulk mode automatically
      const hasModifierKey = event.shiftKey || event.metaKey || event.ctrlKey;

      if (hasModifierKey && !isBulkMode) {
        // Enter bulk mode first if not already in it
        onEnterBulkMode?.();
      }

      // CTO MANDATE: Unified selection logic - no "Mode 2" fallback
      // All list consumers (Transactions, Inbox) must pass onToggleSelection
      // The hook handles focus via onFocusTransaction callback
      if (onToggleSelection) {
        onToggleSelection(id, index, event);
      }
    },
    [isBulkMode, onEnterBulkMode, onToggleSelection]
  );

  /**
   * Convert normalized transaction to TransactionRowData for memoized component
   */
  const toRowData = useCallback((t: TransactionListRow): TransactionRowData => ({
    id: t.id,
    description: t.description,
    date: t.date,
    displayAmount: t.displayAmount,
    currencyOriginal: t.currencyOriginal,
    categoryName: t.categoryName,
    categoryColor: t.categoryColor,
    accountId: t.accountId,
    reconciliationStatus: t.reconciliationStatus,
    cleared: t.cleared,
  }), []);

  const isCompact = variant === 'compact';

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden border-r border-gray-200">
      {/* Simple Header - shown when title provided and not compact (for standalone use) */}
      {title && !isCompact && (
        <div className="z-20 pt-4 md:pt-6 pb-4 px-4 md:px-6 border-b border-gray-100">
          <h1 className="text-lg md:text-xl font-bold text-gray-900">{title}</h1>
          {totalCount != null && (
            <p className="text-sm text-gray-500 mt-1">{totalCount} items</p>
          )}
        </div>
      )}

      {/* Virtualized List Container */}
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto px-4 md:px-6 py-4"
        style={{ contain: 'strict' }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              {TRANSACTIONS.UI.MESSAGES.NO_TRANSACTIONS}
            </div>
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const transaction = normalizedTransactions[virtualItem.index];
              const isSelected = isBulkMode && selectedIds.has(transaction.id);
              const isFocused = selectedTransactionId === transaction.id;

              return (
                <div
                  key={transaction.id}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                  className="pb-2" // Gap between cards
                >
                  <TransactionRow
                    transaction={toRowData(transaction)}
                    index={virtualItem.index}
                    isSelected={isSelected}
                    isFocused={isFocused}
                    isBulkMode={isBulkMode}
                    onSelect={handleRowSelect}
                    onEnterBulkMode={onEnterBulkMode}
                  />
                </div>
              );
            })}

            {/* Loading more indicator */}
            {isFetchingNextPage && (
              <div
                style={{
                  position: 'absolute',
                  top: `${virtualizer.getTotalSize()}px`,
                  left: 0,
                  width: '100%',
                }}
                className="py-4 flex justify-center"
              >
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
