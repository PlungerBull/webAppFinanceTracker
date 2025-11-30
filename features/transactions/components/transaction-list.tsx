'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { Loader2, Search, Calendar as CalendarIcon, X, Hash, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/hooks/use-formatted-balance';
import { useSidebar } from '@/contexts/sidebar-context';
import { PageHeader } from '@/components/layout/page-header';
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

interface TransactionRow {
  id: string;
  date: string;
  description: string;
  category_name: string | null;
  category_color: string | null;
  category_id: string | null;
  amount_original: number;
  currency_original: string;
  account_name: string;
  account_id: string;
  exchange_rate: number | null;
  notes: string | null;
}

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
  const { isCollapsed } = useSidebar();

  // In compact mode, we don't use the sidebar context for padding
  const isCompact = variant === 'compact';

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: typeof transactions } = {};
    transactions.forEach((transaction) => {
      const dateKey = format(new Date(transaction.date), 'yyyy-MM-dd');
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(transaction);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [transactions]);

  return (
    <div className={cn(
      "flex-1 flex flex-col overflow-hidden",
      !isCompact && "border-r border-gray-200 dark:border-gray-800"
    )}>
      {/* Header - only show in default mode */}
      {!isCompact && (
        <>
          <PageHeader
            title={title || TRANSACTIONS.UI.LABELS.TRANSACTIONS}
            sidebarCollapsed={isCollapsed}
          />

          {/* Filters Toolbar */}
          <div className={cn(
            'flex items-center gap-3 pb-4 transition-all duration-300 bg-white dark:bg-zinc-950',
            isCollapsed ? 'px-32' : 'px-12'
          )}>
            {/* Search Filter */}
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search..."
                value={searchQuery || ''}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="pl-8 bg-white dark:bg-zinc-900"
              />
            </div>

            {/* Vertical Separator */}
            <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />

            {/* Date Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal bg-white dark:bg-zinc-900 hover:bg-white dark:hover:bg-zinc-900",
                    !selectedDate && "text-muted-foreground",
                    selectedDate && "border-blue-500 dark:border-blue-400"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Date"}
                  <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
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
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal bg-white dark:bg-zinc-900 hover:bg-white dark:hover:bg-zinc-900",
                    selectedCategories.length === 0 && "text-muted-foreground",
                    selectedCategories.length > 0 && "border-blue-500 dark:border-blue-400"
                  )}
                >
                  <Hash className="mr-2 h-4 w-4" />
                  {selectedCategories.length > 0
                    ? `${selectedCategories.length} selected`
                    : "Category"}
                  <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="start">
                <div className="max-h-[300px] overflow-y-auto p-2">
                  {categories.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md cursor-pointer"
                      onClick={() => {
                        const newSelection = selectedCategories.includes(category.id)
                          ? selectedCategories.filter(id => id !== category.id)
                          : [...selectedCategories, category.id];
                        onCategoryChange?.(newSelection);
                      }}
                    >
                      <Checkbox
                        checked={selectedCategories.includes(category.id)}
                        onCheckedChange={() => {}}
                      />
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="flex-1 text-sm">{category.name}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
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
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="mr-1 h-4 w-4" />
                Clear Filters
              </Button>
            )}
          </div>

          {/* Subtle divider below filters */}
          <div className="border-b border-gray-200 dark:border-gray-800" />
        </>
      )}

      {/* Transactions List */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-zinc-950">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500 dark:text-gray-400">
              {TRANSACTIONS.UI.MESSAGES.NO_TRANSACTIONS}
            </div>
          </div>
        ) : (
          <div>
            {groupedTransactions.map(([dateKey, dateTransactions]) => (
              <div key={dateKey}>
                {/* Date Header */}
                <div className={cn(
                  'transition-all duration-300',
                  'transition-all duration-300',
                  isCompact ? 'px-4' : (isCollapsed ? 'px-32' : 'px-12')
                )}>
                  <h3 className="text-xs font-normal text-gray-500 dark:text-gray-400 py-3">
                    {format(new Date(dateKey), 'EEEE dd, MMM yyyy')}
                  </h3>
                </div>

                {/* Transactions for this date */}
                <div className={cn(
                  'transition-all duration-300',
                  'transition-all duration-300',
                  isCompact ? 'ml-4' : (isCollapsed ? 'ml-32' : 'ml-12')
                )}>
                  {dateTransactions.map((transaction, index) => (
                    <div key={transaction.id} className="relative">
                      {/* Category color line */}
                      {transaction.category_color && (
                        <div
                          className="absolute left-0 top-0 bottom-0 w-1 rounded-r"
                          style={{ backgroundColor: transaction.category_color }}
                        />
                      )}
                      <div
                        onClick={() => onTransactionSelect?.(transaction.id)}
                        className={cn(
                          'py-4 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-900 transition-all duration-300',
                          isCompact ? 'pl-4 pr-4' : (isCollapsed ? 'pl-8 pr-32' : 'pl-8 pr-12'),
                          selectedTransactionId === transaction.id && 'bg-gray-100 dark:border-gray-900',
                          !onTransactionSelect && 'cursor-default hover:bg-transparent'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          {/* Left: Description */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 truncate">
                              {transaction.description}
                            </p>
                          </div>

                          {/* Right: Amount */}
                          <div className="text-right ml-4">
                            <p
                              className={cn(
                                'text-sm font-medium tabular-nums font-mono',
                                transaction.amount_original >= 0
                                  ? 'text-green-600 dark:text-green-500'
                                  : 'text-red-600 dark:text-red-500'
                              )}
                            >
                              {formatCurrency(transaction.amount_original, transaction.currency_original)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="border-t border-gray-100 dark:border-gray-800" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
