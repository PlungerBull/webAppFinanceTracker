/**
 * Category Service Interface
 *
 * Defines the business logic contract for category operations.
 * Service layer is responsible for:
 * - Authentication context extraction
 * - Pre-validation (fast-UI checks before hitting DB)
 * - Error throwing (unwraps DataResult for hook consumption)
 * - Business rule enforcement
 *
 * CTO MANDATES:
 * - Self-parenting prevention in update() - fast-UI check before DB call
 * - LeafCategoryEntity is the ONLY type accepted by TransactionService
 * - Hierarchy validation happens BEFORE database write
 *
 * @module category-service-interface
 */

import type {
  CreateCategoryDTO,
  CreateGroupingDTO,
  CreateSubcategoryDTO,
  UpdateCategoryDTO,
  UpdateGroupingDTO,
  ReassignSubcategoryDTO,
  CategoryFilters,
  CategoryEntity,
  CategoryWithCountEntity,
  LeafCategoryEntity,
  GroupingEntity,
  CategorizedCategories,
  CategoryValidationResult,
  CategoryValidationContext,
} from '../domain';

// Re-export from repository interface (Single Source of Truth)
export type { MergeCategoriesResult } from '../repository/category-repository.interface';

/**
 * Category Service Interface
 */
export interface ICategoryService {
  // ===========================================================================
  // READ OPERATIONS
  // ===========================================================================

  /**
   * Get all categories for current user.
   *
   * @param filters - Optional filters
   * @returns Array of category entities
   * @throws CategoryRepositoryError on database failure
   */
  getAll(filters?: CategoryFilters): Promise<CategoryEntity[]>;

  /**
   * Get all categories with transaction counts.
   *
   * @returns Array of categories with counts
   * @throws CategoryRepositoryError on database failure
   */
  getAllWithCounts(): Promise<CategoryWithCountEntity[]>;

  /**
   * Get a single category by ID.
   *
   * @param id - Category ID
   * @returns Category entity
   * @throws CategoryNotFoundError if not found
   */
  getById(id: string): Promise<CategoryEntity>;

  /**
   * Get all leaf categories (assignable to transactions).
   *
   * CTO MANDATE: This is the ONLY method that should be used
   * to populate transaction category selectors.
   *
   * @returns Array of leaf categories
   */
  getLeafCategories(): Promise<LeafCategoryEntity[]>;

  /**
   * Get all children under a specific parent.
   *
   * @param parentId - Parent category ID
   * @returns Array of child categories with counts
   */
  getByParentId(parentId: string): Promise<CategoryWithCountEntity[]>;

  /**
   * Get all groupings (parent categories).
   *
   * @returns Array of grouping entities
   */
  getGroupings(): Promise<GroupingEntity[]>;

  /**
   * Get hierarchical category structure.
   *
   * @returns Categorized structure grouped by type
   */
  getCategorizedCategories(): Promise<CategorizedCategories>;

  /**
   * Get count of child categories under a parent.
   *
   * S-TIER: Exposed for orchestrator to call before pure validation.
   *
   * @param parentId - Parent category ID
   * @returns Number of child categories
   */
  getChildCount(parentId: string): Promise<number>;

  // ===========================================================================
  // PURE VALIDATION METHODS (S-Tier Architecture)
  // ===========================================================================
  // These methods are SYNCHRONOUS and receive all data as arguments.
  // The orchestrator fetches data, passes to these pure logic methods.
  // This enables:
  // - Unit testing without DB mocks (<1ms)
  // - iOS Swift port without TransactionModule coupling
  // - Bridge performance optimization (no async in logic layer)

  /**
   * Validate if a category can be deleted.
   *
   * PURE LOGIC: Synchronous, no DB calls.
   * Called by orchestrator with pre-fetched data.
   *
   * Rules:
   * - Cannot delete parent with children (HAS_CHILDREN)
   * - Cannot delete category with transactions (HAS_TRANSACTIONS)
   *
   * Swift Mirror:
   * ```swift
   * func validateDeletion(
   *     category: CategoryEntity,
   *     context: CategoryValidationContext
   * ) -> CategoryValidationResult
   * ```
   *
   * @param category - Category to validate
   * @param context - Validation context with counts
   * @returns Validation result (isValid, code, metadata)
   */
  validateDeletion(
    category: CategoryEntity,
    context: CategoryValidationContext
  ): CategoryValidationResult;

