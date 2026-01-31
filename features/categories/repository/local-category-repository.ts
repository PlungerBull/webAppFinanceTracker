/**
 * Local Category Repository Implementation
 *
 * Implements ICategoryRepository using WatermelonDB for offline-first storage.
 *
 * CTO MANDATES:
 * - Tombstone Pattern: ALL queries filter deleted_at using activeTombstoneFilter()
 * - ID Generation Ownership: Repository generates UUIDs via generateEntityId()
 * - Sync Status State Machine: All writes start as 'pending'
 * - 2-Level Hierarchy: Enforced locally (parent → child only)
 *
 * @module local-category-repository
 */

import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import type {
  ICategoryRepository,
  MergeCategoriesResult,
} from './category-repository.interface';
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
import {
  CategoryNotFoundError,
  CategoryRepositoryError,
  CategoryVersionConflictError,
  CategoryHierarchyError,
  CategoryHasChildrenError,
} from '../domain';
import {
  CategoryModel,
  TransactionModel,
  activeTombstoneFilter,
  generateEntityId,
  getInitialSyncStatus,
  SYNC_STATUS,
  pendingSyncFilter,
  conflictFilter,
  TABLE_NAMES,
} from '@/lib/local-db';
import type { SyncStatus } from '@/lib/local-db';
import { checkAndBufferIfLocked, getSyncLockManager } from '@/lib/sync/sync-lock-manager';
import { localCategoryToDomain } from '@/lib/data/local-data-transformers';

/**
 * Local Category Repository
 *
 * Implements category data access using WatermelonDB.
 * All methods return DataResult<T> (never throw exceptions).
 *
 * CTO CRITICAL: This repository ONLY writes locally.
 * Sync engine (Phase 2d) handles pushing to Supabase.
 */
export class LocalCategoryRepository implements ICategoryRepository {
  constructor(private readonly database: Database) {}

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Transform CategoryModel to CategoryEntity
   * Delegates to shared local-data-transformers (CTO: Single Interface Rule)
   */
  private toEntity(model: CategoryModel): CategoryEntity {
    return localCategoryToDomain(model);
  }

  /**
   * Get transaction count for a category
   */
  private async getTransactionCount(categoryId: string): Promise<number> {
    return this.database
      .get<TransactionModel>('transactions')
      .query(
        Q.where('category_id', categoryId),
        ...activeTombstoneFilter()
      )
      .fetchCount();
  }

  /**
   * Get child count for a category
   */
  private async getChildCount(categoryId: string): Promise<number> {
    return this.database
      .get<CategoryModel>('categories')
      .query(
        Q.where('parent_id', categoryId),
        ...activeTombstoneFilter()
      )
      .fetchCount();
  }

  /**
   * Build filter clauses for WatermelonDB query
   */
  private buildFilterClauses(filters?: CategoryFilters): Q.Clause[] {
    const clauses: Q.Clause[] = [];

    if (filters?.type) {
      clauses.push(Q.where('type', filters.type));
    }

    if (filters?.parentId !== undefined) {
      if (filters.parentId === null) {
        clauses.push(Q.where('parent_id', Q.eq(null)));
      } else {
        clauses.push(Q.where('parent_id', filters.parentId));
      }
    }

    return clauses;
  }

  // ============================================================================
  // READ OPERATIONS
  // ============================================================================

  async getAll(
    userId: string,
    filters?: CategoryFilters
  ): Promise<CategoryDataResult<CategoryEntity[]>> {
    try {
      const filterClauses = this.buildFilterClauses(filters);

      const categories = await this.database
        .get<CategoryModel>('categories')
        .query(
          Q.where('user_id', userId),
          ...activeTombstoneFilter(),
          ...filterClauses,
          Q.sortBy('name', Q.asc)
        )
        .fetch();

      return {
        success: true,
        data: categories.map((c) => this.toEntity(c)),
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new CategoryRepositoryError(
          `Failed to fetch categories: ${(err as Error).message}`,
          err
        ),
      };
    }
  }

  async getAllWithCounts(
    userId: string
  ): Promise<CategoryDataResult<CategoryWithCountEntity[]>> {
    try {
      const categories = await this.database
        .get<CategoryModel>('categories')
        .query(
          Q.where('user_id', userId),
          ...activeTombstoneFilter(),
          Q.sortBy('name', Q.asc)
        )
        .fetch();

      // Get transaction counts for all categories
      const categoriesWithCounts = await Promise.all(
        categories.map(async (c) => {
          const transactionCount = await this.getTransactionCount(c.id);
          return {
            ...this.toEntity(c),
            transactionCount,
          };
        })
      );

      return {
        success: true,
        data: categoriesWithCounts,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new CategoryRepositoryError(
          `Failed to fetch categories with counts: ${(err as Error).message}`,
          err
        ),
      };
    }
  }

