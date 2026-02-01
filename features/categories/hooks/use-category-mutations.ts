/**
 * Category Mutation Hooks
 *
 * React Query mutation hooks for category operations.
 * Includes optimistic updates for Zero-Latency UX.
 *
 * CTO Mandates:
 * - ALL mutation hooks must include onMutate for instant cache updates
 * - Orchestrator Rule: Service may be null, mutations must guard
 *
 * @module use-category-mutations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QUERY_KEYS } from '@/lib/constants';
import { useAuthStore } from '@/stores/auth-store';
import { createOptimisticCategory } from '@/domain/categories';
import { useCategoryService } from './use-category-service';
import type {
  CreateCategoryDTO,
  UpdateCategoryDTO,
  CategoryEntity,
  CategoryWithCountEntity,
  HierarchyViolationReason,
} from '../domain';
import {
  CategoryRepositoryError,
  isCategoryHasChildrenError,
  isCategoryHasTransactionsError,
  isCategoryHierarchyError,
  isCategoryDuplicateNameError,
  isCategoryMergeError,
} from '../domain';
import type { MergeCategoriesResult } from '../services';

/**
 * Use Add Category
 *
 * Mutation hook for creating a new category.
 * Includes S-Tier optimistic updates for Zero-Latency UX.
 *
 * CTO MANDATE: Orchestrator Rule
 * Returns isReady flag to indicate if service is available.
 *
 * S-Tier Features:
 * - Multi-key cache synchronization (cancels all related queries)
 * - Auth integrity (uses real userId from auth store)
 * - Pure factory pattern (uses createOptimisticCategory from Sacred Domain)
 *
 * @example
 * ```typescript
 * const { mutate, isPending, isReady } = useAddCategory();
 *
 * // Guard against unready state
 * if (!isReady) return <LoadingSpinner />;
 *
 * mutate({
 *   name: 'Groceries',
 *   color: '#22c55e',
 *   type: 'expense',
 *   parentId: null,
 * });
 * ```
 */
export function useAddCategory() {
  const service = useCategoryService();
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? ''); // S-Tier: Auth Integrity

  const mutation = useMutation({
    mutationFn: (data: CreateCategoryDTO) => {
      if (!service) {
        throw new CategoryRepositoryError('Category service not ready');
      }
      return service.create(data);
    },

    // S-Tier: Optimistic update with multi-key sync
    onMutate: async (data) => {
      // 1. S-Tier: Cancel ALL related queries to prevent race conditions
      await Promise.all([
        queryClient.cancelQueries({ queryKey: QUERY_KEYS.CATEGORIES }),
        queryClient.cancelQueries({ queryKey: [...QUERY_KEYS.CATEGORIES, 'categorized'] }),
        queryClient.cancelQueries({ queryKey: [...QUERY_KEYS.CATEGORIES, 'leaf'] }),
        queryClient.cancelQueries({ queryKey: [...QUERY_KEYS.CATEGORIES, 'with-counts'] }),
        queryClient.cancelQueries({ queryKey: QUERY_KEYS.GROUPINGS }),
      ]);

      // 2. Snapshot base list for rollback
      const previousCategories = queryClient.getQueryData<CategoryEntity[]>(
        QUERY_KEYS.CATEGORIES
      );

      // 3. S-Tier: Create optimistic entity via Pure Factory with Auth Integrity
      const optimisticCategory = createOptimisticCategory(data, userId);

      // 4. Optimistically add to base cache
      if (previousCategories) {
        queryClient.setQueryData<CategoryEntity[]>(
          QUERY_KEYS.CATEGORIES,
          [...previousCategories, optimisticCategory]
        );
      }

      return { previousCategories, optimisticId: optimisticCategory.id };
    },

    // Rollback on error with user-friendly toast
    // CTO Mandate: Use instanceof for type-safe error handling (NOT string matching)
    onError: (err, _variables, context) => {
      // Rollback optimistic update
      if (context?.previousCategories) {
        queryClient.setQueryData(QUERY_KEYS.CATEGORIES, context.previousCategories);
      }

      // Type-safe error handling via type guards
      if (isCategoryDuplicateNameError(err)) {
        toast.error('Category already exists', {
          description: err.message,
        });
      } else if (isCategoryHierarchyError(err)) {
        toast.error('Invalid hierarchy', {
          description: err.message,
        });
      } else {
        const errorMessage = err instanceof Error ? err.message : String(err);
        toast.error('Failed to create category', {
          description: errorMessage,
        });
      }
    },

    // S-Tier: Always invalidate on settle (success OR error)
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUPINGS });
    },
  });

  return {
    ...mutation,
    isReady: !!service,
  };
}

