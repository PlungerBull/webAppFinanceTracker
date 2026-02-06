/**
 * Category Domain Entities
 *
 * Shared category types for cross-feature use.
 * This is the "Sacred Domain" - any feature can import from here.
 *
 * CTO MANDATES:
 * - Categories and Groupings share the same DB table (categories)
 * - Groupings = parent categories (parentId IS NULL)
 * - Categories = child categories (parentId IS NOT NULL) or orphaned parents
 * - Only "leaf" categories can be assigned to transactions
 * - 2-level maximum hierarchy (enforced by DB trigger)
 *
 * @module domain/categories
 */

/**
 * Category Type Enum
 *
 * Note: DB enum has 5 values but UI only uses income/expense for categories.
 * 'transfer', 'opening_balance', 'adjustment' are system-generated.
 */
export type CategoryType = 'income' | 'expense';

/**
 * Category Entity (Base)
 *
 * Core category data from categories table.
 * Represents both parent categories (groupings) and child categories.
 *
 * Swift Mirror:
 * ```swift
 * struct CategoryEntity: Codable, Identifiable {
 *     let id: String
 *     let userId: String
 *     let name: String
 *     let color: String
 *     let type: CategoryType
 *     let parentId: String?
 *     let createdAt: String
 *     let updatedAt: String
 *     let version: Int           // Sync: Optimistic concurrency control
 *     let deletedAt: String?     // Sync: Tombstone for distributed sync
 * }
 * ```
 */
export interface CategoryEntity {
  /** Primary key (UUID) */
  readonly id: string;

  /** Owner user ID (foreign key) */
  readonly userId: string;

  /** Category name (e.g., "Food & Dining", "Groceries") */
  readonly name: string;

  /** Hex color code for visual identification (e.g., "#ef4444") */
  readonly color: string;

  /** Category type - income or expense */
  readonly type: CategoryType;

  /**
   * Parent category ID
   *
   * HIERARCHY RULES:
   * - NULL = parent category (grouping)
   * - NOT NULL = child category (subcategory)
   * - Self-parenting is prevented by DB trigger
   * - Max 2 levels (no grandchildren)
   */
  readonly parentId: string | null;

  /** Creation timestamp (ISO 8601) */
  readonly createdAt: string;

  /** Last update timestamp (ISO 8601) */
  readonly updatedAt: string;

  /**
   * Version counter for optimistic concurrency control.
   * Uses global_transaction_version sequence for unified sync pulse.
   */
  readonly version: number;

  /**
   * Tombstone timestamp (ISO 8601).
   * - NULL = active category
   * - Timestamp = soft-deleted (for distributed sync)
   */
  readonly deletedAt: string | null;
}

/**
 * Leaf Category Entity
 *
 * A category that can be assigned to transactions.
 * This includes:
 * - All child categories (parentId IS NOT NULL)
 * - Orphaned parent categories (parentId IS NULL but have no children)
 *
 * Swift Mirror:
 * ```swift
 * struct LeafCategoryEntity: Codable, Identifiable {
 *     // ... all CategoryEntity fields
 *     let isOrphanedParent: Bool
 * }
 * ```
 */
export interface LeafCategoryEntity extends CategoryEntity {
  /**
   * Whether this is an orphaned parent (parent with no children).
   * Orphaned parents can be assigned to transactions directly.
   */
  readonly isOrphanedParent: boolean;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if category is a parent (grouping)
 */
export function isGrouping(category: CategoryEntity): boolean {
  return category.parentId === null;
}

/**
 * Type guard to check if category is a child (subcategory)
 */
export function isSubcategory(category: CategoryEntity): boolean {
  return category.parentId !== null;
}

/**
 * Type guard to check if entity is a leaf category
 */
export function isLeafCategory(
  entity: CategoryEntity | LeafCategoryEntity
): entity is LeafCategoryEntity {
  return 'isOrphanedParent' in entity;
}

// ============================================================================
// GROUPING ENTITIES (readonly for immutability)
// ============================================================================

/**
 * Grouping Entity
 *
 * A parent category (where parentId IS NULL).
 * Used as an organizational container for subcategories.
 *
 * NOTE: This is NOT extending CategoryEntity because groupings
 * are always parents (no parentId) and have aggregate counts.
 *
 * IMPORTANT: Transactions can ONLY be assigned to:
 * - Child categories (parentId IS NOT NULL)
 * - Orphaned parents (parents with no children)
 *
 * Swift Mirror:
 * ```swift
 * struct GroupingEntity: Codable, Identifiable {
 *     let id: String
 *     let userId: String
 *     let name: String
 *     let color: String
 *     let type: CategoryType
 *     let createdAt: String
 *     let updatedAt: String
 *     let version: Int           // Sync: Optimistic concurrency control
 *     let deletedAt: String?     // Sync: Tombstone for distributed sync
 *     let childCount: Int
 *     let totalTransactionCount: Int
 * }
 * ```
 */
export interface GroupingEntity {
  /** Primary key (UUID) */
  readonly id: string;

