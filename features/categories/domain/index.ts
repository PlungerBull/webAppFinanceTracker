/**
 * Category Domain Exports
 *
 * Central export point for category domain layer.
 *
 * @module category-domain
 */

// Entities
export type {
  CategoryEntity,
  CategoryWithCountEntity,
  GroupingEntity,
  CategorizedCategories,
  CategoryGroup,
  LeafCategoryEntity,
  CategoryType,
} from './entities';
export {
  isGrouping,
  isSubcategory,
  hasCategoryCount,
  isLeafCategory,
} from './entities';

// Types (DTOs & Results)
export type {
  CategoryDataResult,
  CreateCategoryDTO,
  CreateGroupingDTO,
  CreateSubcategoryDTO,
  UpdateCategoryDTO,
  UpdateGroupingDTO,
  ReassignSubcategoryDTO,
  CategoryFilters,
  BatchCategoryResult,
} from './types';

// Errors
export {
  CategoryError,
  CategoryNotFoundError,
  CategoryHierarchyError,
  CategoryHasTransactionsError,
  CategoryHasChildrenError,
  CategoryValidationError,
  CategoryRepositoryError,
  CategoryDuplicateNameError,
  isCategoryNotFoundError,
  isCategoryHierarchyError,
  isCategoryHasTransactionsError,
  isCategoryHasChildrenError,
  isCategoryValidationError,
  isCategoryDuplicateNameError,
} from './errors';
export type { HierarchyViolationReason } from './errors';

// Constants
export {
  CATEGORY_VALIDATION,
  CATEGORY_ERRORS,
  CATEGORY_LIMITS,
  CATEGORY_QUERY_KEYS,
} from './constants';
