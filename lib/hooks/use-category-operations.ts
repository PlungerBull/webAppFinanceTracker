/**
 * Category Operations Orchestrator Hook
 *
 * Provides ICategoryOperations interface for cross-feature use.
 * Wraps the category service implementation without creating direct feature coupling.
 *
 * ARCHITECTURE PATTERN:
 * - Components import from @/lib/hooks/use-category-operations
 * - This hook internally uses the category service
 * - Features never import from @/features/categories/hooks
 * - Error translation: Feature errors → Sacred Domain error codes
 *
 * CTO MANDATE: Orchestrator Rule
 * - Returns null until service is ready
 * - Consumers must guard with enabled: !!operations
 *
 * Swift Mirror:
 * ```swift
 * class CategoryOperationsAdapter: CategoryOperationsProtocol {
 *     private let categoryService: CategoryServiceProtocol
 *
 *     init(categoryService: CategoryServiceProtocol) {
 *         self.categoryService = categoryService
 *     }
 *
 *     // ... adapter methods that map CategoryError to CategoryOperationError
 * }
 * ```
 *
 * @module lib/hooks/use-category-operations
 */

'use client';

import { useMemo } from 'react';
import { useCategoryService } from '@/features/categories/hooks/use-category-service';
import {
  isCategoryDuplicateNameError,
  isCategoryHasChildrenError,
  isCategoryHasTransactionsError,
  isCategoryHierarchyError,
  isCategoryVersionConflictError,
  isCategoryNotFoundError,
} from '@/features/categories/domain';
import type {
  ICategoryOperations,
  CategoryOperationError,
  CategoryErrorCode,
} from '@/domain/categories';

// ============================================================================
// ERROR TRANSLATION LAYER
// ============================================================================

/**
 * Creates a CategoryOperationError with the given code and message.
 *
 * Uses Object.assign to add the code property to an Error instance,
 * ensuring instanceof Error checks still work.
 */
function createCategoryError(
  code: CategoryErrorCode,
  message: string,
  childCount?: number
): CategoryOperationError {
  const error = new Error(message) as CategoryOperationError;
  return Object.assign(error, { code, childCount });
}

/**
 * Maps feature-level errors to Sacred Domain error codes.
 *
 * This translation layer keeps error handling in the orchestrator,
 * allowing consumers to handle errors using only Sacred Domain types.
 */
function mapToCategoryError(error: unknown): CategoryOperationError {
  // Version conflict (optimistic concurrency control)
  if (isCategoryVersionConflictError(error)) {
    return createCategoryError('VERSION_CONFLICT', error.message);
  }

  // Duplicate name within same parent
  if (isCategoryDuplicateNameError(error)) {
    return createCategoryError('DUPLICATE_NAME', error.message);
  }

  // Parent has children (cannot delete)
  if (isCategoryHasChildrenError(error)) {
    return createCategoryError('HAS_CHILDREN', error.message, error.childCount);
  }

  // Category has transactions (cannot delete)
  if (isCategoryHasTransactionsError(error)) {
    return createCategoryError('HAS_TRANSACTIONS', error.message);
  }

  // Hierarchy constraint violation
  if (isCategoryHierarchyError(error)) {
    return createCategoryError('INVALID_HIERARCHY', error.message);
  }

  // Category not found
  if (isCategoryNotFoundError(error)) {
    return createCategoryError('NOT_FOUND', error.message);
  }

  // Unknown error - preserve message
  const message = error instanceof Error ? error.message : String(error);
  return createCategoryError('NOT_FOUND', message);
}

/**
 * Wraps a service method with error translation.
 *
 * Catches feature-level errors and re-throws them as Sacred Domain errors.
 */
async function withErrorMapping<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw mapToCategoryError(error);
  }
}

// ============================================================================
// ORCHESTRATOR HOOK
// ============================================================================

/**
 * Hook that provides ICategoryOperations interface.
 *
 * Creates an adapter around the CategoryService that implements ICategoryOperations.
 * This allows features to use category functionality without directly importing
 * from the categories feature.
 *
 * CTO MANDATE: Orchestrator Rule
 * Returns null until local database is ready.
 *
 * REACT COMPILER COMPLIANCE:
 * useMemo returns a pure computation - no ref mutations.
 * The service reference from useCategoryService is stable after WatermelonDB
 * initialization, so useMemo's dependency tracking provides natural stability.
 *
 * @returns ICategoryOperations implementation or null if not ready
 *
 * @example
 * ```typescript
 * function CategoryList() {
 *   const operations = useCategoryOperations();
 *
 *   // Guard with enabled flag for queries
 *   const { data } = useQuery({
 *     queryKey: ['groupings'],
 *     queryFn: () => operations?.getGroupings() ?? Promise.resolve([]),
 *     enabled: !!operations,
 *   });
 *
 *   // Handle errors using Sacred Domain types
 *   const handleCreate = async (data: CreateGroupingDTO) => {
 *     try {
 *       await operations?.createGrouping(data);
 *     } catch (err) {
 *       if (isCategoryOperationError(err)) {
 *         switch (err.code) {
 *           case 'DUPLICATE_NAME':
 *             toast.error('Category already exists');
 *             break;
 *           // ... handle other codes
 *         }
 *       }
 *     }
 *   };
 * }
 * ```
 */
export function useCategoryOperations(): ICategoryOperations | null {
  const service = useCategoryService();

  // S-TIER: Pure useMemo - no ref mutations
  // useMemo already provides stable object identity when service is stable.
  // The service reference from WatermelonDB is stable after initialization.
  return useMemo(() => {
    // CTO MANDATE: Orchestrator Rule
    // Don't create operations until service is ready
    if (!service) {
      return null;
    }

    // Pure computation - object created only when service changes
    return {
      getGroupings: () => withErrorMapping(() => service.getGroupings()),

      getByParentId: (parentId) =>
        withErrorMapping(() => service.getByParentId(parentId)),

      createGrouping: (data) =>
        withErrorMapping(() => service.createGrouping(data)),

      updateGrouping: (id, data) =>
        withErrorMapping(() => service.updateGrouping(id, data)),

      createSubcategory: (data) =>
        withErrorMapping(() => service.createSubcategory(data)),

      reassignSubcategory: (data) =>
        withErrorMapping(() => service.reassignSubcategory(data)),

      delete: (id, version) =>
        withErrorMapping(() => service.delete(id, version)),
    };
  }, [service]);
}

// Legacy alias for backward compatibility during migration
/** @deprecated Use useCategoryOperations instead */
export const useGroupingOperations = useCategoryOperations;
