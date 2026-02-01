/**
 * Pure Grouping Logic (S-Tier: iOS-Portable)
 *
 * S-TIER ARCHITECTURE: Pure Transformation Engines
 * No React, no hooks - just data transformation.
 * Can be mirrored 1:1 in Swift for native port.
 *
 * Algorithmic Complexity:
 * - groupCategoriesByParent: O(n) single pass
 * - groupAccountsByGroupId: O(a) single pass
 */

import type { CategoryMonthlyData } from '@/lib/data/data-transformers';

/**
 * Result of grouping categories by parent.
 */
export interface CategoryGroupingResult {
  /** Top-level parent categories (no parentId) */
  parents: CategoryMonthlyData[];
  /** Map of parentId → child categories */
  childrenByParentId: Map<string, CategoryMonthlyData[]>;
}

/**
 * Groups categories by parent ID in O(n) time.
 *
 * iOS Port: Mirror as `GroupingLogic.swift` with identical signature.
 *
 * Algorithm:
 * - Single pass through categories array
 * - Uses Map for O(1) child lookup
 * - Mutates arrays in place (no spread operator)
 *
 * @param categories - Flat array of categories with parentId
 * @returns Object with parents array and childrenByParentId Map
 *
 * @example
 * ```typescript
 * const { parents, childrenByParentId } = groupCategoriesByParent(categories);
 * for (const parent of parents) {
 *   const children = childrenByParentId.get(parent.categoryId) || [];
 * }
 * ```
 */
export function groupCategoriesByParent(
  categories: CategoryMonthlyData[]
): CategoryGroupingResult {
  const childrenByParentId = new Map<string, CategoryMonthlyData[]>();
  const parents: CategoryMonthlyData[] = [];

  for (const cat of categories) {
    if (cat.parentId) {
      // Child category - add to parent's children array
      const siblings = childrenByParentId.get(cat.parentId);
      if (siblings) {
        siblings.push(cat); // O(1) amortized - mutate existing array
      } else {
        childrenByParentId.set(cat.parentId, [cat]);
      }
    } else {
      // Parent category
      parents.push(cat);
    }
  }

  return { parents, childrenByParentId };
}

/**
 * Groups accounts by groupId in O(a) time.
 *
 * iOS Port: Mirror as `GroupingLogic.swift` with identical signature.
 *
 * Algorithm:
 * - Single pass through accounts array
 * - Uses Map for O(1) group lookup
 * - Mutates arrays in place (no array spread!)
 *
 * @param accounts - Flat array of accounts with groupId
 * @returns Map of groupId → accounts
 *
 * @example
 * ```typescript
 * const grouped = groupAccountsByGroupId(accounts);
 * for (const [groupId, groupAccounts] of grouped) {
 *   console.log(groupId, groupAccounts.length);
 * }
 * ```
 */
export function groupAccountsByGroupId<T extends { groupId: string }>(
  accounts: T[]
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const account of accounts) {
    const existing = grouped.get(account.groupId);
    if (existing) {
      existing.push(account); // O(1) amortized - no array spread!
    } else {
      grouped.set(account.groupId, [account]);
    }
  }

  return grouped;
}
