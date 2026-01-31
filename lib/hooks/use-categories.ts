/**
 * Category Orchestrator Hooks
 *
 * Provides category query access for cross-feature use.
 * Wraps the categories feature implementation without creating direct feature coupling.
 *
 * ARCHITECTURE PATTERN:
 * - Components import from @/lib/hooks/use-categories
 * - This hook internally uses the categories feature hooks
 * - Features never import from @/features/categories/hooks
 *
 * @module lib/hooks/use-categories
 */

'use client';

import {
  useCategories as useCategoriesFeature,
  useCategoriesWithCounts as useCategoriesWithCountsFeature,
  useCategory as useCategoryFeature,
  useLeafCategoriesQuery as useLeafCategoriesQueryFeature,
  useCategorizedCategories as useCategorizedCategoriesFeature,
  useAddCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '@/features/categories/hooks/use-categories';
import type { CategoryFilters } from '@/features/categories/domain';

// Re-export entity types
export type {
  CategoryEntity,
  CategoryWithCountEntity,
  LeafCategoryEntity,
} from '@/features/categories/domain';

// Re-export mutations
export { useAddCategory, useUpdateCategory, useDeleteCategory };

/**
 * Hook to fetch all categories.
 *
 * Orchestrator wrapper around the feature hook.
 * Use this in features other than categories.
 */
export function useCategories(filters?: CategoryFilters) {
  return useCategoriesFeature(filters);
}

/**
 * Hook to fetch categories with transaction counts.
 *
 * Orchestrator wrapper around the feature hook.
 * Use this in features other than categories.
 */
export function useCategoriesWithCounts() {
  return useCategoriesWithCountsFeature();
}

/**
 * Hook to fetch a single category by ID.
 *
 * Orchestrator wrapper around the feature hook.
 * Use this in features other than categories.
 */
export function useCategory(id: string) {
  return useCategoryFeature(id);
}

/**
 * Hook to fetch leaf categories (assignable to transactions).
 *
 * Orchestrator wrapper around the feature hook.
 * Use this in features other than categories.
 */
export function useLeafCategoriesQuery() {
  return useLeafCategoriesQueryFeature();
}

/**
 * Hook to fetch categories organized by type (income/expense).
 *
 * Orchestrator wrapper around the feature hook.
 * Use this in features other than categories.
 */
export function useCategorizedCategories() {
  return useCategorizedCategoriesFeature();
}
