/**
 * Category Domain Constants
 *
 * Validation rules and limits shared across web and iOS.
 *
 * Swift Mirror:
 * ```swift
 * enum CategoryValidation {
 *     static let nameMaxLength = 50
 *     static let nameMinLength = 1
 *     static let colorRegex = "^#[0-9A-Fa-f]{6}$"
 *     static let maxHierarchyDepth = 2
 * }
 * ```
 *
 * @module category-constants
 */

/**
 * Category Validation Constants
 */
export const CATEGORY_VALIDATION = {
  /** Maximum length for category name */
  NAME_MAX_LENGTH: 50,

  /** Minimum length for category name */
  NAME_MIN_LENGTH: 1,

  /** Regex for validating hex color codes */
  COLOR_REGEX: /^#[0-9A-Fa-f]{6}$/,

  /** Maximum hierarchy depth (parent -> child only) */
  MAX_HIERARCHY_DEPTH: 2,

  /** Default hex color for new categories */
  DEFAULT_COLOR: '#6b7280',

  /** Default type for new categories */
  DEFAULT_TYPE: 'expense' as const,
} as const;

/**
 * Category Error Messages
 */
export const CATEGORY_ERRORS = {
  NAME_REQUIRED: 'Category name is required',
  NAME_TOO_LONG: `Category name cannot exceed ${CATEGORY_VALIDATION.NAME_MAX_LENGTH} characters`,
  NAME_TOO_SHORT: `Category name must be at least ${CATEGORY_VALIDATION.NAME_MIN_LENGTH} character`,
  INVALID_COLOR: 'Color must be a valid hex code (e.g., #FF5733)',
  NOT_FOUND: 'Category not found',
  DELETE_FAILED: 'Failed to delete category',
  UPDATE_FAILED: 'Failed to update category',
  CREATE_FAILED: 'Failed to create category',
  HAS_TRANSACTIONS: 'Category has transactions and cannot be deleted',
  HAS_CHILDREN: 'Category has subcategories and cannot be deleted',
  SELF_PARENT: 'A category cannot be its own parent',
  MAX_DEPTH_EXCEEDED: 'Categories can only be 2 levels deep',
  PARENT_IS_CHILD: 'Cannot assign a subcategory as a parent',
  DUPLICATE_NAME: 'A category with this name already exists',
} as const;

/**
 * Category Limits
 */
export const CATEGORY_LIMITS = {
  /** Maximum categories per user (soft limit for UI performance) */
  MAX_CATEGORIES_PER_USER: 500,

  /** Maximum children per parent (soft limit) */
  MAX_CHILDREN_PER_PARENT: 50,

  /** Default page size for category lists */
  DEFAULT_PAGE_SIZE: 100,
} as const;

/**
 * Category Query Keys
 *
 * Consistent keys for React Query cache management.
 */
export const CATEGORY_QUERY_KEYS = {
  /** Base key for all category queries */
  ALL: ['categories'] as const,

  /** Key for leaf categories query */
  LEAF: ['categories', 'leaf'] as const,

  /** Key for categorized (hierarchical) view */
  CATEGORIZED: ['categories', 'categorized'] as const,

  /** Key for single category by ID */
  byId: (id: string) => ['categories', id] as const,

  /** Key for children of a parent */
  children: (parentId: string) => ['categories', 'children', parentId] as const,

  /** Key for categories by type */
  byType: (type: 'income' | 'expense') => ['categories', 'type', type] as const,
} as const;
