import { useMemo } from 'react';
import { useCategories } from './use-categories';
import type { CategoryWithCount } from '@/types/domain';

export interface CategoryGroup {
  parent: CategoryWithCount;
  children: CategoryWithCount[];
}

export interface CategorizedCategories {
  income: CategoryGroup[];
  expense: CategoryGroup[];
}

/**
 * Groups categories by type (income/expense) and organizes them into parent-child hierarchies
 */
export function useCategorizedCategories(): CategorizedCategories {
  const { data: categories = [] } = useCategories();

  const grouped = useMemo(() => {
    const income: CategoryGroup[] = [];
    const expense: CategoryGroup[] = [];

    // Get all parent categories (those with no parentId)
    const parents = categories.filter((c) => c.parentId === null);

    parents.forEach((parent) => {
      // Find all children for this parent
      const children = categories.filter((c) => c.parentId === parent.id);

      const group: CategoryGroup = {
        parent,
        // If no children, use the parent itself as the only item
        children: children.length > 0 ? children : [parent],
      };

      // Group by type
      if (parent.type === 'income') {
        income.push(group);
      } else {
        expense.push(group);
      }
    });

    return { income, expense };
  }, [categories]);

  return grouped;
}