/**
 * Use Update Category
 *
 * Mutation hook for updating an existing category.
 * Includes optimistic updates for Zero-Latency UX.
 *
 * CTO MANDATE: Orchestrator Rule
 * Returns isReady flag to indicate if service is available.
 *
 * @example
 * ```typescript
 * const { mutate, isPending, isReady } = useUpdateCategory();
 *
 * // Guard against unready state
 * if (!isReady) return <LoadingSpinner />;
 *
 * mutate({
 *   id: 'category-uuid',
 *   data: { name: 'Updated Name', color: '#3b82f6' },
 * });
 * ```
 */
export function useUpdateCategory() {
  const service = useCategoryService();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryDTO }) => {
      if (!service) {
        throw new CategoryRepositoryError('Category service not ready');
      }
      return service.update(id, data);
    },

    // Optimistic update for instant UI feedback
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.CATEGORIES });

      // Snapshot current state for rollback
      const previousCategories = queryClient.getQueryData<CategoryEntity[]>(
        QUERY_KEYS.CATEGORIES
      );

      // Optimistically update cache
      if (previousCategories) {
        queryClient.setQueryData<CategoryEntity[]>(
          QUERY_KEYS.CATEGORIES,
          previousCategories.map((category) =>
            category.id === id
              ? {
                  ...category,
                  ...(data.name !== undefined && { name: data.name }),
                  ...(data.color !== undefined && { color: data.color }),
                  updatedAt: new Date().toISOString(),
                }
              : category
          )
        );
      }

      return { previousCategories };
    },

    // Rollback on error with user-friendly toast
    // CTO Mandate: Use instanceof for type-safe error handling (NOT string matching)
    onError: (err, _variables, context) => {
      // Rollback optimistic update
      if (context?.previousCategories) {
        queryClient.setQueryData(QUERY_KEYS.CATEGORIES, context.previousCategories);
      }

      // Type-safe error handling via type guards
      if (isCategoryHierarchyError(err)) {
        const messages: Record<HierarchyViolationReason, string> = {
          self_parent: 'A category cannot be its own parent.',
          max_depth: 'Categories can only be 2 levels deep.',
          parent_is_child: 'Cannot make a subcategory the parent.',
        };
        toast.error('Invalid hierarchy', {
          description: messages[err.reason],
        });
      } else if (isCategoryDuplicateNameError(err)) {
        toast.error('Category already exists', {
          description: err.message,
        });
      } else {
        const errorMessage = err instanceof Error ? err.message : String(err);
        toast.error('Failed to update category', {
          description: errorMessage,
        });
      }
    },

    // Refetch after success to ensure consistency
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUPINGS });
    },
  });

  return {
    ...mutation,
    isReady: !!service,
  };
}

/**
 * Use Delete Category
 *
 * Mutation hook for soft-deleting a category (Tombstone Pattern).
 * Includes optimistic updates for Zero-Latency UX.
 *
 * CTO Mandates:
 * - Type-safe error handling via instanceof
 * - Orchestrator Rule: Service may be null
 *
 * @example
 * ```typescript
 * const { mutate, isPending, isReady } = useDeleteCategory();
 *
 * // Guard against unready state
 * if (!isReady) return <LoadingSpinner />;
 *
 * mutate({ id: 'category-uuid', version: 1 });
 * ```
 */
export function useDeleteCategory() {
  const service = useCategoryService();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => {
      if (!service) {
        throw new CategoryRepositoryError('Category service not ready');
      }
      return service.delete(id, version);
    },

    // Optimistic removal for instant UI feedback
    onMutate: async ({ id }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.CATEGORIES });

      // Snapshot current state for rollback
      const previousCategories = queryClient.getQueryData<CategoryWithCountEntity[]>(
        QUERY_KEYS.CATEGORIES
      );

      // Optimistically remove from cache
      if (previousCategories) {
        queryClient.setQueryData<CategoryWithCountEntity[]>(
          QUERY_KEYS.CATEGORIES,
          previousCategories.filter((category) => category.id !== id)
        );
      }

      return { previousCategories };
    },

    // Rollback on error with user-friendly toast
    // CTO Mandate: Use instanceof for type-safe error handling (NOT string matching)
    onError: (err, _variables, context) => {
      // Rollback optimistic update
      if (context?.previousCategories) {
        queryClient.setQueryData(QUERY_KEYS.CATEGORIES, context.previousCategories);
      }

      // Type-safe error handling via type guards
      if (isCategoryHasTransactionsError(err)) {
        toast.error('Cannot delete category', {
          description:
            err.transactionCount > 0
              ? `This category has ${err.transactionCount} transactions. Move or delete them first.`
              : 'This category has transactions. Move or delete them first.',
        });
      } else if (isCategoryHasChildrenError(err)) {
        toast.error('Cannot delete category', {
          description:
            err.childCount > 0
              ? `This category has ${err.childCount} subcategories. Delete or move them first.`
              : 'This category has subcategories. Delete or move them first.',
        });
      } else {
        const errorMessage = err instanceof Error ? err.message : String(err);
        toast.error('Failed to delete category', {
          description: errorMessage,
        });
      }
    },

    // Refetch after success to ensure consistency
    // CTO Mandate: Batch invalidation with Promise.all for performance
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUPINGS }),
        // Also invalidate transactions as they may reference deleted category
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRANSACTIONS.ALL }),
      ]);
    },
  });

  return {
    ...mutation,
    isReady: !!service,
  };
}

