'use client';

/**
 * TransactionFilterBar Component (Pure Component)
 *
 * A pure component that renders the filter toolbar for transactions.
 * Receives values and callbacks only - no URL knowledge, no hooks, no side effects.
 *
 * CTO MANDATES:
 * 1. Pure Component - Mirrors SwiftUI View interface for iOS portability
 * 2. React.memo wrapped - Prevents re-renders during list scroll
 * 3. No internal state except local UI state (focus states)
 *
 * @module transaction-filter-bar
 */

import React, { useState } from 'react';
import { format } from 'date-fns';
import {
  Search,
  Calendar as CalendarIcon,
  X,
  Hash,
  ChevronDown,
  Clock,
  CalendarDays,
  ListChecks,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * Category item for filter display
 */
export interface FilterCategory {
  id: string;
  name: string;
  color: string;
}

/**
 * Props for TransactionFilterBar
 *
 * All props are values and callbacks - no hooks or URL state.
 * Designed to mirror SwiftUI View interface for iOS portability.
 */
export interface TransactionFilterBarProps {
  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;

  // Date filter
  selectedDate: Date | undefined;
  onDateChange: (date: Date | undefined) => void;

  // Category filter
  selectedCategories: string[];
  onCategoryChange: (categoryIds: string[]) => void;
  categories: FilterCategory[];
  categoryCounts: Record<string, number>;

  // Sort
  sortBy: 'date' | 'created_at';
  onSortChange: (sortBy: 'date' | 'created_at') => void;

  // Bulk mode
  isBulkMode: boolean;
  onToggleBulkMode: () => void;

  // Clear all action
  onClearFilters: () => void;

  // Metadata (display only)
  title?: string | null;
  totalCount?: number | null;
}

/**
 * Pure component for transaction filter toolbar
 *
 * Wrapped in React.memo to prevent unnecessary re-renders during list scroll.
 *
 * @example
 * ```tsx
 * <TransactionFilterBar
 *   title="Transactions"
 *   searchQuery={searchQuery}
 *   onSearchChange={setSearchQuery}
 *   selectedDate={selectedDate}
 *   onDateChange={setSelectedDate}
 *   selectedCategories={selectedCategories}
 *   onCategoryChange={setSelectedCategories}
 *   categories={categories}
 *   categoryCounts={categoryCounts}
 *   sortBy={sortBy}
 *   onSortChange={handleSortChange}
 *   isBulkMode={isBulkMode}
 *   onToggleBulkMode={handleToggleBulkMode}
 *   onClearFilters={handleClearFilters}
 * />
 * ```
 */
export const TransactionFilterBar = React.memo(function TransactionFilterBar({
  searchQuery,
  onSearchChange,
  selectedDate,
  onDateChange,
  selectedCategories,
  onCategoryChange,
  categories,
  categoryCounts,
  sortBy,
  onSortChange,
  isBulkMode,
  onToggleBulkMode,
  onClearFilters,
  title,
}: TransactionFilterBarProps) {
  // Local UI state for search focus animation
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Check if any filters are active
  const hasActiveFilters =
    selectedCategories.length > 0 || selectedDate !== undefined || searchQuery !== '';

  return (
    <div className="z-20 pt-4 md:pt-6 pb-2 px-4 md:px-6 bg-white border-b border-gray-100">
      {/* Title with Sort Toggle - stacked on mobile */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <h1 className="text-lg md:text-xl font-bold text-gray-900">
          {title || TRANSACTIONS.UI.LABELS.TRANSACTIONS}
        </h1>

        {/* Sort Toggle - Date/Added */}
        <Tabs
          value={sortBy}
          onValueChange={(value) => onSortChange(value as 'date' | 'created_at')}
        >
          <TabsList className="h-8 p-[2px] bg-gray-100/80">
            <TabsTrigger value="date" className="h-full px-2.5 text-xs gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Date
            </TabsTrigger>
            <TabsTrigger value="created_at" className="h-full px-2.5 text-xs gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Added
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Mobile: Search at top, full width */}
      <div className="md:hidden mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-10 text-sm bg-gray-100/50 border-transparent hover:bg-gray-100 focus:bg-white focus:ring-1 focus:ring-gray-300 placeholder:text-gray-500"
          />
        </div>
      </div>

      {/* Filter Toolbar - horizontal scroll on mobile, fixed height to prevent CLS */}
      <div className="min-h-[44px] flex items-center">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
        {/* Bulk Mode Toggle */}
        <Button
          variant={isBulkMode ? 'default' : 'ghost'}
          size="sm"
          onClick={onToggleBulkMode}
          className="h-8 px-2 flex-shrink-0"
        >
          <ListChecks className="h-4 w-4" />
        </Button>

        {/* Vertical Divider */}
        <div className="h-5 w-px bg-gray-200 flex-shrink-0" />

        {/* Desktop: Search Input (Collapsible) */}
        <div className="relative hidden md:block">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-[15px] w-[15px] text-gray-400" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            className={cn(
              'pl-7 py-1.5 h-8 text-sm bg-gray-100/50 border-transparent hover:bg-gray-100 focus:bg-white focus:ring-1 focus:ring-gray-300 transition-all duration-200 placeholder:text-gray-500',
              isSearchFocused ? 'w-48' : 'w-32'
            )}
          />
        </div>

        {/* Vertical Divider - desktop only */}
        <div className="h-5 w-px bg-gray-200 hidden md:block" />

        {/* Date Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                'px-2.5 py-1.5 h-8 rounded-md text-sm border border-transparent font-normal flex-shrink-0',
                selectedDate
                  ? 'bg-orange-50 text-orange-700 border-orange-200'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              <CalendarIcon className="mr-1.5 h-[15px] w-[15px]" />
              {selectedDate ? format(selectedDate, 'MMM dd') : 'Date'}
              <ChevronDown className="ml-1.5 h-[15px] w-[15px] opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0 bg-white shadow-xl border border-gray-100 rounded-lg animate-in fade-in zoom-in-95"
            align="start"
          >
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
                'px-2.5 py-1.5 h-8 rounded-md text-sm border border-transparent font-normal flex-shrink-0',
                selectedCategories.length > 0
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              <Hash className="mr-1.5 h-[15px] w-[15px]" />
              {selectedCategories.length > 0
                ? `${selectedCategories.length} selected`
                : 'Category'}
              <ChevronDown className="ml-1.5 h-[15px] w-[15px] opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-64 p-0 bg-white shadow-xl border border-gray-100 rounded-lg animate-in fade-in zoom-in-95"
            align="start"
          >
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
                      ? selectedCategories.filter((id) => id !== category.id)
                      : [...selectedCategories, category.id];
                    onCategoryChange(newSelection);
                  }}
                >
                  <Checkbox
                    checked={selectedCategories.includes(category.id)}
                    onCheckedChange={() => {}}
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
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-gray-500 hover:text-gray-700 h-8 py-1.5 px-2.5 flex-shrink-0"
          >
            <X className="mr-1 h-[15px] w-[15px]" />
            Clear
          </Button>
        )}
      </div>
      </div>
    </div>
  );
});
