/**
 * Grouping Query and Mutation Hooks
 *
 * React Query hooks for grouping (parent category) operations.
 * Uses ICategoryOperations via orchestrator hook for decoupled service access.
 *
 * CTO MANDATES:
 * - Orchestrator Rule: Operations may be null, queries/mutations must guard
 * - Sacred Domain: Types imported from @/domain, not @/features
 * - Error Codes: Handle typed errors from ICategoryOperations
 *
 * @module use-groupings
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QUERY_CONFIG, QUERY_KEYS } from '@/lib/constants';
import { useCategoryOperations } from '@/lib/hooks/use-category-operations';
import type {
  CreateGroupingDTO,
  CreateSubcategoryDTO,
  UpdateGroupingDTO,
  ReassignSubcategoryDTO,
  GroupingEntity,
  CategoryWithCountEntity,
} from '@/domain/categories';
import { isCategoryOperationError } from '@/domain/categories';

// Re-export types for consumers (from Sacred Domain)
export type { GroupingEntity, CategoryWithCountEntity };

/**
 * Use Groupings
 *
 * Query hook for fetching all parent categories (groupings).
 *
 * CTO MANDATE: Orchestrator Rule
 * Query is disabled until operations are ready.
 *
 * @returns Query result with groupings array
 *
 * @example
 * ```typescript
 * function GroupingList() {
 *   const { data: groupings, isLoading } = useGroupings();
 *
 *   if (isLoading) return <Loading />;
 *
 *   return (
 *     <ul>
 *       {groupings?.map(group => (
 *         <li key={group.id}>
 *           {group.name} ({group.childCount} subcategories)
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useGroupings() {
  const operations = useCategoryOperations();

  return useQuery({
    queryKey: QUERY_KEYS.GROUPINGS,
    queryFn: () => {
      if (!operations) {
        throw new Error('Grouping operations not ready');
      }
      return operations.getGroupings();
    },
    staleTime: QUERY_CONFIG.STALE_TIME.MEDIUM,
    enabled: !!operations, // CTO MANDATE: Orchestrator Rule
  });
}

/**
 * Use Grouping Children
 *
 * Query hook for fetching children of a specific parent.
 *
 * CTO MANDATE: Orchestrator Rule
 * Query is disabled until operations are ready.
 *
 * @param parentId - Parent category ID
 * @returns Query result with child categories array
 */
export function useGroupingChildren(parentId: string) {
  const operations = useCategoryOperations();

  return useQuery({
    queryKey: ['grouping-children', parentId],
    queryFn: () => {
      if (!operations) {
        throw new Error('Grouping operations not ready');
      }
      return operations.getByParentId(parentId);
    },
    enabled: !!operations && !!parentId, // CTO MANDATE: Orchestrator Rule
    staleTime: QUERY_CONFIG.STALE_TIME.MEDIUM,
  });
}

/**
 * Use Add Grouping
 *
 * Mutation hook for creating a new parent category.
 *
 * CTO MANDATE: Orchestrator Rule
 * Returns isReady flag to indicate if operations are available.
 *
 * @example
 * ```typescript
 * const { mutate, isPending, isReady } = useAddGrouping();
 *
 * // Guard against unready state
 * if (!isReady) return <LoadingSpinner />;
 *
 * mutate({ name: 'Food & Dining', color: '#22c55e', type: 'expense' });
 * ```
 */
export function useAddGrouping() {
  const operations = useCategoryOperations();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: CreateGroupingDTO) => {
      if (!operations) {
        throw new Error('Grouping operations not ready');
      }
      return operations.createGrouping(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUPINGS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES });
    },
    onError: (err) => {
      if (isCategoryOperationError(err)) {
        switch (err.code) {
          case 'DUPLICATE_NAME':
            toast.error('Grouping already exists', {
              description: err.message,
            });
            break;
          default:
            toast.error('Failed to create grouping', {
              description: err.message,
            });
        }
      } else {
        const errorMessage = err instanceof Error ? err.message : String(err);
        toast.error('Failed to create grouping', {
          description: errorMessage,
        });
      }
    },
  });

  return {
    ...mutation,
    isReady: !!operations,
  };
}

/**
 * Use Update Grouping
 *
 * Mutation hook for updating a parent category.
 *
 * CTO MANDATE: Orchestrator Rule
 * Returns isReady flag to indicate if operations are available.
 *
 * @example
 * ```typescript
 * const { mutate, isPending, isReady } = useUpdateGrouping();
 *
 * // Guard against unready state
 * if (!isReady) return <LoadingSpinner />;
 *
 * mutate({ id: 'group-uuid', data: { name: 'New Name' } });
 * ```
 */
export function useUpdateGrouping() {
  const operations = useCategoryOperations();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateGroupingDTO }) => {
      if (!operations) {
        throw new Error('Grouping operations not ready');
      }
      return operations.updateGrouping(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUPINGS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES });
    },
    onError: (err) => {
      if (isCategoryOperationError(err)) {
        switch (err.code) {
          case 'DUPLICATE_NAME':
            toast.error('Grouping already exists', {
              description: err.message,
            });
            break;
          case 'VERSION_CONFLICT':
            toast.error('Conflict detected', {
              description: 'This grouping was modified elsewhere. Please refresh and try again.',
            });
            break;
          default:
            toast.error('Failed to update grouping', {
              description: err.message,
            });
        }
      } else {
        const errorMessage = err instanceof Error ? err.message : String(err);
        toast.error('Failed to update grouping', {
          description: errorMessage,
        });
      }
    },
  });

  return {
    ...mutation,
    isReady: !!operations,
  };
}

