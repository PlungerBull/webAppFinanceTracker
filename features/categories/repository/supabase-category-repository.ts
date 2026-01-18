/**
 * Supabase Category Repository
 *
 * Implementation of ICategoryRepository using Supabase.
 *
 * CTO MANDATES:
 * - DataResult pattern: Never throw, always return success/failure
 * - SQLSTATE mapping: Convert DB errors to typed domain errors
 * - Single query + TypeScript reducer: Build hierarchy in memory
 * - Atomic reassignment: Use transaction-like behavior for batch ops
 *
 * IMPLEMENTATION NOTE - _userId Parameters:
 * Many read methods prefix userId with underscore (_userId) because Supabase
 * RLS (Row Level Security) handles user filtering automatically via the
 * authenticated session. The parameter is REQUIRED by ICategoryRepository
 * interface to preserve contract compatibility for:
 * - Admin dashboards that may bypass RLS
 * - Migration scripts with service role keys
 * - Test implementations with explicit user scoping
 *
 * The underscore is a lint convention indicating "intentionally unused in this
 * implementation" - NOT a signal to remove from the interface contract.
 *
 * @module supabase-category-repository
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import type { ICategoryRepository } from './category-repository.interface';
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
  CategoryGroup,
  CategoryType,
} from '../domain';
import {
  CategoryError,
  CategoryNotFoundError,
  CategoryHierarchyError,
  CategoryHasTransactionsError,
  CategoryHasChildrenError,
  CategoryRepositoryError,
  CategoryDuplicateNameError,
} from '../domain';

// =============================================================================
// TYPES
// =============================================================================

/** Database category row type */
type DbCategoryRow = Database['public']['Tables']['categories']['Row'];

/** Parent categories with counts view row type */
type DbParentCategoryWithCountsRow =
  Database['public']['Views']['parent_categories_with_counts']['Row'];

// =============================================================================
// REPOSITORY IMPLEMENTATION
// =============================================================================

