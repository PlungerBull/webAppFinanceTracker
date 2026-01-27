/**
 * Hybrid Transaction Repository Implementation
 *
 * Orchestrates between LocalTransactionRepository (WatermelonDB) and
 * SupabaseTransactionRepository for offline-first architecture.
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
 * │           HybridTransactionRepository               │
 * │  ┌────────────────────┬────────────────────────┐   │
 * │  │ LocalTransaction   │  SupabaseTransaction   │   │
 * │  │   Repository       │    Repository          │   │
 * │  │  (reads + writes)  │    (sync engine only)  │   │
 * │  └────────────────────┴────────────────────────┘   │
 * └─────────────────────────────────────────────────────┘
 * ```
 *
 * @module hybrid-transaction-repository
 */

import type { ITransactionRepository } from './transaction-repository.interface';
import type { LocalTransactionRepository } from './local-transaction-repository';
import type { SupabaseTransactionRepository } from './supabase-transaction-repository';
import type {
  DataResult,
  CreateTransactionDTO,
  UpdateTransactionDTO,
  BulkUpdateTransactionDTO,
  BulkUpdateResult,
  TransactionFilters,
  PaginationOptions,
  PaginatedResult,
  SyncResponse,
  TransactionChanges,
  CategoryCounts,
} from '../domain/types';
import type { TransactionViewEntity } from '../domain/entities';
import type { SyncStatus } from '@/lib/local-db';

/**
 * Hybrid Transaction Repository
 *
 * Implements ITransactionRepository by delegating to local repository.
 * Exposes both repositories for sync engine access.
 *
 * CTO CRITICAL:
 * - All reads → LocalTransactionRepository
 * - All writes → LocalTransactionRepository (marked 'pending')
 * - Remote repository exposed ONLY for sync engine
 */
export class HybridTransactionRepository implements ITransactionRepository {
  constructor(
    private readonly localRepository: LocalTransactionRepository,
    private readonly remoteRepository: SupabaseTransactionRepository
  ) {}

  // ============================================================================
  // QUERY OPERATIONS (Read) - Delegate to Local
  // ============================================================================

  async getAllPaginated(
    userId: string,
    filters?: TransactionFilters,
    pagination?: PaginationOptions
  ): Promise<DataResult<PaginatedResult<TransactionViewEntity>>> {
    return this.localRepository.getAllPaginated(userId, filters, pagination);
  }

  async getById(userId: string, id: string): Promise<DataResult<TransactionViewEntity>> {
    return this.localRepository.getById(userId, id);
  }

  async getCategoryCounts(
    userId: string,
    filters?: TransactionFilters
  ): Promise<DataResult<CategoryCounts>> {
    return this.localRepository.getCategoryCounts(userId, filters);
  }

  // ============================================================================
  // WRITE OPERATIONS - Delegate to Local (marked 'pending')
  // ============================================================================

  async create(
    userId: string,
    transactionId: string,
    data: CreateTransactionDTO
  ): Promise<DataResult<TransactionViewEntity>> {
    return this.localRepository.create(userId, transactionId, data);
  }

  async update(
    userId: string,
    id: string,
    data: UpdateTransactionDTO
  ): Promise<DataResult<TransactionViewEntity>> {
    return this.localRepository.update(userId, id, data);
  }

  async updateBatch(
    userId: string,
    id: string,
    updates: Partial<CreateTransactionDTO>,
    version: number
  ): Promise<DataResult<TransactionViewEntity>> {
    return this.localRepository.updateBatch(userId, id, updates, version);
  }

  async bulkUpdate(
    userId: string,
    data: BulkUpdateTransactionDTO
  ): Promise<DataResult<BulkUpdateResult>> {
    return this.localRepository.bulkUpdate(userId, data);
  }

  // ============================================================================
  // SOFT DELETE OPERATIONS - Delegate to Local
  // ============================================================================

  async delete(userId: string, id: string, version: number): Promise<DataResult<void>> {
    return this.localRepository.delete(userId, id, version);
  }

  async restore(userId: string, id: string): Promise<DataResult<TransactionViewEntity>> {
    return this.localRepository.restore(userId, id);
  }

  async getDeleted(
    userId: string,
    sinceVersion?: number
  ): Promise<DataResult<SyncResponse<TransactionViewEntity[]>>> {
    return this.localRepository.getDeleted(userId, sinceVersion);
  }

  // ============================================================================
  // DELTA SYNC OPERATIONS - Delegate to Local
  // ============================================================================

  async getChangesSince(
    userId: string,
    sinceVersion: number
  ): Promise<DataResult<SyncResponse<TransactionChanges>>> {
    return this.localRepository.getChangesSince(userId, sinceVersion);
  }

  async permanentlyDelete(userId: string, id: string): Promise<DataResult<void>> {
    return this.localRepository.permanentlyDelete(userId, id);
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
  getLocalRepository(): LocalTransactionRepository {
    return this.localRepository;
  }

  /**
   * Get remote repository for sync engine
   *
   * CTO CRITICAL: Only sync engine should call remote repository methods.
   * UI code should NEVER directly call remote repository.
   */
  getRemoteRepository(): SupabaseTransactionRepository {
    return this.remoteRepository;
  }

  // ============================================================================
  // SYNC ENGINE HELPER METHODS
  // ============================================================================

  /**
   * Get records pending sync
   *
   * Convenience method for sync engine.
   */
  async getPendingRecords(userId: string): Promise<DataResult<TransactionViewEntity[]>> {
    return this.localRepository.getPendingRecords(userId);
  }

  /**
   * Get records with conflicts
   *
   * Convenience method for conflict resolution UI.
   */
  async getConflictRecords(userId: string): Promise<DataResult<TransactionViewEntity[]>> {
    return this.localRepository.getConflictRecords(userId);
  }

  /**
   * Update sync status after push
   *
   * Convenience method for sync engine.
   */
  async updateSyncStatus(
    id: string,
    status: SyncStatus,
    serverVersion?: number
  ): Promise<DataResult<void>> {
    return this.localRepository.updateSyncStatus(id, status, serverVersion);
  }
}
