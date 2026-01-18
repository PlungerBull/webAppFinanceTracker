/**
 * Category Mutation Hooks
 *
 * React Query mutation hooks for category operations.
 * Includes optimistic updates for Zero-Latency UX.
 *
 * CTO Mandate: ALL mutation hooks must include onMutate for instant cache updates.
 *
 * @module use-category-mutations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QUERY_KEYS } from '@/lib/constants';
import { useCategoryService } from './use-category-service';
import type {
  CreateCategoryDTO,
  UpdateCategoryDTO,
  CategoryEntity,
  CategoryWithCountEntity,
  HierarchyViolationReason,
} from '../domain';
import {
  isCategoryHasChildrenError,
  isCategoryHasTransactionsError,
  isCategoryHierarchyError,
  isCategoryDuplicateNameError,
} from '../domain';

/**
 * Use Add Category
 *
 * Mutation hook for creating a new category.
 * Invalidates categories and groupings cache on success.
 *
 * @example
 * ```typescript
 * const { mutate, isPending } = useAddCategory();
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

  return useMutation({
    mutationFn: (data: CreateCategoryDTO) => service.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUPINGS });
    },
    onError: (err) => {
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
  });
}

/**
 * Use Update Category
 *
 * Mutation hook for updating an existing category.
 * Includes optimistic updates for Zero-Latency UX.
 *
 * @example
 * ```typescript
 * const { mutate, isPending } = useUpdateCategory();
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

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryDTO }) =>
      service.update(id, data),

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
}

/**
 * Use Delete Category
 *
 * Mutation hook for deleting a category.
 * Includes optimistic updates for Zero-Latency UX.
 *
 * CTO Mandate: Type-safe error handling via instanceof.
 * - CategoryHasTransactionsError: Category has linked transactions
 * - CategoryHasChildrenError: Parent has child categories
 *
 * @example
 * ```typescript
 * const { mutate, isPending } = useDeleteCategory();
 *
 * mutate('category-uuid');
 * ```
 */
export function useDeleteCategory() {
  const service = useCategoryService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => service.delete(id),

    // Optimistic removal for instant UI feedback
    onMutate: async (id) => {
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
    onError: (err, _id, context) => {
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
}
