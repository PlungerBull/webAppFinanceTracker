/**
 * Grouping Children Query Hook
 *
 * S-Tier Orchestrator: Interacts with the service layer directly.
 * Features import from @/lib/hooks, never from @/features/groupings/hooks.
 *
 * ARCHITECTURE PATTERN:
 * - This hook uses useCategoryOperations (service layer orchestrator)
 * - Features/groupings re-exports this hook (Inversion of Control)
 * - Eliminates cross-feature coupling between transactions ↔ groupings
 *
 * CTO MANDATE: Orchestrator Rule
 * - Returns empty array until operations are ready
 * - Consumers can rely on `enabled: !!operations && !!parentId`
 *
 * @module lib/hooks/use-grouping-children
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { useCategoryOperations } from './use-category-operations';
import { QUERY_KEYS, createQueryOptions } from '@/lib/constants';

/**
 * Hook for fetching children of a grouping (parent category).
 *
 * @param parentId - Parent category ID
 * @returns Query result with child categories array
 *
 * @example
 * ```typescript
 * function GroupingDetail({ groupingId }: { groupingId: string }) {
 *   const { data: children = [], isLoading } = useGroupingChildren(groupingId);
 *
 *   if (isLoading) return <Skeleton />;
 *
 *   return (
 *     <ul>
 *       {children.map(child => (
 *         <li key={child.id}>{child.name}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useGroupingChildren(parentId: string) {
  const operations = useCategoryOperations();

  return useQuery({
    queryKey: QUERY_KEYS.GROUPING_CHILDREN(parentId),
    queryFn: () => {
      if (!operations) {
        throw new Error('Category operations not ready');
      }
      return operations.getByParentId(parentId);
    },
    ...createQueryOptions('STRUCTURAL'),
    enabled: !!operations && !!parentId,
  });
}
