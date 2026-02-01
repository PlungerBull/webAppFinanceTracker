/**
 * useTransactionFilters Hook
 *
 * Encapsulates filter state management for transactions:
 * - Search query
 * - Date filter
 * - Category selection
 * - Grouping-based category filtering
 *
 * CTO MANDATES:
 * 1. State Controller Pattern - Manages filter state transitions
 * 2. Computed activeCategoryIds - Merges grouping + manual selection
 * 3. Clear interface for composition
 *
 * @module use-transaction-filters
 */

import { useState, useMemo, useCallback } from 'react';
import { useGroupingChildren } from '@/lib/hooks/use-grouping-children';

/**
 * Options for useTransactionFilters hook
 */
export interface UseTransactionFiltersOptions {
  /**
   * Grouping ID from URL params (optional)
   * When provided, initializes category filter with grouping's children
   */
  groupingId?: string | null;
}

/**
 * Return type for useTransactionFilters hook
 */
export interface UseTransactionFiltersReturn {
  // Filter state
  searchQuery: string;
  selectedDate: Date | undefined;
  selectedCategories: string[];

  /**
   * Computed active category IDs
   * - If user has manually selected categories, returns those
   * - Otherwise, returns grouping filter (if any)
   * - Returns undefined if no filter is active
   */
  activeCategoryIds: string[] | undefined;

  /**
   * Stable string key representing current filter state
   * Use this as dependency for effects instead of JSON.stringify
   * CTO Mandate: No JSON.stringify in dependency arrays
   */
  filterKey: string;

  // Filter setters
  setSearchQuery: (query: string) => void;
  setSelectedDate: (date: Date | undefined) => void;
  setSelectedCategories: (categoryIds: string[]) => void;

  // Bulk actions
  clearAllFilters: () => void;

  // Computed flags
  hasActiveFilters: boolean;

  // Grouping data (for display purposes)
  groupingChildren: Array<{ id: string; name: string }>;
}

/**
 * Hook for managing transaction filter state
 *
 * Consolidates filter state management and provides computed
 * activeCategoryIds that merges grouping-based and manual selection.
 *
 * @example
 * ```tsx
 * const filters = useTransactionFilters({ groupingId });
 *
 * // Use in queries
 * const { data } = useTransactions({
 *   categoryIds: filters.activeCategoryIds,
 *   searchQuery: filters.searchQuery,
 *   date: filters.selectedDate,
 * });
 *
 * // Pass to filter bar
 * <TransactionFilterBar
 *   searchQuery={filters.searchQuery}
 *   onSearchChange={filters.setSearchQuery}
 *   // ...
 * />
 * ```
 */
export function useTransactionFilters({
  groupingId,
}: UseTransactionFiltersOptions = {}): UseTransactionFiltersReturn {
  // Fetch grouping children when groupingId is provided
  const { data: groupingChildren = [] } = useGroupingChildren(groupingId || '');

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  /**
   * Build category filter for grouping
   * Returns array of category IDs from grouping children, or undefined
   */
  const categoryFilter = useMemo(() => {
    if (groupingId && groupingChildren.length > 0) {
      return groupingChildren.map((c) => c.id);
    }
    return undefined;
  }, [groupingId, groupingChildren]);

  /**
   * Build active category filter by merging grouping and user selection
   *
   * Logic:
   * - If user has manually selected categories, use ONLY those (they are specific)
   * - Otherwise, fallback to the grouping filter (if any)
   */
  const activeCategoryIds = useMemo(() => {
    if (selectedCategories.length > 0) {
      return selectedCategories;
    }
    return categoryFilter;
  }, [selectedCategories, categoryFilter]);

  /**
   * Check if any filters are active
   */
  const hasActiveFilters = useMemo(
    () =>
      searchQuery !== '' ||
      selectedDate !== undefined ||
      selectedCategories.length > 0,
    [searchQuery, selectedDate, selectedCategories]
  );

  /**
   * Stable string key representing current filter state
   * CTO Mandate: Use this instead of JSON.stringify in dependency arrays
   */
  const filterKey = useMemo(() => {
    const dateKey = selectedDate?.toISOString() ?? 'none';
    const categoriesKey = selectedCategories.slice().sort().join(',') || 'none';
    return `${searchQuery}|${dateKey}|${categoriesKey}`;
  }, [searchQuery, selectedDate, selectedCategories]);

  /**
   * Clear all filter state
   */
  const clearAllFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedDate(undefined);
    setSelectedCategories([]);
  }, []);

  return {
    // State
    searchQuery,
    selectedDate,
    selectedCategories,
    activeCategoryIds,
    filterKey,

    // Setters
    setSearchQuery,
    setSelectedDate,
    setSelectedCategories,

    // Actions
    clearAllFilters,

    // Computed
    hasActiveFilters,

    // Grouping data
    groupingChildren,
  };
}