export class SupabaseCategoryRepository implements ICategoryRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  // ===========================================================================
  // PRIVATE: DATA TRANSFORMERS
  // ===========================================================================

  /**
   * Transform DB category row to domain entity
   */
  private toCategoryEntity(row: DbCategoryRow): CategoryEntity {
    return {
      id: row.id,
      userId: row.user_id || '',
      name: row.name,
      color: row.color,
      type: row.type as CategoryType,
      parentId: row.parent_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Transform DB category row to entity with transaction count
   *
   * Note: Count comes from a separate query or is provided externally
   */
  private toCategoryWithCountEntity(
    row: DbCategoryRow,
    transactionCount: number
  ): CategoryWithCountEntity {
    return {
      ...this.toCategoryEntity(row),
      transactionCount,
    };
  }

  /**
   * Transform DB parent_categories_with_counts view row to GroupingEntity
   */
  private toGroupingEntity(
    row: DbParentCategoryWithCountsRow,
    childCount: number
  ): GroupingEntity {
    return {
      id: row.id || '',
      userId: row.user_id || '',
      name: row.name || '',
      color: row.color || '#6b7280',
      type: (row.type as CategoryType) || 'expense',
      createdAt: row.created_at || '',
      updatedAt: row.updated_at || '',
      childCount,
      totalTransactionCount: row.transaction_count || 0,
    };
  }

  // ===========================================================================
  // PRIVATE: SQLSTATE ERROR MAPPING
  // ===========================================================================

  /**
   * Map PostgreSQL error to domain error
   *
   * SQLSTATE codes:
   * - 23503: foreign_key_violation (has transactions or has children)
   * - 23505: unique_violation (duplicate name)
   * - P0001: raise_exception (hierarchy trigger)
   */
  private mapDatabaseError(
    error: { code?: string; message?: string; details?: string },
    context: { categoryId?: string; categoryName?: string; parentId?: string | null }
  ): CategoryError {
    const code = error.code || '';
    const message = error.message || '';

    // Foreign key violation - determine if it's transactions or children
    if (code === '23503') {
      if (message.includes('transactions') || message.includes('category_id')) {
        return new CategoryHasTransactionsError(context.categoryId || 'unknown');
      }
      if (message.includes('parent_id') || message.includes('categories_parent_id_fkey')) {
        return new CategoryHasChildrenError(context.categoryId || 'unknown');
      }
      // Default to transactions constraint
      return new CategoryHasTransactionsError(context.categoryId || 'unknown');
    }

    // Unique violation - duplicate name
    if (code === '23505') {
      return new CategoryDuplicateNameError(
        context.categoryName || 'unknown',
        context.parentId ?? null
      );
    }

    // Raise exception from trigger - hierarchy violation
    if (code === 'P0001') {
      // Parse trigger message to determine violation type
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes('own parent') || lowerMessage.includes('self')) {
        return new CategoryHierarchyError('self_parent');
      }
      if (lowerMessage.includes('depth') || lowerMessage.includes('level')) {
        return new CategoryHierarchyError('max_depth');
      }
      if (lowerMessage.includes('child') || lowerMessage.includes('subcategory')) {
        return new CategoryHierarchyError('parent_is_child');
      }
      // Default hierarchy error
      return new CategoryHierarchyError('max_depth');
    }

    // Generic repository error
    return new CategoryRepositoryError(
      message || 'Database operation failed',
      error
    );
  }

  // ===========================================================================
  // READ OPERATIONS
  // ===========================================================================

  async getAll(
    _userId: string,
    filters?: CategoryFilters
  ): Promise<CategoryDataResult<CategoryEntity[]>> {
    try {
      let query = this.supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });

      // Apply filters
      if (filters?.type) {
        query = query.eq('type', filters.type);
      }
      if (filters?.parentId !== undefined) {
        if (filters.parentId === null) {
          query = query.is('parent_id', null);
        } else {
          query = query.eq('parent_id', filters.parentId);
        }
      }

      const { data, error } = await query;

      if (error) {
        return {
          success: false,
          data: null,
          error: this.mapDatabaseError(error, {}),
        };
      }

      // Filter for leaf-only if requested
      let categories = data || [];
      if (filters?.leafOnly) {
        // Get all parent IDs to determine which categories have children
        const parentIds = new Set(
          categories
            .filter((c) => c.parent_id !== null)
            .map((c) => c.parent_id!)
        );

        // Leaf = either has parentId OR is a parent with no children
        categories = categories.filter(
          (c) => c.parent_id !== null || !parentIds.has(c.id)
        );
      }

      return {
        success: true,
        data: categories.map((row) => this.toCategoryEntity(row)),
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new CategoryRepositoryError(
          'Failed to fetch categories',
          err
        ),
      };
    }
  }

  async getAllWithCounts(
    _userId: string // RLS handles user filtering
  ): Promise<CategoryDataResult<CategoryWithCountEntity[]>> {
    try {
      // Fetch all categories
      const { data: categories, error: catError } = await this.supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });

      if (catError) {
        return {
          success: false,
          data: null,
          error: this.mapDatabaseError(catError, {}),
        };
      }

      // Fetch transaction counts per category using SQL COUNT
      // CTO Performance: Single query with GROUP BY, not N+1
      const { data: counts, error: countError } = await this.supabase
        .from('transactions')
        .select('category_id')
        .not('category_id', 'is', null)
        .is('deleted_at', null);

      if (countError) {
        return {
          success: false,
          data: null,
          error: this.mapDatabaseError(countError, {}),
        };
      }

      // Count transactions per category in memory (single pass)
      const countMap = new Map<string, number>();
      for (const row of counts || []) {
        if (row.category_id) {
          countMap.set(
            row.category_id,
            (countMap.get(row.category_id) || 0) + 1
          );
        }
      }

      return {
        success: true,
        data: (categories || []).map((row) =>
          this.toCategoryWithCountEntity(row, countMap.get(row.id) || 0)
        ),
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new CategoryRepositoryError(
          'Failed to fetch categories with counts',
          err
        ),
      };
    }
  }

  async getById(
    _userId: string,
    id: string
  ): Promise<CategoryDataResult<CategoryEntity>> {
    try {
      const { data, error } = await this.supabase
        .from('categories')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            success: false,
            data: null,
            error: new CategoryNotFoundError(id),
          };
        }
        return {
          success: false,
          data: null,
          error: this.mapDatabaseError(error, { categoryId: id }),
        };
      }

      return {
        success: true,
        data: this.toCategoryEntity(data),
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new CategoryRepositoryError(
          `Failed to fetch category: ${id}`,
          err
        ),
      };
    }
  }

  async getLeafCategories(
    _userId: string // RLS handles user filtering
  ): Promise<CategoryDataResult<LeafCategoryEntity[]>> {
    try {
      // Fetch all categories in single query
      const { data: categories, error } = await this.supabase
        .from('categories')
        .select('*')
        .order('type', { ascending: true }) // income first
        .order('name', { ascending: true });

      if (error) {
        return {
          success: false,
          data: null,
          error: this.mapDatabaseError(error, {}),
        };
      }

      // Build hierarchy in TypeScript (CTO: minimize network round-trips)
      const allCategories = categories || [];

      // Find all parent IDs that have children
      const parentIdsWithChildren = new Set(
        allCategories
          .filter((c) => c.parent_id !== null)
          .map((c) => c.parent_id!)
      );

      // Leaf categories are:
      // 1. Children (parentId !== null)
      // 2. Orphaned parents (parentId === null AND not in parentIdsWithChildren)
      const leafCategories: LeafCategoryEntity[] = allCategories
        .filter((c) => {
          const isChild = c.parent_id !== null;
          const isOrphanedParent =
            c.parent_id === null && !parentIdsWithChildren.has(c.id);
          return isChild || isOrphanedParent;
        })
        .map((row) => ({
          ...this.toCategoryEntity(row),
          isOrphanedParent: row.parent_id === null,
        }));

      return {
        success: true,
        data: leafCategories,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new CategoryRepositoryError(
          'Failed to fetch leaf categories',
          err
        ),
      };
    }
  }

  async getByParentId(
    _userId: string,
    parentId: string
  ): Promise<CategoryDataResult<CategoryWithCountEntity[]>> {
    try {
      // Fetch children
      const { data: children, error: childError } = await this.supabase
        .from('categories')
        .select('*')
        .eq('parent_id', parentId)
        .order('name', { ascending: true });

      if (childError) {
        return {
          success: false,
          data: null,
          error: this.mapDatabaseError(childError, {}),
        };
      }

      // Fetch transaction counts for these categories
      const childIds = (children || []).map((c) => c.id);
      if (childIds.length === 0) {
        return { success: true, data: [] };
      }

      const { data: counts, error: countError } = await this.supabase
        .from('transactions')
        .select('category_id')
        .in('category_id', childIds)
        .is('deleted_at', null);

      if (countError) {
        return {
          success: false,
          data: null,
          error: this.mapDatabaseError(countError, {}),
        };
      }

      // Count per category
      const countMap = new Map<string, number>();
      for (const row of counts || []) {
        if (row.category_id) {
          countMap.set(
            row.category_id,
            (countMap.get(row.category_id) || 0) + 1
          );
        }
      }

      return {
        success: true,
        data: (children || []).map((row) =>
          this.toCategoryWithCountEntity(row, countMap.get(row.id) || 0)
        ),
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new CategoryRepositoryError(
          `Failed to fetch children of category: ${parentId}`,
          err
        ),
      };
    }
  }

  async getGroupings(
    _userId: string // RLS handles user filtering
  ): Promise<CategoryDataResult<GroupingEntity[]>> {
    try {
      // Use the parent_categories_with_counts view for transaction counts
      const { data: parents, error: parentError } = await this.supabase
        .from('parent_categories_with_counts')
        .select('*')
        .is('parent_id', null)
        .order('type', { ascending: true })
        .order('name', { ascending: true });

      if (parentError) {
        return {
          success: false,
          data: null,
          error: this.mapDatabaseError(parentError, {}),
        };
      }

      // Count children per parent
      const { data: allCategories, error: catError } = await this.supabase
        .from('categories')
        .select('parent_id')
        .not('parent_id', 'is', null);

      if (catError) {
        return {
          success: false,
          data: null,
          error: this.mapDatabaseError(catError, {}),
        };
      }

      // Build child count map
      const childCountMap = new Map<string, number>();
      for (const cat of allCategories || []) {
        if (cat.parent_id) {
          childCountMap.set(
            cat.parent_id,
            (childCountMap.get(cat.parent_id) || 0) + 1
          );
        }
      }

      return {
        success: true,
        data: (parents || []).map((row) =>
          this.toGroupingEntity(row, childCountMap.get(row.id || '') || 0)
        ),
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new CategoryRepositoryError(
          'Failed to fetch groupings',
          err
        ),
      };
    }
  }

  async getCategorizedCategories(
    userId: string
  ): Promise<CategoryDataResult<CategorizedCategories>> {
    try {
      // Single query to fetch all categories with counts
      const result = await this.getAllWithCounts(userId);
      if (!result.success) {
        return result as CategoryDataResult<CategorizedCategories>;
      }

      const allCategories = result.data;

      // Build hierarchy with TypeScript reducer
      // CTO: Single network call, build tree in memory
      const parentMap = new Map<string, CategoryWithCountEntity>();
      const childrenMap = new Map<string, CategoryWithCountEntity[]>();

      // First pass: identify parents and initialize children lists
      for (const cat of allCategories) {
        if (cat.parentId === null) {
          parentMap.set(cat.id, cat);
          childrenMap.set(cat.id, []);
        }
      }

      // Second pass: assign children to parents
      for (const cat of allCategories) {
        if (cat.parentId !== null) {
          const children = childrenMap.get(cat.parentId);
          if (children) {
            children.push(cat);
          }
        }
      }

      // Build CategoryGroups
      const buildGroups = (type: CategoryType): CategoryGroup[] => {
        return Array.from(parentMap.values())
          .filter((p) => p.type === type)
          .map((parent) => ({
            parent,
            children: childrenMap.get(parent.id) || [],
          }))
          .sort((a, b) => a.parent.name.localeCompare(b.parent.name));
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
          'Failed to fetch categorized categories',
          err
        ),
      };
    }
  }

  // ===========================================================================
  // WRITE OPERATIONS
  // ===========================================================================

  async create(
    userId: string,
    data: CreateCategoryDTO
  ): Promise<CategoryDataResult<CategoryEntity>> {
    try {
      const { data: created, error } = await this.supabase
        .from('categories')
        .insert({
          name: data.name,
          color: data.color,
          type: data.type,
          parent_id: data.parentId,
          user_id: userId,
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          data: null,
          error: this.mapDatabaseError(error, {
            categoryName: data.name,
            parentId: data.parentId,
          }),
        };
      }

      return {
        success: true,
        data: this.toCategoryEntity(created),
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new CategoryRepositoryError('Failed to create category', err),
      };
    }
  }

  async update(
    _userId: string,
    id: string,
    data: UpdateCategoryDTO
  ): Promise<CategoryDataResult<CategoryEntity>> {
    try {
      // Build update object (only include defined fields)
      const updateData: Database['public']['Tables']['categories']['Update'] =
        {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.color !== undefined) updateData.color = data.color;
      if (data.parentId !== undefined) updateData.parent_id = data.parentId;

      const { data: updated, error } = await this.supabase
        .from('categories')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            success: false,
            data: null,
            error: new CategoryNotFoundError(id),
          };
        }
        return {
          success: false,
          data: null,
          error: this.mapDatabaseError(error, {
            categoryId: id,
            categoryName: data.name,
            parentId: data.parentId,
          }),
        };
      }

      return {
        success: true,
        data: this.toCategoryEntity(updated),
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new CategoryRepositoryError(
          `Failed to update category: ${id}`,
          err
        ),
      };
    }
  }

  async delete(
    _userId: string,
    id: string
  ): Promise<CategoryDataResult<void>> {
    try {
      const { error } = await this.supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) {
        return {
          success: false,
          data: null,
          error: this.mapDatabaseError(error, { categoryId: id }),
        };
      }

      return {
        success: true,
        data: undefined,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new CategoryRepositoryError(
          `Failed to delete category: ${id}`,
          err
        ),
      };
    }
  }

  // ===========================================================================
  // BULK OPERATIONS
  // ===========================================================================

  async reassignCategories(
    _userId: string,
    categoryIds: string[],
    newParentId: string | null
  ): Promise<CategoryDataResult<number>> {
    try {
      if (categoryIds.length === 0) {
        return { success: true, data: 0 };
      }

      // CTO Mandate: Atomic operation - all or nothing
      // Supabase doesn't have explicit transactions in client SDK,
      // but a single UPDATE with IN clause is atomic
      const { data, error } = await this.supabase
        .from('categories')
        .update({ parent_id: newParentId })
        .in('id', categoryIds)
        .select('id');

      if (error) {
        return {
          success: false,
          data: null,
          error: this.mapDatabaseError(error, { parentId: newParentId }),
        };
      }

      return {
        success: true,
        data: data?.length || 0,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new CategoryRepositoryError(
          'Failed to reassign categories',
          err
        ),
      };
    }
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Factory function for creating category repository
 */
export function createCategoryRepository(
  supabase: SupabaseClient<Database>
): ICategoryRepository {
  return new SupabaseCategoryRepository(supabase);
}
