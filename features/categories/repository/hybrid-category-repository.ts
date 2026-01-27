/**
 * Hybrid Category Repository Implementation
 *
 * Orchestrates between LocalCategoryRepository (WatermelonDB) and
 * SupabaseCategoryRepository for offline-first architecture.
 *
 * CTO MANDATES:
 * - Local-First Reads: All queries go to WatermelonDB
 * - Local-First Writes: All writes go to WatermelonDB with 'pending' status
 * - No Dual Write: Only sync engine (Phase 2d) writes to Supabase
 * - Graceful Degradation: Falls back to remote-only if local unavailable
 *
 * Architecture:
 * ```
 * ┌─────────────────────────────────────────────────────┐
 * │              HybridCategoryRepository               │
 * │  ┌────────────────────┬────────────────────────┐   │
 * │  │ LocalCategory      │  SupabaseCategory      │   │
 * │  │   Repository       │    Repository          │   │
 * │  │  (reads + writes)  │    (sync engine only)  │   │
 * │  └────────────────────┴────────────────────────┘   │
 * └─────────────────────────────────────────────────────┘
 * ```
 *
 * @module hybrid-category-repository
 */

import type {
  ICategoryRepository,
  MergeCategoriesResult,
} from './category-repository.interface';
import type { LocalCategoryRepository } from './local-category-repository';
import type { SupabaseCategoryRepository } from './supabase-category-repository';
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
import type { SyncStatus } from '@/lib/local-db';

/**
 * Hybrid Category Repository
 *
 * Implements ICategoryRepository by delegating to local repository.
 * Exposes both repositories for sync engine access.
 *
 * CTO CRITICAL:
 * - All reads → LocalCategoryRepository
 * - All writes → LocalCategoryRepository (marked 'pending')
 * - Remote repository exposed ONLY for sync engine
 */
export class HybridCategoryRepository implements ICategoryRepository {
  constructor(
    private readonly localRepository: LocalCategoryRepository,
    private readonly remoteRepository: SupabaseCategoryRepository
  ) {}

  // ============================================================================
  // READ OPERATIONS - Delegate to Local
  // ============================================================================

  async getAll(
    userId: string,
    filters?: CategoryFilters
  ): Promise<CategoryDataResult<CategoryEntity[]>> {
    return this.localRepository.getAll(userId, filters);
  }

  async getAllWithCounts(
    userId: string
  ): Promise<CategoryDataResult<CategoryWithCountEntity[]>> {
    return this.localRepository.getAllWithCounts(userId);
  }

  async getById(
    userId: string,
    id: string
  ): Promise<CategoryDataResult<CategoryEntity>> {
    return this.localRepository.getById(userId, id);
  }

  async getLeafCategories(
    userId: string
  ): Promise<CategoryDataResult<LeafCategoryEntity[]>> {
    return this.localRepository.getLeafCategories(userId);
  }

  async getByParentId(
    userId: string,
    parentId: string
  ): Promise<CategoryDataResult<CategoryWithCountEntity[]>> {
    return this.localRepository.getByParentId(userId, parentId);
  }

  async getGroupings(userId: string): Promise<CategoryDataResult<GroupingEntity[]>> {
    return this.localRepository.getGroupings(userId);
  }

  async getCategorizedCategories(
    userId: string
  ): Promise<CategoryDataResult<CategorizedCategories>> {
    return this.localRepository.getCategorizedCategories(userId);
  }

  // ============================================================================
  // WRITE OPERATIONS - Delegate to Local (marked 'pending')
  // ============================================================================

  async create(
    userId: string,
    data: CreateCategoryDTO
  ): Promise<CategoryDataResult<CategoryEntity>> {
    return this.localRepository.create(userId, data);
  }

  async update(
    userId: string,
    id: string,
    data: UpdateCategoryDTO
  ): Promise<CategoryDataResult<CategoryEntity>> {
    return this.localRepository.update(userId, id, data);
  }

  async delete(
    userId: string,
    id: string,
    version: number
  ): Promise<CategoryDataResult<void>> {
    return this.localRepository.delete(userId, id, version);
  }

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================

  async reassignCategories(
    userId: string,
    categoryIds: string[],
    newParentId: string | null
  ): Promise<CategoryDataResult<number>> {
    return this.localRepository.reassignCategories(userId, categoryIds, newParentId);
  }

  async mergeCategories(
    userId: string,
    sourceIds: string[],
    targetId: string
  ): Promise<CategoryDataResult<MergeCategoriesResult>> {
    // CTO: Merge requires server coordination - delegate to remote
    // and sync engine will handle updating local afterwards
    return this.remoteRepository.mergeCategories(userId, sourceIds, targetId);
  }

  // ============================================================================
  // SYNC ENGINE ACCESS (Phase 2d)
  // ============================================================================

  /**
   * Get local repository for sync engine
   *
   * CTO: Sync engine uses this to:
   * - Get pending records
   * - Update sync status after push
   * - Handle conflicts
   */
  getLocalRepository(): LocalCategoryRepository {
    return this.localRepository;
  }

  /**
   * Get remote repository for sync engine
   *
   * CTO CRITICAL: Only sync engine should call remote repository methods.
   * UI code should NEVER directly call remote repository.
   */
  getRemoteRepository(): SupabaseCategoryRepository {
    return this.remoteRepository;
  }

  // ============================================================================
  // SYNC ENGINE HELPER METHODS
  // ============================================================================

  /**
   * Get records pending sync
   */
  async getPendingRecords(userId: string): Promise<CategoryDataResult<CategoryEntity[]>> {
    return this.localRepository.getPendingRecords(userId);
  }

  /**
   * Get records with conflicts
   */
  async getConflictRecords(userId: string): Promise<CategoryDataResult<CategoryEntity[]>> {
    return this.localRepository.getConflictRecords(userId);
  }

  /**
   * Update sync status after push
   */
  async updateSyncStatus(
    id: string,
    status: SyncStatus,
    serverVersion?: number
  ): Promise<CategoryDataResult<void>> {
    return this.localRepository.updateSyncStatus(id, status, serverVersion);
  }
}
