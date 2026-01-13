'use client';

import { useRef, useEffect, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format, isToday } from 'date-fns';
import { Loader2, Search, Calendar as CalendarIcon, X, Hash, ChevronDown, Clock, CalendarDays, ListChecks, CheckCircle2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/hooks/use-formatted-balance';
import { TRANSACTIONS, PAGINATION } from '@/lib/constants';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { TransactionRow } from '../types';
import type { TransactionViewEntity } from '../domain';

// Nullable amount type for inbox items (draft state)
// Regular transactions have required amounts, but inbox items can have null amounts (for displaying "--")
// Repository Pattern: Uses integer cents (amountCents), converted to decimal for display
type TransactionListRow = Omit<TransactionViewEntity, 'amountCents' | 'amountHomeCents'> & {
  amountOriginal: number | null; // Display format: decimal (converted from amountCents)
  amountHome: number | null; // Display format: decimal (converted from amountHomeCents)
};

interface TransactionListProps {
  transactions: (TransactionRow | TransactionListRow)[];
  isLoading: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  fetchNextPage?: () => void;
  selectedTransactionId: string | null;
  onTransactionSelect?: (id: string) => void;
  title?: string | null;
  variant?: 'default' | 'compact';
  totalCount?: number | null;
  // Filter props
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  selectedDate?: Date;
  onDateChange?: (date: Date | undefined) => void;
  selectedCategories?: string[];
  onCategoryChange?: (categoryIds: string[]) => void;
  categories?: { id: string; name: string; color: string }[];
  categoryCounts?: Record<string, number>;
  // Sort props
  sortBy?: 'date' | 'created_at';
  onSortChange?: (sortBy: 'date' | 'created_at') => void;
  // Bulk selection props
  isBulkMode?: boolean;
  selectedIds?: Set<string>;
  onToggleBulkMode?: () => void;
  onToggleSelection?: (id: string, index: number, event: React.MouseEvent) => void;
}

export function TransactionList({
  transactions,
  isLoading,
  isFetchingNextPage = false,
  hasNextPage = false,
  fetchNextPage,
  selectedTransactionId,
  onTransactionSelect,
  title,
  variant = 'default',
  totalCount,
  searchQuery,
  onSearchChange,
  selectedDate,
  onDateChange,
  selectedCategories = [],
  onCategoryChange,
  sortBy = 'date',
  onSortChange,
  categories = [],
  categoryCounts = {},
  isBulkMode = false,
  selectedIds = new Set(),
  onToggleBulkMode,
  onToggleSelection,
}: TransactionListProps) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const isCompact = variant === 'compact';

  // Normalize transactions to ensure decimal amounts for display
  // Converts TransactionRow (with amountCents) → TransactionListRow (with amountOriginal as decimal)
  const normalizedTransactions: TransactionListRow[] = transactions.map((t) => {
    // Check if transaction has amountCents (new format) or amountOriginal (already normalized)
    const hasAmountCents = 'amountCents' in t;

    return {
      ...t,
      // Convert integer cents to decimal for display, or use existing decimal
      amountOriginal: hasAmountCents
        ? (t as TransactionViewEntity).amountCents / 100
        : (t as TransactionListRow).amountOriginal,
      amountHome: hasAmountCents
        ? (t as TransactionViewEntity).amountHomeCents / 100
        : (t as TransactionListRow).amountHome,
    } as TransactionListRow;
  });

  // Parent ref for virtualizer
  const parentRef = useRef<HTMLDivElement>(null);

  // Initialize virtualizer
  const virtualizer = useVirtualizer({
    count: normalizedTransactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => PAGINATION.VIRTUAL_ITEM_SIZE_ESTIMATE,
    overscan: PAGINATION.OVERSCAN,
  });

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
  }, [
    lastVirtualItem,
    normalizedTransactions.length,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  // Reset scroll position when filters change
  useEffect(() => {
    virtualizer.scrollToIndex(0, { align: 'start' });
  }, [searchQuery, selectedDate, selectedCategories]);

  // Format date for display
  const formatDateDisplay = (dateString: string) => {
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
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden border-r border-gray-200">
      {/* Header - only show in default mode */}
      {!isCompact && (
        <>
          {/* Global Header (Fixed) */}
          <div className="z-20 pt-6 pb-2 px-6">
            {/* Title with Sort Toggle */}
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold text-gray-900">
                {title || TRANSACTIONS.UI.LABELS.TRANSACTIONS}
              </h1>

              {/* Sort Toggle - Date/Added */}
              <Tabs value={sortBy} onValueChange={(value) => onSortChange?.(value as 'date' | 'created_at')}>
                <TabsList className="h-8 p-[2px] bg-gray-100/80">
                  <TabsTrigger
                    value="date"
                    className="h-full px-2.5 text-xs gap-1.5"
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    Date
                  </TabsTrigger>
                  <TabsTrigger
                    value="created_at"
                    className="h-full px-2.5 text-xs gap-1.5"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    Added
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Filter Toolbar */}
            <div className="flex items-center gap-2">
              {/* Bulk Mode Toggle */}
              {onToggleBulkMode && (
                <>
                  <Button
                    variant={isBulkMode ? 'default' : 'ghost'}
                    size="sm"
                    onClick={onToggleBulkMode}
                    className="h-8 px-2"
                  >
                    <ListChecks className="h-4 w-4" />
                  </Button>

                  {/* Vertical Divider */}
                  <div className="h-5 w-px bg-gray-200" />
                </>
              )}

              {/* Search Input (Collapsible) */}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-[15px] w-[15px] text-gray-400" />
                <Input
                  placeholder="Search..."
                  value={searchQuery || ''}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  className={cn(
                    "pl-7 py-1.5 h-8 text-sm bg-gray-100/50 border-transparent hover:bg-gray-100 focus:bg-white focus:ring-1 focus:ring-gray-300 transition-all duration-200 placeholder:text-gray-500",
                    isSearchFocused ? "w-48" : "w-32"
                  )}
                />
              </div>

              {/* Vertical Divider */}
              <div className="h-5 w-px bg-gray-200" />

              {/* Date Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      "px-2.5 py-1.5 h-8 rounded-md text-sm border border-transparent font-normal",
                      selectedDate
                        ? "bg-orange-50 text-orange-700 border-orange-200"
                        : "text-gray-600 hover:bg-gray-100"
                    )}
                  >
                    <CalendarIcon className="mr-1.5 h-[15px] w-[15px]" />
                    {selectedDate ? format(selectedDate, "MMM dd") : "Date"}
                    <ChevronDown className="ml-1.5 h-[15px] w-[15px] opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white shadow-xl border border-gray-100 rounded-lg animate-in fade-in zoom-in-95" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={onDateChange}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              {/* Category Filter - Multi-select */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      "px-2.5 py-1.5 h-8 rounded-md text-sm border border-transparent font-normal",
                      selectedCategories.length > 0
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "text-gray-600 hover:bg-gray-100"
                    )}
                  >
                    <Hash className="mr-1.5 h-[15px] w-[15px]" />
                    {selectedCategories.length > 0
                      ? `${selectedCategories.length} selected`
                      : "Category"}
                    <ChevronDown className="ml-1.5 h-[15px] w-[15px] opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0 bg-white shadow-xl border border-gray-100 rounded-lg animate-in fade-in zoom-in-95" align="start">
                  <div className="p-3 border-b border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Categories
                    </p>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto p-2">
                    {categories.map((category) => (
                      <div
                        key={category.id}
                        className="flex items-center gap-2 p-2 hover:bg-white hover:border hover:border-gray-200 rounded-md cursor-pointer"
                        onClick={() => {
                          const newSelection = selectedCategories.includes(category.id)
                            ? selectedCategories.filter(id => id !== category.id)
                            : [...selectedCategories, category.id];
                          onCategoryChange?.(newSelection);
                        }}
                      >
                        <Checkbox
                          checked={selectedCategories.includes(category.id)}
                          onCheckedChange={() => { }}
                        />
                        <span className="flex-1 text-sm">{category.name}</span>
                        <span className="text-sm text-gray-500">
                          {categoryCounts[category.id] || 0}
                        </span>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Clear All Filters Button */}
              {(selectedCategories.length > 0 || selectedDate || searchQuery) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onSearchChange?.('');
                    onDateChange?.(undefined);
                    onCategoryChange?.([]);
                  }}
                  className="text-gray-500 hover:text-gray-700 h-8 py-1.5 px-2.5"
                >
                  <X className="mr-1 h-[15px] w-[15px]" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Divider below header */}
          <div className="h-px bg-gray-100" />
        </>
      )}

      {/* Virtualized List Container */}
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto px-6 py-4"
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
                  <div
                    onClick={(e) => {
                      // Check for modifier keys - these should trigger bulk mode automatically
                      const hasModifierKey = e.shiftKey || e.metaKey || e.ctrlKey;

                      if (hasModifierKey) {
                        // Modifier keys: Handle selection (enter bulk mode if needed)
                        if (!isBulkMode) {
                          onToggleBulkMode?.();
                        }
                        onToggleSelection?.(transaction.id, virtualItem.index, e);
                      } else {
                        // Regular click: RESET behavior (like Finder/Windows Explorer)
                        // 1. Clear all existing selections
                        // 2. Focus the clicked item (right panel)
                        // 3. Start new selection set with only this item
                        onToggleSelection?.(transaction.id, virtualItem.index, e);
                      }
                    }}
                    className={cn(
                      'relative bg-white rounded-xl border border-gray-100 px-4 py-3',
                      'transition-all duration-200 cursor-pointer',
                      'hover:shadow-sm hover:border-gray-200',
                      // Focus state (right panel) - subtle blue ring
                      selectedTransactionId === transaction.id && !isSelected && 'ring-2 ring-blue-500/20 border-blue-200',
                      // Selection state (bulk mode) - stronger blue with tint
                      isBulkMode && isSelected && selectedTransactionId !== transaction.id && 'ring-2 ring-blue-500 border-blue-400 bg-blue-50/20',
                      // Master state (both focus and selected) - strongest blue
                      selectedTransactionId === transaction.id && isSelected && 'ring-2 ring-blue-600 border-blue-600 bg-blue-50',
                      !onTransactionSelect && !isBulkMode && 'cursor-default hover:shadow-none'
                    )}
                  >
                    {/* Checkbox - only visible in bulk mode */}
                    {isBulkMode && (
                      <div className="absolute top-3 left-3 z-10">
                        <Checkbox
                          checked={isSelected}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Pass through the click event with modifier keys preserved
                            onToggleSelection?.(transaction.id, virtualItem.index, e as any);
                          }}
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
                            className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md"
                            style={{
                              backgroundColor: transaction.categoryColor
                                ? `${transaction.categoryColor}20`
                                : '#f9fafb',
                              color: transaction.categoryColor || '#6b7280',
                              borderWidth: '1px',
                              borderStyle: 'solid',
                              borderColor: transaction.categoryColor
                                ? `${transaction.categoryColor}40`
                                : '#e5e7eb'
                            }}
                          >
                            {transaction.categoryName || 'Uncategorized'}
                          </span>
                          {/* Date */}
                          <p className="text-[10px] text-gray-400">
                            {formatDateDisplay(transaction.date)}
                          </p>
                        </div>
                      </div>

                      {/* MIDDLE COLUMN: Reconciliation Status Icons */}
                      <div className="flex items-center flex-shrink-0">
                        {/* Emerald Lock - Completed/Finalized Reconciliation */}
                        {'reconciliationStatus' in transaction && transaction.reconciliationStatus === 'completed' && (
                          <div className="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-50">
                            <Lock className="w-3 h-3 text-emerald-600" />
                          </div>
                        )}

                        {/* Blue Checkmark - Linked to Draft Reconciliation */}
                        {'reconciliationStatus' in transaction && transaction.reconciliationStatus === 'draft' && transaction.cleared && (
                          <CheckCircle2 className="w-5 h-5 text-blue-500 opacity-60 hover:opacity-100 transition-opacity" />
                        )}
                      </div>

                      {/* RIGHT COLUMN: Value */}
                      <div className="text-right flex-shrink-0">
                        {/* Amount */}
                        <p
                          className={cn(
                            'text-lg font-bold font-mono tabular-nums',
                            transaction.amountOriginal === null
                              ? 'text-gray-400'
                              : transaction.amountOriginal >= 0
                              ? 'text-green-600'
                              : 'text-gray-900'
                          )}
                        >
                          {transaction.amountOriginal === null
                            ? '--'
                            : formatCurrency(transaction.amountOriginal, transaction.currencyOriginal).replace(/[A-Z]{3}\s?/, '')
                          }
                        </p>

                        {/* Currency Label */}
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {transaction.accountId ? transaction.currencyOriginal : 'SELECT ACCOUNT'}
                        </p>
                      </div>
                    </div>
                  </div>
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