  async getById(
    userId: string,
    id: string
  ): Promise<CategoryDataResult<CategoryEntity>> {
    try {
      const category = await this.database
        .get<CategoryModel>('categories')
        .find(id);

      // Verify ownership
      if (category.userId !== userId) {
        return {
          success: false,
          data: null,
          error: new CategoryNotFoundError(id),
        };
      }

      // Check tombstone
      if (category.deletedAt !== null) {
        return {
          success: false,
          data: null,
          error: new CategoryNotFoundError(id),
        };
      }

      return {
        success: true,
        data: this.toEntity(category),
      };
    } catch (err) {
      if ((err as Error).message?.includes('not found')) {
        return {
          success: false,
          data: null,
          error: new CategoryNotFoundError(id),
        };
      }
      return {
        success: false,
        data: null,
        error: new CategoryRepositoryError(
          `Failed to fetch category: ${(err as Error).message}`,
          err
        ),
      };
    }
  }

  async getLeafCategories(
    userId: string
  ): Promise<CategoryDataResult<LeafCategoryEntity[]>> {
    try {
      // Get all categories
      const allCategories = await this.database
        .get<CategoryModel>('categories')
        .query(
          Q.where('user_id', userId),
          ...activeTombstoneFilter()
        )
        .fetch();

      // Get parent IDs that have children
      const parentIds = new Set(
        allCategories
          .filter((c) => c.parentId !== null)
          .map((c) => c.parentId!)
      );

      // Leaf categories are:
      // 1. All subcategories (parentId !== null)
      // 2. Orphaned parents (parentId === null but not in parentIds)
      const leafCategories = allCategories.filter((c) => {
        if (c.parentId !== null) {
          return true; // All subcategories are leaves
        }
        return !parentIds.has(c.id); // Orphaned parents are also leaves
      });

      // Sort by type (income first), then name
      leafCategories.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'income' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      const result: LeafCategoryEntity[] = leafCategories.map((c) => ({
        ...this.toEntity(c),
        isOrphanedParent: c.parentId === null,
      }));

      return {
        success: true,
        data: result,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new CategoryRepositoryError(
          `Failed to fetch leaf categories: ${(err as Error).message}`,
          err
        ),
      };
    }
  }

  async getByParentId(
    userId: string,
    parentId: string
  ): Promise<CategoryDataResult<CategoryWithCountEntity[]>> {
    try {
      const categories = await this.database
        .get<CategoryModel>('categories')
        .query(
          Q.where('user_id', userId),
          Q.where('parent_id', parentId),
          ...activeTombstoneFilter(),
          Q.sortBy('name', Q.asc)
        )
        .fetch();

      const categoriesWithCounts = await Promise.all(
        categories.map(async (c) => {
          const transactionCount = await this.getTransactionCount(c.id);
          return {
            ...this.toEntity(c),
            transactionCount,
          };
        })
      );

      return {
        success: true,
        data: categoriesWithCounts,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new CategoryRepositoryError(
          `Failed to fetch categories by parent: ${(err as Error).message}`,
          err
        ),
      };
    }
  }

  async getGroupings(userId: string): Promise<CategoryDataResult<GroupingEntity[]>> {
    try {
      // Get all parent categories (parentId === null)
      const groupings = await this.database
        .get<CategoryModel>('categories')
        .query(
          Q.where('user_id', userId),
          Q.where('parent_id', Q.eq(null)),
          ...activeTombstoneFilter(),
          Q.sortBy('name', Q.asc)
        )
        .fetch();

      const result = await Promise.all(
        groupings.map(async (g) => {
          // Get child count
          const childCount = await this.getChildCount(g.id);

          // Get total transaction count across all children
          const children = await this.database
            .get<CategoryModel>('categories')
            .query(
              Q.where('parent_id', g.id),
              ...activeTombstoneFilter()
            )
            .fetch();

          let totalTransactionCount = 0;
          for (const child of children) {
            totalTransactionCount += await this.getTransactionCount(child.id);
          }

          // Also count transactions directly on the grouping (if orphaned)
          if (childCount === 0) {
            totalTransactionCount += await this.getTransactionCount(g.id);
          }

          const base = localCategoryToDomain(g);
          return {
            id: base.id,
            userId: base.userId,
            name: base.name,
            color: base.color,
            type: base.type,
            createdAt: base.createdAt,
            updatedAt: base.updatedAt,
            version: base.version,
            deletedAt: base.deletedAt,
            childCount,
            totalTransactionCount,
          } as GroupingEntity;
        })
      );

      return {
        success: true,
        data: result,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new CategoryRepositoryError(
          `Failed to fetch groupings: ${(err as Error).message}`,
          err
        ),
      };
    }
  }