  /** Owner user ID (foreign key) */
  readonly userId: string;

  /** Grouping name (e.g., "Food & Dining", "Transportation") */
  readonly name: string;

  /** Hex color code - inherited by children */
  readonly color: string;

  /** Grouping type - inherited by children */
  readonly type: CategoryType;

  /** Creation timestamp (ISO 8601) */
  readonly createdAt: string;

  /** Last update timestamp (ISO 8601) */
  readonly updatedAt: string;

  /**
   * Version counter for optimistic concurrency control.
   * Uses global_transaction_version sequence for unified sync pulse.
   */
  readonly version: number;

  /**
   * Tombstone timestamp (ISO 8601).
   * - NULL = active grouping
   * - Timestamp = soft-deleted (for distributed sync)
   */
  readonly deletedAt: string | null;

  /** Number of child categories under this grouping */
  readonly childCount: number;

  /** Total transactions across all children */
  readonly totalTransactionCount: number;
}

/**
 * Category With Count Entity
 *
 * Extends CategoryEntity with transaction count.
 * Used for UI rendering where usage statistics are needed.
 *
 * Swift Mirror:
 * ```swift
 * struct CategoryWithCountEntity: Codable, Identifiable {
 *     // ... all CategoryEntity fields
 *     let transactionCount: Int
 * }
 * ```
 */
export interface CategoryWithCountEntity extends CategoryEntity {
  /** Number of transactions using this category */
  readonly transactionCount: number;
}

// ============================================================================
// DTOs (readonly for immutability)
// ============================================================================

/**
 * Create Grouping DTO
 *
 * Data required to create a new grouping (parent category).
 */
export interface CreateGroupingDTO {
  readonly name: string;
  readonly color: string;
  readonly type: CategoryType;
}

/**
 * Update Grouping DTO
 *
 * Data for updating an existing grouping.
 * Version is required for optimistic concurrency control.
 */
export interface UpdateGroupingDTO {
  readonly version: number;
  readonly name?: string;
  readonly color?: string;
  readonly type?: CategoryType;
}

/**
 * Create Subcategory DTO
 *
 * Data required to create a new subcategory under a parent.
 */
export interface CreateSubcategoryDTO {
  readonly name: string;
  readonly parentId: string;
  readonly color?: string;
}

/**
 * Reassign Subcategory DTO
 *
 * Data for moving a subcategory to a different parent.
 */
export interface ReassignSubcategoryDTO {
  readonly categoryId: string;
  readonly newParentId: string;
}

// ============================================================================
// ERROR CODES (Sacred Domain - no feature imports needed)
// ============================================================================

/**
 * Category Error Codes
 *
 * Standardized error codes for ICategoryOperations.
 * Consumers can handle errors without importing from @/features/categories.
 *
 * Swift Mirror:
 * ```swift
 * enum CategoryErrorCode: String, Codable {
 *     case versionConflict = "VERSION_CONFLICT"
 *     case duplicateName = "DUPLICATE_NAME"
 *     case hasChildren = "HAS_CHILDREN"
 *     case hasTransactions = "HAS_TRANSACTIONS"
 *     case invalidHierarchy = "INVALID_HIERARCHY"
 *     case notFound = "NOT_FOUND"
 *     case serviceNotReady = "SERVICE_NOT_READY"
 * }
 * ```
 */
export type CategoryErrorCode =
  | 'VERSION_CONFLICT'
  | 'DUPLICATE_NAME'
  | 'HAS_CHILDREN'
  | 'HAS_TRANSACTIONS'
  | 'INVALID_HIERARCHY'
  | 'NOT_FOUND'
  | 'SERVICE_NOT_READY';

/**
 * Category Operation Error
 *
 * Typed error for category operations with standardized error codes.
 *
 * Swift Mirror:
 * ```swift
 * struct CategoryOperationError: Error {
 *     let code: CategoryErrorCode
 *     let message: String
 *     let childCount: Int?
 * }
 * ```
 */
export interface CategoryOperationError extends Error {
  readonly code: CategoryErrorCode;
  /** For HAS_CHILDREN errors - number of children blocking deletion */
  readonly childCount?: number;
}

/**
 * Type guard for CategoryOperationError
 */
export function isCategoryOperationError(
  error: unknown
): error is CategoryOperationError {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as CategoryOperationError).code === 'string'
  );

}



// ============================================================================
// IOC INTERFACE
// ============================================================================

/**
 * ICategoryOperations - Inversion of Control Interface
 *
 * Features depend on this interface, not concrete CategoryService.
 * Errors are thrown as CategoryOperationError with typed codes.
 *
 * CTO MANDATE: Orchestrator Rule
 * - Hook returning this interface may return null until ready
 * - Consumers must guard with enabled: !!operations
 *
 * Swift Mirror:
 * ```swift
 * protocol CategoryOperationsProtocol {
 *     func getGroupings() async throws -> [GroupingEntity]
 *     func getByParentId(_ parentId: String) async throws -> [CategoryWithCountEntity]
 *     func createGrouping(_ data: CreateGroupingDTO) async throws -> CategoryEntity
 *     func updateGrouping(id: String, data: UpdateGroupingDTO) async throws -> CategoryEntity
 *     func createSubcategory(_ data: CreateSubcategoryDTO) async throws -> CategoryEntity
 *     func reassignSubcategory(_ data: ReassignSubcategoryDTO) async throws -> CategoryEntity
 *     func delete(id: String, version: Int) async throws
 * }
 * ```
 */
