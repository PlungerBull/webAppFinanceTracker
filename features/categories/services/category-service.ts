/**
 * Category Service Implementation
 *
 * Business logic layer for category operations.
 *
 * Responsibilities:
 * - Auth context extraction (via IAuthProvider)
 * - Pre-validation (fast-UI checks before DB call)
 * - Error translation (DataResult -> throw)
 * - Hierarchy rule enforcement
 *
 * CTO MANDATES:
 * - Self-parenting check in update(): Validate BEFORE database call
 * - Circular reference prevention: Check parent chain before reassignment
 * - LeafCategoryEntity: Only type for transaction assignment
 *
 * @module category-service
 */

import type { IAuthProvider } from '@/lib/auth/auth-provider.interface';
import type { ICategoryRepository } from '../repository/category-repository.interface';
import type { ICategoryService, MergeCategoriesResult } from './category-service.interface';
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
} from '../domain';
import {
  CategoryValidationError,
  CategoryHierarchyError,
  CategoryNotFoundError,
  CATEGORY_VALIDATION,
  CATEGORY_ERRORS,
} from '../domain';

/**
 * Category Service
 *
 * Implements business logic for category operations.
 */
export class CategoryService implements ICategoryService {
  constructor(
    private readonly repository: ICategoryRepository,
    private readonly authProvider: IAuthProvider
  ) {}

  // ===========================================================================
  // PRIVATE: AUTH & VALIDATION
  // ===========================================================================

  /**
   * Get current user ID from auth provider.
   */
  private async getCurrentUserId(): Promise<string> {
    return this.authProvider.getCurrentUserId();
  }

