/**
 * Grouping Operations Orchestrator Hook
 *
 * Provides IGroupingOperations interface for cross-feature use.
 * Wraps the category service implementation without creating direct feature coupling.
 *
 * ARCHITECTURE PATTERN:
 * - Components import from @/lib/hooks/use-grouping-operations
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
 * class GroupingOperationsAdapter: GroupingOperationsProtocol {
 *     private let categoryService: CategoryServiceProtocol
 *
 *     init(categoryService: CategoryServiceProtocol) {
 *         self.categoryService = categoryService
 *     }
 *
 *     // ... adapter methods that map CategoryError to GroupingOperationError
 * }
 * ```
 *
 * @module lib/hooks/use-grouping-operations
 */

'use client';

import { useMemo, useRef } from 'react';
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
  IGroupingOperations,
  GroupingOperationError,
  GroupingErrorCode,
} from '@/domain/categories';

// ============================================================================
// ERROR TRANSLATION LAYER
// ============================================================================

/**
 * Creates a GroupingOperationError with the given code and message.
 *
 * Uses Object.assign to add the code property to an Error instance,
 * ensuring instanceof Error checks still work.
 */
function createGroupingError(
  code: GroupingErrorCode,
  message: string,
  childCount?: number
): GroupingOperationError {
  const error = new Error(message) as GroupingOperationError;
  return Object.assign(error, { code, childCount });
}

/**
 * Maps feature-level errors to Sacred Domain error codes.
 *
 * This translation layer keeps error handling in the orchestrator,
 * allowing consumers to handle errors using only Sacred Domain types.
 */
function mapToGroupingError(error: unknown): GroupingOperationError {
  // Version conflict (optimistic concurrency control)
  if (isCategoryVersionConflictError(error)) {
    return createGroupingError('VERSION_CONFLICT', error.message);
  }

  // Duplicate name within same parent
  if (isCategoryDuplicateNameError(error)) {
    return createGroupingError('DUPLICATE_NAME', error.message);
  }

  // Parent has children (cannot delete)
  if (isCategoryHasChildrenError(error)) {
    return createGroupingError('HAS_CHILDREN', error.message, error.childCount);
  }

  // Category has transactions (cannot delete)
  if (isCategoryHasTransactionsError(error)) {
    return createGroupingError('HAS_TRANSACTIONS', error.message);
  }

  // Hierarchy constraint violation
  if (isCategoryHierarchyError(error)) {
    return createGroupingError('INVALID_HIERARCHY', error.message);
  }

  // Category not found
  if (isCategoryNotFoundError(error)) {
    return createGroupingError('NOT_FOUND', error.message);
  }

  // Unknown error - preserve message
  const message = error instanceof Error ? error.message : String(error);
  return createGroupingError('NOT_FOUND', message);
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
    throw mapToGroupingError(error);
  }
}

// ============================================================================
// ORCHESTRATOR HOOK
// ============================================================================

/**
 * Hook that provides IGroupingOperations interface.
 *
 * Creates an adapter around the CategoryService that implements IGroupingOperations.
 * This allows features to use grouping functionality without directly importing
 * from the categories feature.
 *
 * CTO MANDATE: Orchestrator Rule
 * Returns null until local database is ready.
 *
 * @returns IGroupingOperations implementation or null if not ready
 *
 * @example
 * ```typescript
 * function GroupingList() {
 *   const operations = useGroupingOperations();
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
 *       if (isGroupingOperationError(err)) {
 *         switch (err.code) {
 *           case 'DUPLICATE_NAME':
 *             toast.error('Grouping already exists');
 *             break;
 *           // ... handle other codes
 *         }
 *       }
 *     }
 *   };
 * }
 * ```
 */
export function useGroupingOperations(): IGroupingOperations | null {
  const service = useCategoryService();

  // useRef for stable object identity across re-renders
  // This prevents cascading re-renders in consuming components
  const operationsRef = useRef<IGroupingOperations | null>(null);
  const serviceRef = useRef(service);

  return useMemo(() => {
    // CTO MANDATE: Orchestrator Rule
    // Don't create operations until service is ready
    if (!service) {
      operationsRef.current = null;
      return null;
    }

    // Only create new operations object if service reference changed
    // This ensures stable object identity for memoization
    if (serviceRef.current !== service || !operationsRef.current) {
      serviceRef.current = service;

      operationsRef.current = {
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
    }

    return operationsRef.current;
  }, [service]);
}
