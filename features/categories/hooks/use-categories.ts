/**
 * Category Query Hooks
 *
 * React Query hooks for fetching category data.
 * Uses the new service layer with Repository Pattern.
 *
 * CTO MANDATES:
 * - Orchestrator Rule: Service may be null, queries use enabled flag
 *
 * @module use-categories
 */

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, QUERY_CONFIG } from '@/lib/constants';
import { useCategoryService } from './use-category-service';
import type { CategoryFilters } from '../domain';

// Re-export entity types for consumers
export type {
  CategoryEntity,
  CategoryWithCountEntity,
  LeafCategoryEntity,
} from '../domain';

// Re-export mutations for consumers
export { useAddCategory, useUpdateCategory, useDeleteCategory } from './use-category-mutations';

/**
 * Use Categories
 *
 * Query hook for fetching all categories.
 *
 * CTO MANDATE: Orchestrator Rule
 * Query is disabled until service is ready.
 *
 * @param filters - Optional filters
 * @returns Query result with categories array
 *
 * @example
 * ```typescript
 * function CategoryList() {
 *   const { data: categories, isLoading, error } = useCategories();
 *
 *   if (isLoading) return <Loading />;
 *   if (error) return <Error message={error.message} />;
 *
 *   return (
 *     <ul>
 *       {categories?.map(category => (
 *         <li key={category.id}>{category.name}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useCategories(filters?: CategoryFilters) {
  const service = useCategoryService();

  return useQuery({
    queryKey: QUERY_KEYS.CATEGORIES,
    queryFn: () => {
      if (!service) {
        throw new Error('Category service not ready');
      }
      return service.getAll(filters);
    },
    staleTime: QUERY_CONFIG.STALE_TIME.MEDIUM,
    enabled: !!service, // CTO MANDATE: Orchestrator Rule
  });
}

/**
 * Use Categories With Counts
 *
 * Query hook for fetching categories with transaction counts.
 *
 * CTO MANDATE: Orchestrator Rule
 * Query is disabled until service is ready.
 *
 * @returns Query result with categories including transactionCount
 */
export function useCategoriesWithCounts() {
  const service = useCategoryService();

  return useQuery({
    queryKey: [...QUERY_KEYS.CATEGORIES, 'with-counts'],
    queryFn: () => {
      if (!service) {
        throw new Error('Category service not ready');
      }
      return service.getAllWithCounts();
    },
    staleTime: QUERY_CONFIG.STALE_TIME.MEDIUM,
    enabled: !!service, // CTO MANDATE: Orchestrator Rule
  });
}

/**
 * Use Category
 *
 * Query hook for fetching a single category by ID.
 *
 * CTO MANDATE: Orchestrator Rule
 * Query is disabled until service is ready.
 *
 * @param id - Category ID
 * @returns Query result with category entity
 *
 * @example
 * ```typescript
 * function CategoryDetail({ id }: { id: string }) {
 *   const { data: category, isLoading } = useCategory(id);
 *
 *   if (isLoading) return <Loading />;
 *   if (!category) return <NotFound />;
 *
 *   return <div>{category.name}</div>;
 * }
 * ```
 */
export function useCategory(id: string) {
  const service = useCategoryService();

  return useQuery({
    queryKey: [...QUERY_KEYS.CATEGORIES, id],
    queryFn: () => {
      if (!service) {
        throw new Error('Category service not ready');
      }
      return service.getById(id);
    },
    enabled: !!service && !!id, // CTO MANDATE: Orchestrator Rule
  });
}

/**
 * Use Leaf Categories
 *
 * Query hook for fetching leaf categories (assignable to transactions).
 *
 * CTO MANDATE: This is the ONLY hook for transaction category selectors.
 * Leaf categories are either:
 * - Child categories (have a parent)
 * - Orphaned parents (parents with no children)
 *
 * CTO MANDATE: Orchestrator Rule
 * Query is disabled until service is ready.
 *
 * @returns Query result with leaf categories array
 */
export function useLeafCategoriesQuery() {
  const service = useCategoryService();

  return useQuery({
    queryKey: [...QUERY_KEYS.CATEGORIES, 'leaf'],
    queryFn: () => {
      if (!service) {
        throw new Error('Category service not ready');
      }
      return service.getLeafCategories();
    },
    staleTime: QUERY_CONFIG.STALE_TIME.MEDIUM,
    enabled: !!service, // CTO MANDATE: Orchestrator Rule
  });
}

/**
 * Use Categorized Categories
 *
 * Query hook for fetching categories organized by type (income/expense).
 *
 * CTO MANDATE: Orchestrator Rule
 * Query is disabled until service is ready.
 *
 * @returns Query result with categorized structure
 */
export function useCategorizedCategories() {
  const service = useCategoryService();

  return useQuery({
    queryKey: [...QUERY_KEYS.CATEGORIES, 'categorized'],
    queryFn: () => {
      if (!service) {
        throw new Error('Category service not ready');
      }
      return service.getCategorizedCategories();
    },
    staleTime: QUERY_CONFIG.STALE_TIME.MEDIUM,
    enabled: !!service, // CTO MANDATE: Orchestrator Rule
  });
}
