/**
 * WatermelonDB Category Model
 *
 * Mirrors categories table from Supabase.
 *
 * CTO MANDATES:
 * - ID Mirror Strategy: WatermelonDB `id` = Supabase UUID
 * - Version Sync: version field for optimistic concurrency
 * - Tombstones: deleted_at for distributed sync
 *
 * @module local-db/models/category
 */

import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, children } from '@nozbe/watermelondb/decorators';
import type { Category } from '@/types/domain';
import type { SyncStatus } from '../schema';

/**
 * Category type enum matching database constraint
 */
export type CategoryType = 'income' | 'expense';

/**
 * WatermelonDB Category Model
 *
 * Maps to categories table.
 * Supports parent-child hierarchy (groupings → subcategories).
 */
export class CategoryModel extends Model {
  static table = 'categories';

  static associations = {
    categories: { type: 'has_many' as const, foreignKey: 'parent_id' },
  };

  // Core fields
  @field('user_id') userId!: string | null;
  @field('name') name!: string;
  @field('type') type!: CategoryType;
  @field('color') color!: string;
  @field('parent_id') parentId!: string | null;

  // Sync fields
  @field('version') version!: number;
  @field('deleted_at') deletedAt!: number | null;
  @field('local_sync_status') localSyncStatus!: SyncStatus;

  // Timestamps (readonly - managed by WatermelonDB)
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  // Children relation (for groupings)
  @children('categories') subcategories!: CategoryModel[];

  /**
   * Check if this is a grouping (parent category)
   */
  get isGrouping(): boolean {
    return this.parentId === null;
  }

  /**
   * Check if this is a subcategory
   */
  get isSubcategory(): boolean {
    return this.parentId !== null;
  }

  /**
   * Convert to domain entity for compatibility with existing code
   */
  toDomainEntity(): Category {
    return {
      id: this.id,
      version: this.version,
      name: this.name,
      color: this.color,
      type: this.type,
      parentId: this.parentId,
      userId: this.userId,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      deletedAt: this.deletedAt ? new Date(this.deletedAt).toISOString() : null,
    };
  }
}