  /**
   * Validate category name.
   */
  private validateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new CategoryValidationError(CATEGORY_ERRORS.NAME_REQUIRED, 'name');
    }
    if (name.length < CATEGORY_VALIDATION.NAME_MIN_LENGTH) {
      throw new CategoryValidationError(
        CATEGORY_ERRORS.NAME_TOO_SHORT,
        'name'
      );
    }
    if (name.length > CATEGORY_VALIDATION.NAME_MAX_LENGTH) {
      throw new CategoryValidationError(CATEGORY_ERRORS.NAME_TOO_LONG, 'name');
    }
  }

  /**
   * Validate color format.
   */
  private validateColor(color: string): void {
    if (!CATEGORY_VALIDATION.COLOR_REGEX.test(color)) {
      throw new CategoryValidationError(
        CATEGORY_ERRORS.INVALID_COLOR,
        'color'
      );
    }
  }

  /**
   * Validate hierarchy constraints for update operations.
   *
   * CTO MANDATE: Self-parenting prevention - fast-UI check before DB call.
   *
   * @param categoryId - The category being updated
   * @param newParentId - The proposed new parent ID
   * @throws CategoryHierarchyError if constraints violated
   */
  private validateHierarchyUpdate(
    categoryId: string,
    newParentId: string | null | undefined
  ): void {
    // Skip if parentId isn't being changed
    if (newParentId === undefined) return;

    // Self-parenting check: Category cannot be its own parent
    if (newParentId === categoryId) {
      throw new CategoryHierarchyError('self_parent');
    }
  }

  // ===========================================================================
  // READ OPERATIONS
  // ===========================================================================

  async getAll(filters?: CategoryFilters): Promise<CategoryEntity[]> {
    const userId = await this.getCurrentUserId();
    const result = await this.repository.getAll(userId, filters);

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }

  async getAllWithCounts(): Promise<CategoryWithCountEntity[]> {
    const userId = await this.getCurrentUserId();
    const result = await this.repository.getAllWithCounts(userId);

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }

  async getById(id: string): Promise<CategoryEntity> {
    const userId = await this.getCurrentUserId();
    const result = await this.repository.getById(userId, id);

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }

  async getLeafCategories(): Promise<LeafCategoryEntity[]> {
    const userId = await this.getCurrentUserId();
    const result = await this.repository.getLeafCategories(userId);

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }

  async getByParentId(parentId: string): Promise<CategoryWithCountEntity[]> {
    const userId = await this.getCurrentUserId();
    const result = await this.repository.getByParentId(userId, parentId);

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }

  async getGroupings(): Promise<GroupingEntity[]> {
    const userId = await this.getCurrentUserId();
    const result = await this.repository.getGroupings(userId);

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }

  async getCategorizedCategories(): Promise<CategorizedCategories> {
    const userId = await this.getCurrentUserId();
    const result = await this.repository.getCategorizedCategories(userId);

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }

  // ===========================================================================
  // WRITE OPERATIONS
  // ===========================================================================

  async create(data: CreateCategoryDTO): Promise<CategoryEntity> {
    // Validate input
    this.validateName(data.name);
    this.validateColor(data.color);

    const userId = await this.getCurrentUserId();
    const result = await this.repository.create(userId, data);

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }

  async createGrouping(data: CreateGroupingDTO): Promise<CategoryEntity> {
    return this.create({
      name: data.name,
      color: data.color,
      type: data.type,
      parentId: null, // Groupings are always root-level
    });
  }

  async createSubcategory(data: CreateSubcategoryDTO): Promise<CategoryEntity> {
    // Fetch parent to validate and inherit properties
    const userId = await this.getCurrentUserId();
    const parentResult = await this.repository.getById(userId, data.parentId);

    if (!parentResult.success) {
      throw parentResult.error;
    }

    const parent = parentResult.data;

    // Validate parent is actually a parent (not a child itself)
    if (parent.parentId !== null) {
      throw new CategoryHierarchyError('parent_is_child');
    }

    return this.create({
      name: data.name,
      color: data.color || parent.color, // Inherit color if not provided
      type: parent.type, // Always inherit type from parent
      parentId: data.parentId,
    });
  }

  async update(id: string, data: UpdateCategoryDTO): Promise<CategoryEntity> {
    // Pre-validation: Fast-UI check before DB call
    this.validateHierarchyUpdate(id, data.parentId);

    if (data.name !== undefined) {
      this.validateName(data.name);
    }
    if (data.color !== undefined) {
      this.validateColor(data.color);
    }

    const userId = await this.getCurrentUserId();
    const result = await this.repository.update(userId, id, data);

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }

  async updateGrouping(
    id: string,
    data: UpdateGroupingDTO
  ): Promise<CategoryEntity> {
    // Build update DTO from input data
    // Note: type change is handled by DB trigger (cascades to children)
    return this.update(id, {
      version: data.version,
      name: data.name,
      color: data.color,
    });
  }

  async delete(id: string, version: number): Promise<void> {
    const userId = await this.getCurrentUserId();
    const result = await this.repository.delete(userId, id, version);

    if (!result.success) {
      throw result.error;
    }
  }

  async reassignSubcategory(
    data: ReassignSubcategoryDTO
  ): Promise<CategoryEntity> {
    const userId = await this.getCurrentUserId();

    // Fetch the category being reassigned to get its current version
    const categoryResult = await this.repository.getById(
      userId,
      data.categoryId
    );
    if (!categoryResult.success) {
      throw new CategoryNotFoundError(data.categoryId);
    }
    const category = categoryResult.data;

    // Validate the new parent exists and is a valid parent
    const newParentResult = await this.repository.getById(
      userId,
      data.newParentId
    );
    if (!newParentResult.success) {
      throw new CategoryNotFoundError(data.newParentId);
    }

    const newParent = newParentResult.data;

    // Ensure new parent is not itself a child
    if (newParent.parentId !== null) {
      throw new CategoryHierarchyError('parent_is_child');
    }

    // Self-parenting check
    this.validateHierarchyUpdate(data.categoryId, data.newParentId);

    // Perform the reassignment with optimistic locking
    const result = await this.repository.update(userId, data.categoryId, {
      version: category.version,
      parentId: data.newParentId,
    });

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }

  async mergeCategories(
    sourceCategoryIds: string[],
    targetCategoryId: string
  ): Promise<MergeCategoriesResult> {
    // CTO MANDATE: This is a Ledger Event - must bump transaction versions
    // See ARCHITECTURE.md Section 8 - Category Merge Protocol

    // Pre-validation: Ensure source array isn't empty
    if (sourceCategoryIds.length === 0) {
      throw new CategoryValidationError(
        'No source categories provided for merge',
        'sourceCategoryIds'
      );
    }

    // Pre-validation: Ensure target isn't in source list
    if (sourceCategoryIds.includes(targetCategoryId)) {
      throw new CategoryValidationError(
        'Target category cannot be one of the source categories',
        'targetCategoryId'
      );
    }

    const userId = await this.getCurrentUserId();

    // Call repository which uses atomic RPC
    // RPC handles: version bumping, transaction reassignment, category deletion
    const result = await this.repository.mergeCategories(
      userId,
      sourceCategoryIds,
      targetCategoryId
    );

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Factory function for creating category service
 */
export function createCategoryService(
  repository: ICategoryRepository,
  authProvider: IAuthProvider
): ICategoryService {
  return new CategoryService(repository, authProvider);
}
