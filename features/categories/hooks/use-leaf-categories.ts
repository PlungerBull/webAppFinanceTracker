/**
 * Leaf Categories Hook
 *
 * Returns only leaf categories (children + orphaned parents) for the "Invisible Grouping" pattern.
 *
 * This hook provides categories that can be assigned to transactions:
 * - Child categories (categories with a parentId)
 * - Orphaned parents (parents with no children)
 *
 * CTO MANDATE: This is the ONLY hook for transaction category selectors.
 *
 * @module use-leaf-categories
 */

import { useLeafCategoriesQuery, type LeafCategoryEntity } from './use-categories';

/**
 * Returns only leaf categories (children + orphaned parents) for the "Invisible Grouping" pattern.
 *
 * This hook flattens the category hierarchy by:
 * - Including all child categories (categories with a parentId)
 * - Including orphaned parents (parents with no children)
 * - Excluding parents that have children (they become invisible groupings)
 *
 * Categories are sorted with income first, then expense, then alphabetically within each type.
 */
export function useLeafCategories(): LeafCategoryEntity[] {
  const { data: leafCategories = [] } = useLeafCategoriesQuery();

  // Note: Sorting is handled by the service layer
  return leafCategories;
}