/**
 * Category Deletion Validation Result
 *
 * S-TIER: Return type for canDelete validation.
 * Used by delete-category-dialog to check constraints before deletion.
 *
 * Swift Mirror:
 * ```swift
 * struct CategoryDeletionValidation {
 *     let canDelete: Bool
 *     let error: String?
 *     let childCount: Int?
 *     let transactionCount: Int?
 * }
 * ```
 */
export interface CategoryDeletionValidation {
  readonly canDelete: boolean;
  readonly error?: string;
  readonly childCount?: number;
  readonly transactionCount?: number;
}

export interface ICategoryOperations {
  /** Get all groupings (parent categories) with child counts */
  getGroupings(): Promise<GroupingEntity[]>;

  /** Get children of a specific parent with transaction counts */
  getByParentId(parentId: string): Promise<CategoryWithCountEntity[]>;

  /** Create a new grouping (parent category) */
  createGrouping(data: CreateGroupingDTO): Promise<CategoryEntity>;

  /** Update an existing grouping */
  updateGrouping(id: string, data: UpdateGroupingDTO): Promise<CategoryEntity>;

  /** Create a subcategory under a parent */
  createSubcategory(data: CreateSubcategoryDTO): Promise<CategoryEntity>;

  /** Move a subcategory to a different parent */
  reassignSubcategory(data: ReassignSubcategoryDTO): Promise<CategoryEntity>;

  /** Delete a category (soft delete for sync) */
  delete(id: string, version: number): Promise<void>;

  /**
   * Check if a category can be deleted.
   *
   * S-TIER: Orchestrator fetches data in parallel, validates with pure logic.
   * Returns validation result without throwing.
   *
   * Swift Mirror:
   * ```swift
   * func canDelete(categoryId: String) async -> CategoryDeletionValidation
   * ```
   */
  canDelete(categoryId: string): Promise<CategoryDeletionValidation>;
}


// ============================================================================
// OPTIMISTIC UPDATE FACTORIES (S-Tier Zero-Latency UX)
// ============================================================================

/**
 * Create Category DTO
 *
 * Input for creating a new category.
 * Defined in Sacred Domain for factory usage without circular imports.
 *
 * Swift Mirror:
 * ```swift
 * struct CreateCategoryDTO: Codable {
 *     let id: String?         // Optional: Client-generated UUID for offline-first
 *     let name: String
 *     let color: String
 *     let type: CategoryType
 *     let parentId: String?   // nil = create as grouping
 * }
 * ```
 */
export interface CreateCategoryDTO {
  /**
   * Optional client-generated UUID.
   *
   * CTO Mandate: For offline-first, clients must generate UUIDs.
   * If provided, this ID is used; otherwise, server generates one.
   */
  readonly id?: string;

  /** Category name (e.g., "Groceries") */
  readonly name: string;

  /** Hex color code (e.g., "#ef4444") */
  readonly color: string;

  /** Category type - income or expense */
  readonly type: CategoryType;

  /**
   * Parent category ID
   *
   * - null = create as parent category (grouping)
   * - string = create as child under this parent
   */
  readonly parentId: string | null;
}

/**
 * Create Optimistic Category Entity
 *
 * S-Tier Factory for generating optimistic CategoryEntity from CreateCategoryDTO.
 * Ensures consistent entity shape across Web and future iOS port.
 *
 * SYNC STATE MACHINE (version field):
 * - version: 0 = Optimistic/Pending (local-only, no server authority)
 * - version: 1+ = Confirmed (server-assigned, authoritative)
 *
 * This allows the iOS WatermelonDB sync engine to identify "Orphaned" records
 * after a hard-close and either retry the push or discard the ghost.
 *
 * @param data - CreateCategoryDTO input
 * @param userId - Authenticated user ID (from useAuthStore)
 * @returns CategoryEntity with client-generated fields (version: 0)
 *
 * Swift Mirror:
 * ```swift
 * static func createOptimisticCategory(
 *     data: CreateCategoryDTO,
 *     userId: String
 * ) -> CategoryEntity
 * ```
 */
export function createOptimisticCategory(
  data: CreateCategoryDTO,
  userId: string
): CategoryEntity {
  const now = new Date().toISOString();
  return {
    id: data.id ?? crypto.randomUUID(),
    userId,
    name: data.name,
    color: data.color,
    type: data.type,
    parentId: data.parentId,
    createdAt: now,
    updatedAt: now,
    version: 0, // S-Tier: Optimistic state - no server authority yet
    deletedAt: null,
  };
}
