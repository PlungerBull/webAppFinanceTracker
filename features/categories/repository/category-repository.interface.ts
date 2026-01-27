/**
 * Category Repository Interface
 *
 * Defines the contract for category data access operations.
 * Repository layer is responsible for:
 * - Supabase queries
 * - Data transformation (snake_case <-> camelCase)
 * - DataResult wrapping (never throws)
 * - SQLSTATE error mapping
 *
 * CTO MANDATES:
 * - Self-parenting prevention: Service layer validates before calling create/update
 * - Hierarchy enforcement: Repository maps DB trigger errors to CategoryHierarchyError
 * - Leaf-only transactions: Use getLeafCategories() for transaction assignment
 *
 * SQLSTATE Mapping (repository responsibility):
 * - 23503 -> CategoryHasTransactionsError or CategoryHasChildrenError
 * - 23505 -> CategoryDuplicateNameError
 * - P0001 -> CategoryHierarchyError
 *
 * ARCHITECTURAL GUARDRAIL - userId Parameter:
 * All methods MUST accept userId even if the current implementation uses RLS.
 * Reason: RLS is an implementation detail of SupabaseCategoryRepository.
 * Future implementations (admin dashboards, migration scripts, testing) may
 * bypass RLS and require explicit user scoping. Do NOT remove userId from
 * this interface - it is the contract, not the implementation.
 *
 * Swift Mirror:
 * ```swift
 * protocol CategoryRepositoryProtocol {
 *     func getAll(userId: String) async -> DataResult<[CategoryEntity]>
 *     func getById(userId: String, id: String) async -> DataResult<CategoryEntity>
 *     func getLeafCategories(userId: String) async -> DataResult<[LeafCategoryEntity]>
 *     func getByParentId(userId: String, parentId: String) async -> DataResult<[CategoryEntity]>
 *     func create(userId: String, data: CreateCategoryDTO) async -> DataResult<CategoryEntity>
 *     func update(userId: String, id: String, data: UpdateCategoryDTO) async -> DataResult<CategoryEntity>
 *     func delete(userId: String, id: String) async -> DataResult<Void>
 * }
 * ```
 *
 * @module category-repository-interface
 */

import type {
  CategoryDataResult,
  CreateCategoryDTO,
  UpdateCategoryDTO,
  CategoryFilters,
  CategoryEntity,
  CategoryWithCountEntity,
  LeafCategoryEntity,
  GroupingEntity,
  CategorizedCategories,
} from '../domain';

/**
 * Category Repository Interface
 */
export interface ICategoryRepository {
  // ==========================================================================
  // READ OPERATIONS
  // ==========================================================================

  /**
   * Get all categories for a user.
   *
   * @param userId - User ID
   * @param filters - Optional filters
   * @returns DataResult with array of categories
   */
  getAll(
    userId: string,
    filters?: CategoryFilters
  ): Promise<CategoryDataResult<CategoryEntity[]>>;

  /**
   * Get all categories with transaction counts.
   *
   * Uses categories_with_counts view for efficient count retrieval.
   *
   * @param userId - User ID
   * @returns DataResult with array of categories including counts
   */
  getAllWithCounts(
    userId: string
  ): Promise<CategoryDataResult<CategoryWithCountEntity[]>>;

  /**
   * Get a single category by ID.
   *
   * @param userId - User ID (for RLS verification)
   * @param id - Category ID
   * @returns DataResult with category entity
   */
  getById(
    userId: string,
    id: string
  ): Promise<CategoryDataResult<CategoryEntity>>;

  /**
   * Get all leaf categories (assignable to transactions).
   *
   * Returns:
   * - All child categories (parentId IS NOT NULL)
   * - Orphaned parent categories (parents with no children)
   *
   * Sorted by: type (income first), then name alphabetically.
   *
   * @param userId - User ID
   * @returns DataResult with array of leaf categories
   */
  getLeafCategories(
    userId: string
  ): Promise<CategoryDataResult<LeafCategoryEntity[]>>;

  /**
   * Get all categories under a specific parent.
   *
   * @param userId - User ID
   * @param parentId - Parent category ID
   * @returns DataResult with array of child categories
   */
  getByParentId(
    userId: string,
    parentId: string
  ): Promise<CategoryDataResult<CategoryWithCountEntity[]>>;

  /**
   * Get all parent categories (groupings).
   *
   * @param userId - User ID
   * @returns DataResult with array of grouping entities
   */
  getGroupings(userId: string): Promise<CategoryDataResult<GroupingEntity[]>>;