  async getCategorizedCategories(
    userId: string
  ): Promise<CategoryDataResult<CategorizedCategories>> {
    try {
      // Get all categories with counts
      const result = await this.getAllWithCounts(userId);
      if (!result.success) {
        return result as CategoryDataResult<CategorizedCategories>;
      }

      const categories = result.data;

      // Separate into parents and children
      const parents = categories.filter((c) => c.parentId === null);
      const children = categories.filter((c) => c.parentId !== null);

      // Group children by parent
      const childrenByParent = new Map<string, CategoryWithCountEntity[]>();
      children.forEach((c) => {
        const existing = childrenByParent.get(c.parentId!) || [];
        existing.push(c);
        childrenByParent.set(c.parentId!, existing);
      });

      // Build categorized structure
      const buildGroups = (type: 'income' | 'expense') => {
        return parents
          .filter((p) => p.type === type)
          .map((p) => ({
            parent: p,
            children: childrenByParent.get(p.id) || [],
          }));
      };

      return {
        success: true,
        data: {
          income: buildGroups('income'),
          expense: buildGroups('expense'),
        },
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new CategoryRepositoryError(
          `Failed to fetch categorized categories: ${(err as Error).message}`,
          err
        ),
      };
    }
  }

  // ============================================================================
  // WRITE OPERATIONS
  // ============================================================================

  async create(
    userId: string,
    data: CreateCategoryDTO
  ): Promise<CategoryDataResult<CategoryEntity>> {
    try {
      // Validate hierarchy if parentId is provided
      if (data.parentId !== null) {
        // Check parent exists and is not a child itself
        try {
          const parent = await this.database
            .get<CategoryModel>('categories')
            .find(data.parentId);

          if (parent.deletedAt !== null) {
            return {
              success: false,
              data: null,
              error: new CategoryHierarchyError('parent_is_child'),
            };
          }

          // Check if parent is already a child (max 2 levels)
          if (parent.parentId !== null) {
            return {
              success: false,
              data: null,
              error: new CategoryHierarchyError('max_depth'),
            };
          }
        } catch {
          return {
            success: false,
            data: null,
            error: new CategoryNotFoundError(data.parentId),
          };
        }
      }

      const categoriesCollection = this.database.get<CategoryModel>('categories');
      let createdCategory: CategoryModel | null = null;

      await this.database.write(async () => {
        createdCategory = await categoriesCollection.create((record) => {
          record._raw.id = data.id || generateEntityId();
          record.userId = userId;
          record.name = data.name;
          record.color = data.color;
          record.type = data.type;
          record.parentId = data.parentId;

          // CTO MANDATE: Sync fields
          record.version = 1;
          record.deletedAt = null;
          record.localSyncStatus = getInitialSyncStatus(); // 'pending'
        });
      });

      if (!createdCategory) {
        return {
          success: false,
          data: null,
          error: new CategoryRepositoryError('Failed to create category'),
        };
      }

      return {
        success: true,
        data: this.toEntity(createdCategory),
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new CategoryRepositoryError(
          `Failed to create category: ${(err as Error).message}`,
          err
        ),
      };
    }
  }

