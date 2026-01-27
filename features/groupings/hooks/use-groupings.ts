/**
 * Grouping Query and Mutation Hooks
 *
 * React Query hooks for grouping (parent category) operations.
 * Uses CategoryService since groupings are parent categories (parentId = null).
 *
 * CTO MANDATES:
 * - Orchestrator Rule: Service may be null, queries/mutations must guard
 *
 * @module use-groupings
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QUERY_CONFIG, QUERY_KEYS } from '@/lib/constants';
import { useCategoryService } from '@/features/categories/hooks/use-category-service';
import type {
  CreateGroupingDTO,
  CreateSubcategoryDTO,
  UpdateGroupingDTO,
  ReassignSubcategoryDTO,
  GroupingEntity,
  CategoryWithCountEntity,
} from '@/features/categories/domain';
import {
  CategoryRepositoryError,
  isCategoryHasChildrenError,
  isCategoryHasTransactionsError,
  isCategoryDuplicateNameError,
  isCategoryHierarchyError,
} from '@/features/categories/domain';

// Re-export types for consumers
export type { GroupingEntity, CategoryWithCountEntity };

/**
 * Use Groupings
 *
 * Query hook for fetching all parent categories (groupings).
 *
 * CTO MANDATE: Orchestrator Rule
 * Query is disabled until service is ready.
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
  const service = useCategoryService();

  return useQuery({
    queryKey: QUERY_KEYS.GROUPINGS,
    queryFn: () => {
      if (!service) {
        throw new Error('Category service not ready');
      }
      return service.getGroupings();
    },
    staleTime: QUERY_CONFIG.STALE_TIME.MEDIUM,
    enabled: !!service, // CTO MANDATE: Orchestrator Rule
  });
}

/**
 * Use Grouping Children
 *
 * Query hook for fetching children of a specific parent.
 *
 * CTO MANDATE: Orchestrator Rule
 * Query is disabled until service is ready.
 *
 * @param parentId - Parent category ID
 * @returns Query result with child categories array
 */
export function useGroupingChildren(parentId: string) {
  const service = useCategoryService();

  return useQuery({
    queryKey: ['grouping-children', parentId],
    queryFn: () => {
      if (!service) {
        throw new Error('Category service not ready');
      }
      return service.getByParentId(parentId);
    },
    enabled: !!service && !!parentId, // CTO MANDATE: Orchestrator Rule
    staleTime: QUERY_CONFIG.STALE_TIME.MEDIUM,
  });
}

/**
 * Use Add Grouping
 *
 * Mutation hook for creating a new parent category.
 *
 * CTO MANDATE: Orchestrator Rule
 * Returns isReady flag to indicate if service is available.
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
  const service = useCategoryService();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: CreateGroupingDTO) => {
      if (!service) {
        throw new CategoryRepositoryError('Category service not ready');
      }
      return service.createGrouping(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUPINGS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES });
    },
    onError: (err) => {
      if (isCategoryDuplicateNameError(err)) {
        toast.error('Grouping already exists', {
          description: err.message,
        });
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
    isReady: !!service,
  };
}

/**
 * Use Update Grouping
 *
 * Mutation hook for updating a parent category.
 *
 * CTO MANDATE: Orchestrator Rule
 * Returns isReady flag to indicate if service is available.
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
  const service = useCategoryService();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateGroupingDTO }) => {
      if (!service) {
        throw new CategoryRepositoryError('Category service not ready');
      }
      return service.updateGrouping(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUPINGS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES });
    },
    onError: (err) => {
      if (isCategoryDuplicateNameError(err)) {
        toast.error('Grouping already exists', {
          description: err.message,
        });
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
    isReady: !!service,
  };
}

/**
 * Use Delete Grouping
 *
 * Mutation hook for deleting a parent category.
 *
 * CTO Mandates:
 * - Type-safe error handling via instanceof
 * - Orchestrator Rule: Service may be null
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
  const service = useCategoryService();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => {
      if (!service) {
        throw new CategoryRepositoryError('Category service not ready');
      }
      return service.delete(id, version);
    },
    onError: (err) => {
      // CTO Mandate: Use instanceof for type-safe error handling
      if (isCategoryHasChildrenError(err)) {
        toast.error('Cannot delete grouping', {
          description:
            err.childCount > 0
              ? `This grouping has ${err.childCount} subcategories. Move or delete them first.`
              : 'Move or delete subcategories first.',
        });
      } else if (isCategoryHasTransactionsError(err)) {
        toast.error('Cannot delete grouping', {
          description: 'This grouping has transactions. Move or delete them first.',
        });
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
    isReady: !!service,
  };
}

/**
 * Use Add Subcategory
 *
 * Mutation hook for creating a subcategory under a parent.
 *
 * CTO MANDATE: Orchestrator Rule
 * Returns isReady flag to indicate if service is available.
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
  const service = useCategoryService();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: CreateSubcategoryDTO) => {
      if (!service) {
        throw new CategoryRepositoryError('Category service not ready');
      }
      return service.createSubcategory(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUPINGS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES });
    },
    onError: (err) => {
      if (isCategoryDuplicateNameError(err)) {
        toast.error('Subcategory already exists', {
          description: err.message,
        });
      } else if (isCategoryHierarchyError(err)) {
        toast.error('Invalid hierarchy', {
          description: err.message,
        });
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
    isReady: !!service,
  };
}

/**
 * Use Reassign Subcategory
 *
 * Mutation hook for moving a subcategory to a different parent.
 *
 * CTO MANDATE: Orchestrator Rule
 * Returns isReady flag to indicate if service is available.
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
  const service = useCategoryService();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: ReassignSubcategoryDTO) => {
      if (!service) {
        throw new CategoryRepositoryError('Category service not ready');
      }
      return service.reassignSubcategory(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUPINGS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES });
    },
    onError: (err) => {
      if (isCategoryHierarchyError(err)) {
        toast.error('Invalid reassignment', {
          description: err.message,
        });
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
    isReady: !!service,
  };
}
