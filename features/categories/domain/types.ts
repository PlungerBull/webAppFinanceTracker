/**
 * Category Domain Types
 *
 * Data Transfer Objects (DTOs) and Result types for category operations.
 *
 * CTO MANDATES:
 * - DataResult<T> Pattern for explicit error handling
 * - DTOs are input-only (never expose internal state)
 *
 * @module category-types
 */

import type { DataResult as SharedDataResult } from '@/lib/data-patterns';
import type { CategoryError } from './errors';
import type { CategoryEntity, CategoryType } from './entities';

/**
 * Category-specific DataResult
 *
 * Uses CategoryError for the error type.
 */
export type CategoryDataResult<T> = SharedDataResult<T, CategoryError>;

/**
 * Create Category DTO
 *
 * Input for creating a new category.
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
 * Create Grouping DTO
 *
 * Input for creating a new grouping (parent category).
 * Convenience type that omits parentId since groupings are always root-level.
 */
export interface CreateGroupingDTO {
  /** Grouping name (e.g., "Food & Dining") */
  readonly name: string;

  /** Hex color code - will be inherited by children */
  readonly color: string;

  /** Grouping type - income or expense */
  readonly type: CategoryType;
}

/**
 * Create Subcategory DTO
 *
 * Input for creating a new subcategory under a parent.
 */
export interface CreateSubcategoryDTO {
  /** Subcategory name (e.g., "Groceries") */
  readonly name: string;

  /** Parent grouping ID */
  readonly parentId: string;

  /**
   * Optional color override.
   * If not provided, inherits from parent.
   */
  readonly color?: string;
}

/**
 * Update Category DTO
 *
 * Input for updating an existing category.
 *
 * Swift Mirror:
 * ```swift
 * struct UpdateCategoryDTO: Codable {
 *     let version: Int        // Required: For optimistic concurrency control
 *     let name: String?
 *     let color: String?
 *     let parentId: String?   // Can reassign to different parent
 * }
 * ```
 */
export interface UpdateCategoryDTO {
  /**
   * Version for optimistic concurrency control.
   *
   * CTO Mandate: Required to prevent concurrent modifications.
   * If version doesn't match, update returns VERSION_CONFLICT.
   */
  readonly version: number;

  /** Updated category name */
  readonly name?: string;

  /** Updated hex color code */
  readonly color?: string;

  /**
   * Updated parent ID (for reassigning to different parent).
   *
   * CTO WARNING: Changing parentId can trigger cascade updates
   * for color and type inheritance.
   */
  readonly parentId?: string | null;
}

/**
 * Update Grouping DTO
 *
 * Input for updating a grouping (parent category).
 *
 * Note: Changing color/type cascades to all children via DB trigger.
 */
export interface UpdateGroupingDTO {
  /**
   * Version for optimistic concurrency control.
   *
   * CTO Mandate: Required to prevent concurrent modifications.
   */
  readonly version: number;

  /** Updated grouping name */
  readonly name?: string;

  /** Updated hex color code (cascades to children) */
  readonly color?: string;

  /** Updated type (cascades to children) */
  readonly type?: CategoryType;
}

/**
 * Reassign Subcategory DTO
 *
 * Input for moving a subcategory to a different parent.
 */
export interface ReassignSubcategoryDTO {
  /** The category ID to move */
  readonly categoryId: string;

  /** The new parent grouping ID */
  readonly newParentId: string;
}

/**
 * Category Filters
 *
 * Query filters for fetching categories.
 */
export interface CategoryFilters {
  /** Filter by category type */
  readonly type?: CategoryType;

  /** Filter by parent ID (null = root categories only) */
  readonly parentId?: string | null;

  /** Only return leaf categories (assignable to transactions) */
  readonly leafOnly?: boolean;
}

/**
 * Batch Category Operation Result
 *
 * Result for operations that affect multiple categories
 * (e.g., cascading color updates).
 */
export interface BatchCategoryResult {
  /** Categories that were affected */
  readonly affectedCategories: CategoryEntity[];

  /** Number of categories updated */
  readonly count: number;
}
