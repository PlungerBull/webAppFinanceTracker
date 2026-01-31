'use client';

/**
 * TransactionRow Component (Memoized)
 *
 * A memoized transaction row component optimized for virtualized lists.
 * Uses custom comparison function to prevent unnecessary re-renders.
 *
 * CTO MANDATES:
 * 1. React.memo with custom comparison - Only re-renders on relevant prop changes
 * 2. Performance: With 1000+ transactions, toggling bulk mode only re-renders visible rows
 *
 * @module transaction-row
 */

import React from 'react';
import { format, isToday } from 'date-fns';
import { Lock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/hooks/use-formatted-balance';
import { Checkbox } from '@/components/ui/checkbox';

/**
 * Transaction data shape for display
 * Uses decimal displayAmount (converted from amountCents)
 */
export interface TransactionRowData {
  id: string;
  description: string | null;
  date: string;
  displayAmount: number | null;
  currencyOriginal: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  accountId: string;
  reconciliationStatus?: 'draft' | 'completed' | null;
  cleared?: boolean;
}

/**
 * Props for TransactionRow component
 */
export interface TransactionRowProps {
  /** Transaction data to display */
  transaction: TransactionRowData;
  /** Row index in the list */
  index: number;
  /** Whether this row is selected in bulk mode */
  isSelected: boolean;
  /** Whether this row is focused (detail panel) */
  isFocused: boolean;
  /** Whether bulk selection mode is active */
  isBulkMode: boolean;
  /** Selection handler */
  onSelect: (id: string, index: number, event: React.MouseEvent) => void;
  /** Optional: Handler for entering bulk mode on modifier key */
  onEnterBulkMode?: () => void;
}

/**
 * Format date for display
 */
function formatDateDisplay(dateString: string): string {
  if (!dateString) return '';
  try {
    // FORCE "Wall Clock" Date Parsing
    const cleanDate = dateString.substring(0, 10);
    const localDate = new Date(cleanDate + 'T00:00:00');

    if (isNaN(localDate.getTime())) return dateString;

    if (isToday(localDate)) {
      return 'Today';
    }
    return format(localDate, 'MMM dd');
  } catch {
    return dateString;
  }
}

/**
 * Memoized transaction row component
 *
 * Custom comparison function checks only:
 * - transaction.id (identity)
 * - isSelected (selection state)
 * - isFocused (focus state)
 * - isBulkMode (mode change)
 *
 * This prevents full list re-renders when only selection state changes.
 */
export const TransactionRow = React.memo(
  function TransactionRow({
    transaction,
    index,
    isSelected,
    isFocused,
    isBulkMode,
    onSelect,
    onEnterBulkMode,
  }: TransactionRowProps) {
    const handleClick = (e: React.MouseEvent) => {
      // Check for modifier keys - these should trigger bulk mode automatically
      const hasModifierKey = e.shiftKey || e.metaKey || e.ctrlKey;

      if (hasModifierKey && !isBulkMode) {
        // Enter bulk mode first if not already in it
        onEnterBulkMode?.();
      }

      // Always pass the event to the selection handler
      onSelect(transaction.id, index, e);
    };

    const handleCheckboxClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      // Pass through the click event with modifier keys preserved
      onSelect(transaction.id, index, e);
    };

    return (
      <div
        onClick={handleClick}
        className={cn(
          'relative bg-white rounded-xl border border-gray-100 px-4 py-4 md:py-3',
          'transition-all duration-200 cursor-pointer',
          'hover:shadow-sm hover:border-gray-200',
          // Focus state (right panel) - subtle blue ring
          isFocused && !isSelected && 'ring-2 ring-blue-500/20 border-blue-200',
          // Selection state (bulk mode) - stronger blue with tint
          isBulkMode && isSelected && !isFocused && 'ring-2 ring-blue-500 border-blue-400 bg-blue-50/20',
          // Master state (both focus and selected) - strongest blue
          isFocused && isSelected && 'ring-2 ring-blue-600 border-blue-600 bg-blue-50',
          !isBulkMode && 'cursor-default hover:shadow-none'
        )}
      >
        {/* Checkbox - only visible in bulk mode, wrapped for 44px touch target */}
        {isBulkMode && (
          <div className="absolute top-2 left-2 z-10 p-2 -m-1" onClick={handleCheckboxClick}>
            <Checkbox
              checked={isSelected}
              onClick={handleCheckboxClick}
            />
          </div>
        )}

        <div className={cn('flex items-start justify-between gap-4', isBulkMode && 'ml-8')}>
          {/* LEFT COLUMN: Identity */}
          <div className="flex-1 min-w-0 space-y-1.5">
            {/* Payee Name */}
            <p className="text-sm font-semibold text-gray-900 truncate">
              {transaction.description || 'Untitled Transaction'}
            </p>

            {/* Category Pill + Date */}
            <div className="flex items-center gap-2">
              <span
                className="text-xs md:text-[10px] font-semibold uppercase tracking-wide px-2 py-1 md:py-0.5 rounded-md"
                style={{
                  backgroundColor: transaction.categoryColor
                    ? `${transaction.categoryColor}20`
                    : '#f9fafb',
                  color: transaction.categoryColor || '#6b7280',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: transaction.categoryColor
                    ? `${transaction.categoryColor}40`
                    : '#e5e7eb',
                }}
              >
                {transaction.categoryName || 'Uncategorized'}
              </span>
              {/* Date */}
              <p className="text-xs md:text-[10px] text-gray-400">
                {formatDateDisplay(transaction.date)}
              </p>
            </div>
          </div>

          {/* MIDDLE COLUMN: Reconciliation Status Icons */}
          <div className="flex items-center flex-shrink-0">
            {/* Emerald Lock - Completed/Finalized Reconciliation */}
            {transaction.reconciliationStatus === 'completed' && (
              <div className="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-50">
                <Lock className="w-3 h-3 text-emerald-600" />
              </div>
            )}

            {/* Blue Checkmark - Linked to Draft Reconciliation */}
            {transaction.reconciliationStatus === 'draft' && transaction.cleared && (
              <CheckCircle2 className="w-5 h-5 text-blue-500 opacity-60 hover:opacity-100 transition-opacity" />
            )}
          </div>

          {/* RIGHT COLUMN: Value */}
          <div className="text-right flex-shrink-0">
            {/* Amount */}
            <p
              className={cn(
                'text-lg font-bold font-mono tabular-nums',
                transaction.displayAmount === null
                  ? 'text-gray-400'
                  : transaction.displayAmount >= 0
                  ? 'text-green-600'
                  : 'text-gray-900'
              )}
            >
              {transaction.displayAmount === null
                ? '--'
                : formatCurrency(transaction.displayAmount, transaction.currencyOriginal).replace(
                    /[A-Z]{3}\s?/,
                    ''
                  )}
            </p>

            {/* Currency Label */}
            <p className="text-xs md:text-[10px] text-gray-400 mt-0.5">
              {transaction.accountId ? (transaction.currencyOriginal ?? '—') : 'SELECT ACCOUNT'}
            </p>
          </div>
        </div>
      </div>
    );
  },
  // Custom comparison function: only re-render if these specific props change
  (prevProps, nextProps) =>
    prevProps.transaction.id === nextProps.transaction.id &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isFocused === nextProps.isFocused &&
    prevProps.isBulkMode === nextProps.isBulkMode
);