  /**
   * Get hierarchical category structure grouped by type.
   *
   * Returns categories organized as:
   * - income: [{ parent, children }, ...]
   * - expense: [{ parent, children }, ...]
   *
   * @param userId - User ID
   * @returns DataResult with categorized structure
   */
  getCategorizedCategories(
    userId: string
  ): Promise<CategoryDataResult<CategorizedCategories>>;

  // ==========================================================================
  // WRITE OPERATIONS
  // ==========================================================================

  /**
   * Create a new category.
   *
   * HIERARCHY RULES (enforced by DB trigger):
   * - parentId = null → creates parent category (grouping)
   * - parentId = UUID → creates child under that parent
   * - Cannot create child under another child (max 2 levels)
   *
   * @param userId - User ID
   * @param data - Category creation data
   * @returns DataResult with created category entity
   *
   * @throws CategoryHierarchyError - If hierarchy rules are violated (via SQLSTATE P0001)
   * @throws CategoryDuplicateNameError - If name already exists (via SQLSTATE 23505)
   */
  create(
    userId: string,
    data: CreateCategoryDTO
  ): Promise<CategoryDataResult<CategoryEntity>>;

  /**
   * Update an existing category.
   *
   * COLOR/TYPE CASCADE:
   * When updating a parent's color or type, the DB trigger automatically
   * updates all children. This is transparent to the repository.
   *
   * REASSIGNMENT:
   * When changing parentId:
   * - Moving to null → promotes to parent (only if no transactions)
   * - Moving to another parent → reassigns (inherits new parent's type)
   *
   * @param userId - User ID (for RLS verification)
   * @param id - Category ID
   * @param data - Update data
   * @returns DataResult with updated category entity
   *
   * @throws CategoryNotFoundError - If category doesn't exist
   * @throws CategoryHierarchyError - If reassignment violates hierarchy
   */
  update(
    userId: string,
    id: string,
    data: UpdateCategoryDTO
  ): Promise<CategoryDataResult<CategoryEntity>>;

  /**
   * Soft delete a category (Tombstone Pattern).
   *
   * CTO Mandate: Uses soft delete for distributed sync compatibility.
   * Sets deleted_at timestamp instead of hard-deleting.
   *
   * CONSTRAINTS (checked by RPC):
   * - Cannot delete if has transactions (FK constraint on transactions.category_id)
   * - Cannot delete if has children (FK constraint on categories.parent_id)
   *
   * @param userId - User ID (for RLS verification)
   * @param id - Category ID
   * @param version - Expected version for optimistic concurrency control
   * @returns DataResult with void on success, or VERSION_CONFLICT if version mismatch
   *
   * @throws CategoryHasTransactionsError - If category has transactions
   * @throws CategoryHasChildrenError - If category has child categories
   * @throws CategoryVersionConflictError - If version doesn't match
   */
  delete(userId: string, id: string, version: number): Promise<CategoryDataResult<void>>;

  // ==========================================================================
  // BULK OPERATIONS
  // ==========================================================================

  /**
   * Reassign multiple categories to a new parent.
   *
   * Used for batch reorganization of categories.
   *
   * @param userId - User ID
   * @param categoryIds - Array of category IDs to move
   * @param newParentId - New parent ID (null = promote to root)
   * @returns DataResult with number of affected categories
   */
  reassignCategories(
    userId: string,
    categoryIds: string[],
    newParentId: string | null
  ): Promise<CategoryDataResult<number>>;

  /**
   * Merge multiple source categories into a target category.
   *
   * CTO MANDATE: This is a Ledger Event that MUST bump transaction versions.
   * See ARCHITECTURE.md Section 8 - Category Merge Protocol.
   *
   * ATOMIC OPERATION:
   * 1. Reassigns all transactions from source categories to target
   * 2. Bumps version on all affected transactions (for offline sync)
   * 3. Deletes the source categories
   *
   * @param userId - User ID (for authorization check)
   * @param sourceIds - Array of category IDs to merge FROM (will be deleted)
   * @param targetId - Category ID to merge INTO (will receive transactions)
   * @returns DataResult with merge result (affected transaction count)
   *
   * @throws CategoryMergeError - If merge fails (target not found, unauthorized, etc.)
   */
  mergeCategories(
    userId: string,
    sourceIds: string[],
    targetId: string
  ): Promise<CategoryDataResult<MergeCategoriesResult>>;
}

/**
 * Result of a category merge operation
 */
export interface MergeCategoriesResult {
  /** Number of transactions reassigned to target category */
  readonly affectedTransactionCount: number;

  /** Number of source categories deleted */
  readonly mergedCategoryCount: number;

  /** ID of the target category that received the transactions */
  readonly targetCategoryId: string;
}
