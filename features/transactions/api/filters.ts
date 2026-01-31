/**
 * Transaction Filter Utilities
 *
 * Centralizes filter-building logic used by getAllPaginated() and getCategoryCounts()
 * to prevent duplication and ensure consistency across transaction queries.
 */

/**
 * Transaction filter parameters
 *
 * Used to filter transaction queries across multiple API functions.
 * All filters are optional and can be combined.
 */
export interface TransactionFilters {
  /** Single category selection */
  categoryId?: string;
  /** Single account filter */
  accountId?: string;
  /** Multiple categories (for grouping/aggregation) */
  categoryIds?: string[];
  /** Description search (case-insensitive partial match) */
  searchQuery?: string;
  /** Exact date match */
  date?: Date | string;
  /** Sort order (not applied by filter helper) */
  sortBy?: 'date' | 'created_at';
}

/**
 * Minimal interface for Supabase query builder filter methods.
 * Used to type-constrain applyTransactionFilters without coupling to full Supabase types.
 */
interface FilterableQuery {
  eq(column: string, value: string): this;
  in(column: string, values: string[]): this;
  ilike(column: string, pattern: string): this;
}

/**
 * Applies standard transaction filters to a Supabase query
 *
 * Centralizes filter logic to prevent duplication between getAllPaginated()
 * and getCategoryCounts(). This ensures filters are applied consistently
 * and makes it easier to add new filters in the future.
 *
 * @param query - Supabase query builder from .from('transactions_view').select()
 * @param filters - Optional filter parameters
 * @returns Modified query with filters applied
 *
 * @example
 * ```typescript
 * let query = supabase.from('transactions_view').select('*');
 * query = applyTransactionFilters(query, {
 *   accountId: '123',
 *   date: new Date(),
 *   searchQuery: 'coffee'
 * });
 * const { data } = await query;
 * ```
 */
export function applyTransactionFilters<T extends FilterableQuery>(
  query: T,
  filters?: TransactionFilters
): T {
  let result = query;

  // Filter: Single category
  if (filters?.categoryId) {
    result = result.eq('category_id', filters.categoryId);
  }

  // Filter: Single account
  if (filters?.accountId) {
    result = result.eq('account_id', filters.accountId);
  }

  // Filter: Multiple categories (for grouping)
  if (filters?.categoryIds && filters.categoryIds.length > 0) {
    result = result.in('category_id', filters.categoryIds);
  }

  // Filter: Description search (case-insensitive)
  if (filters?.searchQuery) {
    result = result.ilike('description', `%${filters.searchQuery}%`);
  }

  // Filter: Exact date match (with normalization)
  if (filters?.date) {
    const dateStr = filters.date instanceof Date
      ? filters.date.toISOString().split('T')[0]
      : filters.date.split('T')[0];
    result = result.eq('date', dateStr);
  }

  return result as T;
}
