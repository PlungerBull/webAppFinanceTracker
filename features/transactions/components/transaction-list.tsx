'use client';

import { useState } from 'react';
import { format, isToday } from 'date-fns';
import { Loader2, Search, Calendar as CalendarIcon, X, Hash, ChevronDown, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/hooks/use-formatted-balance';
import { TRANSACTIONS } from '@/lib/constants';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { TransactionRow } from '../types';

interface TransactionListProps {
  transactions: TransactionRow[];
  isLoading: boolean;
  selectedTransactionId: string | null;
  onTransactionSelect?: (id: string) => void;
  title?: string | null;
  variant?: 'default' | 'compact';
  // Filter props
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  selectedDate?: Date;
  onDateChange?: (date: Date | undefined) => void;
  selectedCategories?: string[];
  onCategoryChange?: (categoryIds: string[]) => void;
  categories?: { id: string; name: string; color: string }[];
  categoryCounts?: Record<string, number>;
}

export function TransactionList({
  transactions,
  isLoading,
  selectedTransactionId,
  onTransactionSelect,
  title,
  variant = 'default',
  searchQuery,
  onSearchChange,
  selectedDate,
  onDateChange,
  selectedCategories = [],
  onCategoryChange,
  categories = [],
  categoryCounts = {},
}: TransactionListProps) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // In compact mode, we don't use the sidebar context for padding
  const isCompact = variant === 'compact';

  // Format date for display
  const formatDateDisplay = (dateString: string) => {
    if (!dateString) return '';
    try {
      // FORCE "Wall Clock" Date Parsing
      // 1. Take only the YYYY-MM-DD part (first 10 chars)
      // 2. Append T00:00:00 to force local midnight
      // 3. This ignores any time/zone info from the DB
      const cleanDate = dateString.substring(0, 10); // Take "YYYY-MM-DD"
      const localDate = new Date(cleanDate + 'T00:00:00');

      if (isNaN(localDate.getTime())) return dateString; // Fallback for invalid dates

      if (isToday(localDate)) {
        return 'Today';
      }
      return format(localDate, 'MMM dd');
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50/50 overflow-hidden border-r border-gray-200">
      {/* Header - only show in default mode */}
      {!isCompact && (
        <>
          {/* Global Header (Fixed) */}
          <div className="z-20 pt-6 pb-2 px-6">
            {/* Title */}
            <div className="flex items-center mb-4">
              <h1 className="text-xl font-bold text-gray-900">
                {title || TRANSACTIONS.UI.LABELS.TRANSACTIONS}
              </h1>
            </div>

            {/* Filter Toolbar */}
            <div className="flex items-center gap-2">
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
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-md cursor-pointer"
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
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: category.color }}
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

      {/* Card List (Scrollable) */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
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
          <div className="space-y-2">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                onClick={() => onTransactionSelect?.(transaction.id)}
                className={cn(
                  // Card base styling
                  'relative bg-white rounded-xl border border-gray-100 px-4 py-3',
                  'transition-all duration-200 cursor-pointer',
                  'hover:shadow-sm hover:border-gray-200',
                  // Selected state
                  selectedTransactionId === transaction.id
                    ? 'ring-2 ring-blue-500/20 border-blue-200'
                    : '',
                  // Disable interactivity if no handler
                  !onTransactionSelect && 'cursor-default hover:shadow-none'
                )}
              >
                {/* Category color indicator (left border accent) */}
                {transaction.categoryColor && (
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                    style={{ backgroundColor: transaction.categoryColor }}
                  />
                )}

                <div className="flex items-start justify-between gap-4">
                  {/* LEFT COLUMN: Identity */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* Payee Name + Notes Indicator */}
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {transaction.description || 'Untitled Transaction'}
                      </p>
                      {/* Notes indicator */}
                      {transaction.notes && (
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                      )}
                    </div>

                    {/* Category Pill */}
                    <div className="flex items-center gap-2">
                      {/* Category color dot */}
                      {transaction.categoryColor && (
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: transaction.categoryColor }}
                        />
                      )}
                      <span className="text-[10px] font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-md">
                        {transaction.categoryName || 'Uncategorized'}
                      </span>
                    </div>

                    {/* Date */}
                    <p className="text-[10px] text-gray-400">
                      {formatDateDisplay(transaction.date)}
                    </p>
                  </div>

                  {/* RIGHT COLUMN: Value */}
                  <div className="text-right flex-shrink-0">
                    {/* Amount */}
                    <p
                      className={cn(
                        'text-lg font-bold font-mono tabular-nums',
                        transaction.amountOriginal >= 0
                          ? 'text-green-600'
                          : 'text-gray-900'
                      )}
                    >
                      {formatCurrency(transaction.amountOriginal, transaction.currencyOriginal).replace(/[A-Z]{3}\s?/, '')}
                    </p>

                    {/* Currency Label */}
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {transaction.currencyOriginal}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
