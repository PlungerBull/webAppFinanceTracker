/**
 * Category Domain Entities
 *
 * Core entity types for the categories feature.
 *
 * CTO MANDATES:
 * - Categories and Groupings share the same DB table (categories)
 * - Groupings = parent categories (parentId IS NULL)
 * - Categories = child categories (parentId IS NOT NULL) or orphaned parents
 * - Only "leaf" categories can be assigned to transactions
 * - 2-level maximum hierarchy (enforced by DB trigger)
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
 * }
 * ```
 *
 * @module category-entities
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
}

/**
 * Category With Count Entity (Enriched)
 *
 * Extends CategoryEntity with transaction count.
 * Used for UI rendering where usage statistics are needed.
 */
export interface CategoryWithCountEntity extends CategoryEntity {
  /** Number of transactions using this category */
  readonly transactionCount: number;
}

/**
 * Grouping Entity
 *
 * A parent category (where parentId IS NULL).
 * Used as an organizational container for subcategories.
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

  /** Number of child categories under this grouping */
  readonly childCount: number;

  /** Total transactions across all children */
  readonly totalTransactionCount: number;
}

/**
 * Categorized Categories Structure
 *
 * Hierarchical view grouped by type (income/expense).
 * Used for category management UIs.
 */
export interface CategorizedCategories {
  /** Income groupings with their children */
  readonly income: CategoryGroup[];

  /** Expense groupings with their children */
  readonly expense: CategoryGroup[];
}

/**
 * Category Group
 *
 * A parent category with its children.
 */
export interface CategoryGroup {
  /** Parent category (grouping) */
  readonly parent: CategoryWithCountEntity;

  /** Child categories under this parent */
  readonly children: CategoryWithCountEntity[];
}

/**
 * Leaf Category Entity
 *
 * A category that can be assigned to transactions.
 * This includes:
 * - All child categories (parentId IS NOT NULL)
 * - Orphaned parent categories (parentId IS NULL but have no children)
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
 * Type guard to check if entity has transaction count
 */
export function hasCategoryCount(
  entity: CategoryEntity | CategoryWithCountEntity
): entity is CategoryWithCountEntity {
  return 'transactionCount' in entity;
}

/**
 * Type guard to check if entity is a leaf category
 */
export function isLeafCategory(
  entity: CategoryEntity | LeafCategoryEntity
): entity is LeafCategoryEntity {
  return 'isOrphanedParent' in entity;
}
