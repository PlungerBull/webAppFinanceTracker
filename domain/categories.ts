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