/**
 * Use Delete Grouping
 *
 * Mutation hook for deleting a parent category.
 *
 * CTO Mandates:
 * - Type-safe error handling via error codes
 * - Orchestrator Rule: Operations may be null
 *
 * @example
 * ```typescript
 * const { mutate, isPending, isReady } = useDeleteGrouping();
 *
 * // Guard against unready state
 * if (!isReady) return <LoadingSpinner />;
 *
 * mutate({ id: 'group-uuid', version: 1 });
 * ```
 */
export function useDeleteGrouping() {
  const operations = useCategoryOperations();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => {
      if (!operations) {
        throw new Error('Grouping operations not ready');
      }
      return operations.delete(id, version);
    },
    onError: (err) => {
      // CTO Mandate: Use error codes for type-safe error handling
      if (isCategoryOperationError(err)) {
        switch (err.code) {
          case 'HAS_CHILDREN':
            toast.error('Cannot delete grouping', {
              description:
                err.childCount && err.childCount > 0
                  ? `Has ${err.childCount} subcategories. Move or delete them first.`
                  : 'Move or delete subcategories first.',
            });
            break;
          case 'HAS_TRANSACTIONS':
            toast.error('Cannot delete grouping', {
              description: 'Has transactions. Move or delete them first.',
            });
            break;
          case 'VERSION_CONFLICT':
            toast.error('Conflict detected', {
              description: 'This grouping was modified elsewhere. Please refresh and try again.',
            });
            break;
          default:
            toast.error('Failed to delete grouping', {
              description: err.message,
            });
        }
      } else {
        const errorMessage = err instanceof Error ? err.message : String(err);
        toast.error('Failed to delete grouping', {
          description: errorMessage,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUPINGS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES });
    },
  });

  return {
    ...mutation,
    isReady: !!operations,
  };
}

/**
 * Use Add Subcategory
 *
 * Mutation hook for creating a subcategory under a parent.
 *
 * CTO MANDATE: Orchestrator Rule
 * Returns isReady flag to indicate if operations are available.
 *
 * @example
 * ```typescript
 * const { mutate, isPending, isReady } = useAddSubcategory();
 *
 * // Guard against unready state
 * if (!isReady) return <LoadingSpinner />;
 *
 * mutate({
 *   name: 'Restaurants',
 *   parentId: 'food-dining-uuid',
 *   color: '#22c55e', // optional, inherits from parent if not provided
 * });
 * ```
 */
export function useAddSubcategory() {
  const operations = useCategoryOperations();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: CreateSubcategoryDTO) => {
      if (!operations) {
        throw new Error('Grouping operations not ready');
      }
      return operations.createSubcategory(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUPINGS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES });
    },
    onError: (err) => {
      if (isCategoryOperationError(err)) {
        switch (err.code) {
          case 'DUPLICATE_NAME':
            toast.error('Subcategory already exists', {
              description: err.message,
            });
            break;
          case 'INVALID_HIERARCHY':
            toast.error('Invalid hierarchy', {
              description: err.message,
            });
            break;
          default:
            toast.error('Failed to create subcategory', {
              description: err.message,
            });
        }
      } else {
        const errorMessage = err instanceof Error ? err.message : String(err);
        toast.error('Failed to create subcategory', {
          description: errorMessage,
        });
      }
    },
  });

  return {
    ...mutation,
    isReady: !!operations,
  };
}

/**
 * Use Reassign Subcategory
 *
 * Mutation hook for moving a subcategory to a different parent.
 *
 * CTO MANDATE: Orchestrator Rule
 * Returns isReady flag to indicate if operations are available.
 *
 * @example
 * ```typescript
 * const { mutate, isPending, isReady } = useReassignSubcategory();
 *
 * // Guard against unready state
 * if (!isReady) return <LoadingSpinner />;
 *
 * mutate({
 *   categoryId: 'subcategory-uuid',
 *   newParentId: 'new-parent-uuid',
 * });
 * ```
 */
export function useReassignSubcategory() {
  const operations = useCategoryOperations();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: ReassignSubcategoryDTO) => {
      if (!operations) {
        throw new Error('Grouping operations not ready');
      }
      return operations.reassignSubcategory(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUPINGS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES });
    },
    onError: (err) => {
      if (isCategoryOperationError(err)) {
        switch (err.code) {
          case 'INVALID_HIERARCHY':
            toast.error('Invalid reassignment', {
              description: err.message,
            });
            break;
          default:
            toast.error('Failed to reassign subcategory', {
              description: err.message,
            });
        }
      } else {
        const errorMessage = err instanceof Error ? err.message : String(err);
        toast.error('Failed to reassign subcategory', {
          description: errorMessage,
        });
      }
    },
  });

  return {
    ...mutation,
    isReady: !!operations,
  };
}