  /**
   * Validate hierarchy change before update.
   *
   * PURE LOGIC: Synchronous validation of hierarchy rules.
   * Called by orchestrator with pre-fetched data.
   *
   * Rules:
   * - Cannot set self as parent (CIRCULAR_REFERENCE)
   * - Parent must exist if provided (PARENT_NOT_FOUND)
   * - Parent cannot be a child category (HIERARCHY_DEPTH_EXCEEDED)
   * - Cannot promote subcategory with transactions to parent (PROMOTION_BLOCKED)
   *
   * Swift Mirror:
   * ```swift
   * func validateHierarchyChange(
   *     category: CategoryEntity,
   *     newParentId: String?,
   *     context: CategoryValidationContext
   * ) -> CategoryValidationResult
   * ```
   *
   * @param category - Category being updated
   * @param newParentId - New parent ID (null = promote to parent)
   * @param context - Validation context with counts and parent info
   * @returns Validation result
   */
  validateHierarchyChange(
    category: CategoryEntity,
    newParentId: string | null,
    context: CategoryValidationContext
  ): CategoryValidationResult;

  /**
   * Validate category is assignable to transactions (is a subcategory).
   *
   * PURE LOGIC: Synchronous, no DB calls.
   *
   * Rules:
   * - Category must have parentId (NOT_SUBCATEGORY)
   *
   * Swift Mirror:
   * ```swift
   * func validateIsSubcategory(category: CategoryEntity) -> CategoryValidationResult
   * ```
   *
   * @param category - Category to validate
   * @returns Validation result
   */
  validateIsSubcategory(category: CategoryEntity): CategoryValidationResult;

  // ===========================================================================
  // WRITE OPERATIONS
  // ===========================================================================

  /**
   * Create a new category.
   *
   * @param data - Category creation data
   * @returns Created category entity
   * @throws CategoryHierarchyError if parentId is invalid
   * @throws CategoryDuplicateNameError if name exists
   */
  create(data: CreateCategoryDTO): Promise<CategoryEntity>;

  /**
   * Create a new grouping (parent category).
   *
   * Convenience method that calls create() with parentId: null.
   *
   * @param data - Grouping creation data
   * @returns Created grouping as CategoryEntity
   */
  createGrouping(data: CreateGroupingDTO): Promise<CategoryEntity>;

  /**
   * Create a subcategory under a parent.
   *
   * Convenience method that:
   * 1. Validates parent exists
   * 2. Inherits color and type from parent if not specified
   * 3. Calls create() with parentId set
   *
   * @param data - Subcategory creation data
   * @returns Created category entity
   * @throws CategoryNotFoundError if parent doesn't exist
   * @throws CategoryHierarchyError if parent is already a child
   */
  createSubcategory(data: CreateSubcategoryDTO): Promise<CategoryEntity>;

  /**
   * Update an existing category.
   *
   * CTO MANDATE: Service validates BEFORE database call:
   * - Self-parenting: newParentId !== categoryId
   * - Parent-child swap: Ensures no circular reference
   *
   * @param id - Category ID
   * @param data - Update data
   * @returns Updated category entity
   * @throws CategoryNotFoundError if not found
   * @throws CategoryHierarchyError on self-parenting attempt
   */
  update(id: string, data: UpdateCategoryDTO): Promise<CategoryEntity>;

  /**
   * Update a grouping (parent category).
   *
   * NOTE: Changing color/type cascades to all children via DB trigger.
   *
   * @param id - Grouping ID
   * @param data - Update data
   * @returns Updated category entity
   */
  updateGrouping(id: string, data: UpdateGroupingDTO): Promise<CategoryEntity>;

  /**
   * Soft delete a category (Tombstone Pattern).
   *
   * CTO Mandate: Uses soft delete for distributed sync compatibility.
   *
   * @param id - Category ID
   * @param version - Expected version for optimistic concurrency control
   * @throws CategoryHasTransactionsError if has transactions
   * @throws CategoryHasChildrenError if has children
   * @throws CategoryVersionConflictError if version conflict
   */
  delete(id: string, version: number): Promise<void>;

  /**
   * Reassign a subcategory to a different parent.
   *
   * @param data - Reassignment data
   * @returns Updated category entity
   * @throws CategoryNotFoundError if category or new parent doesn't exist
   * @throws CategoryHierarchyError if new parent is invalid
   */
  reassignSubcategory(data: ReassignSubcategoryDTO): Promise<CategoryEntity>;

  /**
   * Merge multiple categories into one.
   *
   * CTO MANDATE: This is a Ledger Event that bumps transaction versions.
   * See ARCHITECTURE.md Section 8 - Category Merge Protocol.
   *
   * Used when user wants to consolidate categories (e.g., merge
   * "Coffee", "Starbucks", "Coffee Shop" into one "Coffee" category).
   *
   * Implementation (via atomic RPC):
   * 1. Reassign all transactions from source categories to target
   * 2. Bump version on all affected transactions (for offline sync)
   * 3. Delete source categories
   *
   * @param sourceCategoryIds - Categories to merge from (will be deleted)
   * @param targetCategoryId - Category to merge into (receives transactions)
   * @returns Merge result with affected transaction count
   * @throws CategoryMergeError on failure
   */
  mergeCategories(
    sourceCategoryIds: string[],
    targetCategoryId: string
  ): Promise<import('../repository/category-repository.interface').MergeCategoriesResult>;
}
