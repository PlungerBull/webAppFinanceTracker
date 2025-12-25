import { useMemo } from 'react';
import { useCategories } from './use-categories';
import type { CategoryWithCount } from '@/types/domain';

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
export function useLeafCategories(): CategoryWithCount[] {
  const { data: categories = [] } = useCategories();

  const leafCategories = useMemo(() => {
    // Get all parent and child categories
    const parents = categories.filter((c) => c.parentId === null);
    const children = categories.filter((c) => c.parentId !== null);

    // Find which parents have children
    const parentsWithChildren = new Set(
      children.map((c) => c.parentId).filter(Boolean)
    );

    // Orphaned parents = parents with no children (should be treated as leaf nodes)
    const orphanedParents = parents.filter((p) => !parentsWithChildren.has(p.id));

    // Combine children + orphaned parents = all selectable categories
    const leaves = [...children, ...orphanedParents];

    // Sort: income first, then expense, then alphabetically by name
    return leaves.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'income' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [categories]);

  return leafCategories;
}