  async update(
    userId: string,
    id: string,
    data: UpdateCategoryDTO
  ): Promise<CategoryDataResult<CategoryEntity>> {
    try {
      // Find existing category
      let category: CategoryModel;
      try {
        category = await this.database
          .get<CategoryModel>('categories')
          .find(id);
      } catch {
        return {
          success: false,
          data: null,
          error: new CategoryNotFoundError(id),
        };
      }

      // Verify ownership
      if (category.userId !== userId) {
        return {
          success: false,
          data: null,
          error: new CategoryNotFoundError(id),
        };
      }

      // Check tombstone
      if (category.deletedAt !== null) {
        return {
          success: false,
          data: null,
          error: new CategoryNotFoundError(id),
        };
      }

      // CTO MANDATE: Mutation Lock Pattern
      // If record is already pending, we're merging into an existing pending state.
      // No version check needed - the local device is the temporary master.
      // If record is synced, we do version check before transitioning to pending.
      const isPending = category.localSyncStatus === SYNC_STATUS.PENDING;

      if (!isPending) {
        // Synced record: Enforce optimistic concurrency control
        if (category.version !== data.version) {
          return {
            success: false,
            data: null,
            error: new CategoryVersionConflictError(id, data.version, category.version),
            conflict: true,
          };
        }
      }
      // If isPending: Skip version check - merge into existing pending state

      // Validate parentId change if provided
      if (data.parentId !== undefined && data.parentId !== category.parentId) {
        // Cannot set self as parent
        if (data.parentId === id) {
          return {
            success: false,
            data: null,
            error: new CategoryHierarchyError('self_parent'),
          };
        }

        if (data.parentId !== null) {
          try {
            const newParent = await this.database
              .get<CategoryModel>('categories')
              .find(data.parentId);

            // Cannot parent under a child
            if (newParent.parentId !== null) {
              return {
                success: false,
                data: null,
                error: new CategoryHierarchyError('max_depth'),
              };
            }
          } catch {
            return {
              success: false,
              data: null,
              error: new CategoryNotFoundError(data.parentId),
            };
          }
        }
      }

      // CTO MANDATE: Sync Lock Check - buffer if record is being synced
      const updateData = {
        name: data.name,
        color: data.color,
        parentId: data.parentId,
      };
      const lockResult = checkAndBufferIfLocked(
        id,
        TABLE_NAMES.CATEGORIES,
        updateData
      );
      if (lockResult.isLocked) {
        // Return projected data for optimistic UI
        const projected: CategoryEntity = {
          ...this.toEntity(category),
          name: data.name ?? category.name,
          color: data.color ?? category.color,
          parentId: data.parentId !== undefined ? data.parentId : category.parentId,
          updatedAt: new Date().toISOString(),
        };
        return { success: true, data: projected, buffered: true };
      }

      // Update category with Mutation Lock
      await this.database.write(async () => {
        await category.update((record) => {
          if (data.name !== undefined) {
            record.name = data.name;
          }
          if (data.color !== undefined) {
            record.color = data.color;
          }
          if (data.parentId !== undefined) {
            record.parentId = data.parentId;
          }

          // CTO MANDATE: Mark as pending for sync
          record.localSyncStatus = SYNC_STATUS.PENDING;
          // MUTATION LOCK: Never increment version locally.
          // Version only changes after successful server sync.
          // This prevents Overwriting Race Conditions.
        });
      });

      // Fetch updated record
      const updated = await this.database
        .get<CategoryModel>('categories')
        .find(id);

      return {
        success: true,
        data: this.toEntity(updated),
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new CategoryRepositoryError(
          `Failed to update category: ${(err as Error).message}`,
          err
        ),
      };
    }
  }

