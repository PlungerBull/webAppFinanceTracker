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
    const date = new Date(dateString);
    if (isToday(date)) {
      return 'Today';
    }
    return format(date, 'MMM dd');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden border-r border-gray-200">
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

      {/* Flat Table List (Scrollable) */}
      <div className="flex-1 overflow-y-auto px-6">
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
          <div>
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                onClick={() => onTransactionSelect?.(transaction.id)}
                className={cn(
                  'relative py-2.5 cursor-pointer transition-colors border-b border-gray-50',
                  selectedTransactionId === transaction.id
                    ? 'bg-blue-50/60'
                    : 'hover:bg-gray-50',
                  !onTransactionSelect && 'cursor-default hover:bg-transparent'
                )}
              >
                {/* Category color indicator (spine) */}
                {transaction.category_color && (
                  <div
                    className="absolute left-0 top-1 bottom-1 w-1 rounded-r-full"
                    style={{ backgroundColor: transaction.category_color }}
                  />
                )}

                <div className="flex items-center gap-4 pl-4">
                  {/* Payee (Primary Column) - Flex grow */}
                  <div className="flex-1 min-w-0 flex items-center gap-1.5">
                    <p className={cn(
                      'text-sm truncate',
                      selectedTransactionId === transaction.id
                        ? 'font-semibold text-gray-900'
                        : 'font-medium text-gray-700'
                    )}>
                      {transaction.description}
                    </p>
                    {transaction.notes && (
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                    )}
                  </div>

                  {/* Category Chip (Middle Column) - Hidden on mobile */}
                  <div className="hidden md:flex items-center bg-gray-100 rounded-full px-2 py-0.5">
                    <span
                      className="text-[10px] font-medium"
                      style={{ color: transaction.category_color || '#6B7280' }}
                    >
                      {transaction.category_name || 'Uncategorized'}
                    </span>
                  </div>

                  {/* Date (Right Column) - Fixed width */}
                  <div className="w-24 text-right">
                    <p className="text-xs text-gray-400">
                      {formatDateDisplay(transaction.date)}
                    </p>
                  </div>

                  {/* Amount (Far Right Column) - Fixed width */}
                  <div className="w-24 text-right">
                    <p
                      className={cn(
                        'text-sm font-medium tabular-nums font-mono',
                        transaction.amount_original >= 0
                          ? 'text-green-600'
                          : 'text-gray-900'
                      )}
                    >
                      {formatCurrency(transaction.amount_original, transaction.currency_original)}
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
