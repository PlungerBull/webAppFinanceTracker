/**
 * Category Domain Entities
 *
 * Re-exports shared types from @/domain/categories for backward compatibility.
 * Feature-specific types (GroupingEntity, CategorizedCategories, etc.) remain here.
 *
 * New code should import shared types directly from @/domain/categories.
 *
 * @module category-entities
 */

import type { CategoryType, CategoryEntity } from '@/domain/categories';

// Re-export shared types from the Sacred Domain
export {
  type CategoryType,
  type CategoryEntity,
  type LeafCategoryEntity,
  isGrouping,
  isSubcategory,
  isLeafCategory,
} from '@/domain/categories';

// ============================================================================
// FEATURE-SPECIFIC TYPES (remain in feature)
// ============================================================================

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

// ============================================================================
// TYPE GUARDS (feature-specific)
// ============================================================================

/**
 * Type guard to check if entity has transaction count
 */
export function hasCategoryCount(
  entity: CategoryEntity | CategoryWithCountEntity
): entity is CategoryWithCountEntity {
  return 'transactionCount' in entity;
}
