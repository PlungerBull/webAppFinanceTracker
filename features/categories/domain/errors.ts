/**
 * Category Domain Errors
 *
 * Error classes for category operations.
 * Each error has a unique code for cross-platform error handling.
 *
 * CTO MANDATES:
 * - Use instanceof for error handling (NOT string matching)
 * - SQLSTATE codes map to typed errors in repository
 * - Service layer throws errors directly (preserves type)
 *
 * SQLSTATE Mapping:
 * - 23503 (foreign_key_violation) -> CategoryHasTransactionsError
 * - 23505 (unique_violation) -> CategoryDuplicateNameError
 * - P0001 (raise_exception) -> CategoryHierarchyError (DB trigger)
 *
 * Swift Mirror:
 * ```swift
 * enum CategoryError: Error, Codable {
 *     case notFound(categoryId: String)
 *     case validationError(message: String, field: String?)
 *     case repositoryError(message: String)
 *     case duplicateName(name: String, parentId: String?)
 *     case hierarchyViolation(reason: HierarchyViolationReason)
 *     case hasTransactions(categoryId: String, transactionCount: Int)
 *     case hasChildren(categoryId: String, childCount: Int)
 * }
 * ```
 *
 * @module category-errors
 */

import { DomainError } from '@/lib/errors';

/**
 * Base Category Error
 *
 * All category errors extend this class.
 */
export class CategoryError extends DomainError {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
  }
}

/**
 * Hierarchy Violation Reasons
 *
 * Maps DB trigger errors to human-readable reasons:
 * - 'self_parent' -> Category cannot be its own parent
 * - 'max_depth' -> Cannot exceed 2-level hierarchy
 * - 'parent_is_child' -> Parent is already a child category
 */
export type HierarchyViolationReason =
  | 'self_parent'
  | 'max_depth'
  | 'parent_is_child';

/**
 * Category Hierarchy Error
 *
 * Thrown when a hierarchy constraint is violated.
 * Maps to PostgreSQL SQLSTATE P0001 (raise_exception from trigger).
 *
 * Usage:
 * ```typescript
 * if (err instanceof CategoryHierarchyError) {
 *   const messages: Record<HierarchyViolationReason, string> = {
 *     self_parent: 'A category cannot be its own parent.',
 *     max_depth: 'Categories can only be 2 levels deep.',
 *     parent_is_child: 'Cannot make a subcategory the parent.',
 *   };
 *   toast.error('Invalid hierarchy', { description: messages[err.reason] });
 * }
 * ```
 */
export class CategoryHierarchyError extends CategoryError {
  constructor(public readonly reason: HierarchyViolationReason) {
    const reasonMessages: Record<HierarchyViolationReason, string> = {
      self_parent: 'A category cannot be its own parent',
      max_depth: 'Categories can only be 2 levels deep (parent → child)',
      parent_is_child: 'Cannot assign a child category as parent',
    };
    super(reasonMessages[reason], 'HIERARCHY_VIOLATION');
  }
}

/**
 * Category Not Found Error
 *
 * Thrown when a category cannot be found by ID.
 */
export class CategoryNotFoundError extends CategoryError {
  constructor(public readonly categoryId: string) {
    super(`Category not found: ${categoryId}`, 'CATEGORY_NOT_FOUND');
  }
}

/**
 * Category Has Transactions Error
 *
 * Thrown when attempting to delete a category that has transactions.
 * Maps to PostgreSQL SQLSTATE 23503 (foreign_key_violation).
 */
export class CategoryHasTransactionsError extends CategoryError {
  constructor(
    public readonly categoryId: string,
    public readonly transactionCount: number = 0
  ) {
    super(
      `Category cannot be deleted: ${transactionCount > 0 ? `has ${transactionCount} transactions` : 'has transactions'}`,
      'CATEGORY_HAS_TRANSACTIONS'
    );
  }
}

/**
 * Category Has Children Error
 *
 * Thrown when attempting to delete a parent category that has children.
 * Maps to PostgreSQL SQLSTATE 23503 (foreign_key_violation on self-reference).
 */
export class CategoryHasChildrenError extends CategoryError {
  constructor(
    public readonly categoryId: string,
    public readonly childCount: number = 0
  ) {
    super(
      `Category cannot be deleted: ${childCount > 0 ? `has ${childCount} child categories` : 'has child categories'}`,
      'CATEGORY_HAS_CHILDREN'
    );
  }
}

/**
 * Category Validation Error
 *
 * Thrown when category data fails validation.
 */
export class CategoryValidationError extends CategoryError {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message, 'VALIDATION_ERROR');
  }
}

/**
 * Category Repository Error
 *
 * Thrown when a database operation fails.
 */
export class CategoryRepositoryError extends CategoryError {
  constructor(
    message: string,
    public readonly originalError?: unknown
  ) {
    super(message, 'REPOSITORY_ERROR');
  }
}

/**
 * Category Duplicate Name Error
 *
 * Thrown when attempting to create a category with a duplicate name
 * within the same parent (or at root level).
 * Maps to PostgreSQL SQLSTATE 23505 (unique_violation).
 */
export class CategoryDuplicateNameError extends CategoryError {
  constructor(
    public readonly categoryName: string,
    public readonly parentId: string | null
  ) {
    super(
      parentId
        ? `Category "${categoryName}" already exists under this parent`
        : `Category "${categoryName}" already exists at root level`,
      'DUPLICATE_NAME'
    );
  }
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for CategoryNotFoundError
 */
export function isCategoryNotFoundError(
  error: unknown
): error is CategoryNotFoundError {
  return error instanceof CategoryNotFoundError;
}

/**
 * Type guard for CategoryHierarchyError
 */
export function isCategoryHierarchyError(
  error: unknown
): error is CategoryHierarchyError {
  return error instanceof CategoryHierarchyError;
}

/**
 * Type guard for CategoryHasTransactionsError
 */
export function isCategoryHasTransactionsError(
  error: unknown
): error is CategoryHasTransactionsError {
  return error instanceof CategoryHasTransactionsError;
}

/**
 * Type guard for CategoryHasChildrenError
 */
export function isCategoryHasChildrenError(
  error: unknown
): error is CategoryHasChildrenError {
  return error instanceof CategoryHasChildrenError;
}

/**
 * Type guard for CategoryValidationError
 */
export function isCategoryValidationError(
  error: unknown
): error is CategoryValidationError {
  return error instanceof CategoryValidationError;
}

/**
 * Type guard for CategoryDuplicateNameError
 */
export function isCategoryDuplicateNameError(
  error: unknown
): error is CategoryDuplicateNameError {
  return error instanceof CategoryDuplicateNameError;
}