  async delete(
    userId: string,
    id: string,
    version: number
  ): Promise<CategoryDataResult<void>> {
    try {
      // Find existing category
      let category: CategoryModel;
      try {
        category = await this.database
          .get<CategoryModel>('categories')
          .find(id);
      } catch {
        return {
          success: false,
          data: null,
          error: new CategoryNotFoundError(id),
        };
      }

      // Verify ownership
      if (category.userId !== userId) {
        return {
          success: false,
          data: null,
          error: new CategoryNotFoundError(id),
        };
      }

      // Already deleted
      if (category.deletedAt !== null) {
        return {
          success: false,
          data: null,
          error: new CategoryNotFoundError(id),
        };
      }

      // CTO MANDATE: Optimistic concurrency control
      if (category.version !== version) {
        return {
          success: false,
          data: null,
          error: new CategoryVersionConflictError(id, version, category.version),
          conflict: true,
        };
      }

      // Check for children
      const childCount = await this.getChildCount(id);
      if (childCount > 0) {
        return {
          success: false,
          data: null,
          error: new CategoryHasChildrenError(id, childCount),
        };
      }

      // CTO MANDATE: Sync Lock Check - buffer if record is being synced
      const deleteData = { deletedAt: Date.now() };
      const lockResult = checkAndBufferIfLocked(
        id,
        TABLE_NAMES.CATEGORIES,
        deleteData
      );
      if (lockResult.isLocked) {
        // Delete buffered - will be applied after sync completes
        return { success: true, data: undefined, buffered: true };
      }

      // CTO MANDATE: Soft delete (Tombstone Pattern)
      await this.database.write(async () => {
        await category.update((record) => {
          record.deletedAt = Date.now();
          record.localSyncStatus = SYNC_STATUS.PENDING;
        });
      });

      return { success: true, data: undefined };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new CategoryRepositoryError(
          `Failed to delete category: ${(err as Error).message}`,
          err
        ),
      };
    }
  }

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================

  async reassignCategories(
    userId: string,
    categoryIds: string[],
    newParentId: string | null
  ): Promise<CategoryDataResult<number>> {
    try {
      if (categoryIds.length === 0) {
        return { success: true, data: 0 };
      }

      // Validate new parent if not null
      if (newParentId !== null) {
        try {
          const newParent = await this.database
            .get<CategoryModel>('categories')
            .find(newParentId);

          if (newParent.parentId !== null) {
            return {
              success: false,
              data: null,
              error: new CategoryHierarchyError('max_depth'),
            };
          }
        } catch {
          return {
            success: false,
            data: null,
            error: new CategoryNotFoundError(newParentId),
          };
        }
      }

      // CTO MANDATE: Filter and Defer pattern for batch operations
      const lockManager = getSyncLockManager();
      const locked = categoryIds.filter((id) => lockManager.isLocked(id));
      const ready = categoryIds.filter((id) => !lockManager.isLocked(id));

      // Buffer locked items
      for (const id of locked) {
        lockManager.bufferUpdate(id, TABLE_NAMES.CATEGORIES, { parentId: newParentId });
      }

      // Update ready categories
      await this.database.write(async () => {
        for (const categoryId of ready) {
          try {
            const category = await this.database
              .get<CategoryModel>('categories')
              .find(categoryId);

            if (category.userId === userId && category.deletedAt === null) {
              await category.update((record) => {
                record.parentId = newParentId;
                record.localSyncStatus = SYNC_STATUS.PENDING;
              });
            }
          } catch {
            // Skip categories that don't exist
          }
        }
      });

      return {
        success: true,
        data: categoryIds.length,
        bufferedCount: locked.length,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new CategoryRepositoryError(
          `Failed to reassign categories: ${(err as Error).message}`,
          err
        ),
      };
    }
  }

  async mergeCategories(
    _userId: string,
    _sourceIds: string[],
    _targetId: string
  ): Promise<CategoryDataResult<MergeCategoriesResult>> {
    // CTO: Merge is an atomic operation that requires server coordination
    // because it affects transactions and requires version bumping.
    // This should be handled by the sync engine calling the server RPC.
    return {
      success: false,
      data: null,
      error: new CategoryRepositoryError(
        'Category merge must be performed via server sync. Local-only merge not supported.'
      ),
    };
  }

  // ============================================================================
  // SYNC ENGINE METHODS (For Phase 2d)
  // ============================================================================

  /**
   * Get records pending sync
   */
  async getPendingRecords(userId: string): Promise<CategoryDataResult<CategoryEntity[]>> {
    try {
      const pending = await this.database
        .get<CategoryModel>('categories')
        .query(
          Q.where('user_id', userId),
          ...pendingSyncFilter()
        )
        .fetch();

      return {
        success: true,
        data: pending.map((c) => this.toEntity(c)),
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new CategoryRepositoryError(
          `Failed to fetch pending records: ${(err as Error).message}`,
          err
        ),
      };
    }
  }

  /**
   * Get records with conflicts
   */
  async getConflictRecords(userId: string): Promise<CategoryDataResult<CategoryEntity[]>> {
    try {
      const conflicts = await this.database
        .get<CategoryModel>('categories')
        .query(
          Q.where('user_id', userId),
          ...conflictFilter()
        )
        .fetch();

      return {
        success: true,
        data: conflicts.map((c) => this.toEntity(c)),
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new CategoryRepositoryError(
          `Failed to fetch conflict records: ${(err as Error).message}`,
          err
        ),
      };
    }
  }

  /**
   * Update sync status after push
   */
  async updateSyncStatus(
    id: string,
    status: SyncStatus,
    serverVersion?: number
  ): Promise<CategoryDataResult<void>> {
    try {
      const category = await this.database
        .get<CategoryModel>('categories')
        .find(id);

      await this.database.write(async () => {
        await category.update((record) => {
          record.localSyncStatus = status;
          if (serverVersion !== undefined) {
            record.version = serverVersion;
          }
        });
      });

      return { success: true, data: undefined };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new CategoryRepositoryError(
          `Failed to update sync status: ${(err as Error).message}`,
          err
        ),
      };
    }
  }
}