/**
 * Use Merge Categories
 *
 * Mutation hook for merging multiple categories into one.
 *
 * CTO MANDATES:
 * - This is a Ledger Event that bumps transaction versions
 * - Orchestrator Rule: Service may be null
 *
 * CRITICAL: Must invalidate BOTH categories AND transactions caches
 * to prevent UI desync after merge.
 *
 * @example
 * ```typescript
 * const { mutate, isPending, isReady } = useMergeCategories();
 *
 * // Guard against unready state
 * if (!isReady) return <LoadingSpinner />;
 *
 * mutate({
 *   sourceIds: ['cat-1', 'cat-2', 'cat-3'],
 *   targetId: 'cat-target',
 * });
 * ```
 */
export function useMergeCategories() {
  const service = useCategoryService();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({
      sourceIds,
      targetId,
    }: {
      sourceIds: string[];
      targetId: string;
    }): Promise<MergeCategoriesResult> => {
      if (!service) {
        throw new CategoryRepositoryError('Category service not ready');
      }
      return service.mergeCategories(sourceIds, targetId);
    },

    onSuccess: (result) => {
      toast.success('Categories merged', {
        description: `${result.mergedCategoryCount} categories merged. ${result.affectedTransactionCount} transactions reassigned.`,
      });
    },

    onError: (err) => {
      // Type-safe error handling via type guards
      if (isCategoryMergeError(err)) {
        const messages: Record<string, string> = {
          empty_source: 'No categories selected to merge.',
          target_not_found: 'Target category not found.',
          unauthorized: 'You do not have permission to merge these categories.',
          target_in_source:
            'Target category cannot be one of the source categories.',
          has_children:
            'Cannot merge categories that have subcategories. Reassign them first.',
        };
        toast.error('Merge failed', {
          description: messages[err.reason] || err.message,
        });
      } else {
        const errorMessage = err instanceof Error ? err.message : String(err);
        toast.error('Failed to merge categories', {
          description: errorMessage,
        });
      }
    },

    // CTO MANDATE: MUST invalidate BOTH categories AND transactions
    // Failure to invalidate transactions causes UI desync
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUPINGS }),
        // CRITICAL: Transactions now point to different category
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRANSACTIONS.ALL }),
      ]);
    },
  });

  return {
    ...mutation,
    isReady: !!service,
  };
}

// ============================================================================
// GROUPING MUTATIONS (via ICategoryOperations - Sacred Domain Compliant)
// ============================================================================

import { useCategoryOperations } from '@/lib/hooks/use-category-operations';
import {
  isCategoryOperationError,
  type CreateGroupingDTO,
  type UpdateGroupingDTO,
  type ReassignSubcategoryDTO,
} from '@/domain/categories';

/**
 * Use Create Grouping Mutation
 *
 * Mutation hook for creating a new parent category (grouping).
 * Uses ICategoryOperations via orchestrator hook for Sacred Domain compliance.
 *
 * CTO MANDATE: Orchestrator Rule
 * Returns isReady flag to indicate if operations are available.
 *
 * @example
 * ```typescript
 * const { mutateAsync, isPending, isReady } = useCreateGroupingMutation();
 *
 * // Guard against unready state
 * if (!isReady) return <LoadingSpinner />;
 *
 * await mutateAsync({ name: 'Food & Dining', color: '#22c55e', type: 'expense' });
 * ```
 */
export function useCreateGroupingMutation() {
  const operations = useCategoryOperations();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: CreateGroupingDTO) => {
      if (!operations) {
        throw new Error('Category operations not ready');
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
 * Use Update Grouping Mutation
 *
 * Mutation hook for updating a parent category (grouping).
 * Uses ICategoryOperations via orchestrator hook for Sacred Domain compliance.
 *
 * CTO MANDATE: Orchestrator Rule
 * Returns isReady flag to indicate if operations are available.
 */
export function useUpdateGroupingMutation() {
  const operations = useCategoryOperations();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateGroupingDTO }) => {
      if (!operations) {
        throw new Error('Category operations not ready');
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
 * Use Reassign Subcategory Mutation
 *
 * Mutation hook for moving a subcategory to a different parent.
 * Uses ICategoryOperations via orchestrator hook for Sacred Domain compliance.
 *
 * CTO MANDATE: Orchestrator Rule
 * Returns isReady flag to indicate if operations are available.
 */
export function useReassignSubcategoryMutation() {
  const operations = useCategoryOperations();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: ReassignSubcategoryDTO) => {
      if (!operations) {
        throw new Error('Category operations not ready');
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
