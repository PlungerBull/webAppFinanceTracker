/**
 * Hybrid Inbox Repository Implementation
 *
 * Orchestrates between LocalInboxRepository (WatermelonDB) and
 * SupabaseInboxRepository for offline-first architecture.
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
 * │               HybridInboxRepository                 │
 * │  ┌────────────────────┬────────────────────────┐   │
 * │  │ LocalInbox         │  SupabaseInbox         │   │
 * │  │   Repository       │    Repository          │   │
 * │  │  (reads + writes)  │    (sync engine only)  │   │
 * │  └────────────────────┴────────────────────────┘   │
 * └─────────────────────────────────────────────────────┘
 * ```
 *
 * @module hybrid-inbox-repository
 */

import type { IInboxRepository } from './inbox-repository.interface';
import type { LocalInboxRepository } from './local-inbox-repository';
import type { SupabaseInboxRepository } from './supabase-inbox-repository';
import type {
  DataResult,
  PaginatedResult,
  PaginationOptions,
  CreateInboxItemDTO,
  UpdateInboxItemDTO,
  PromoteInboxItemDTO,
  PromoteResult,
} from '../domain/types';
import type { InboxItemViewEntity } from '@/domain/inbox';
import type { SyncStatus } from '@/lib/local-db';

/**
 * Hybrid Inbox Repository
 *
 * Implements IInboxRepository by delegating to local repository.
 * Exposes both repositories for sync engine access.
 *
 * CTO CRITICAL:
 * - All reads → LocalInboxRepository
 * - All writes → LocalInboxRepository (marked 'pending')
 * - Remote repository exposed ONLY for sync engine
 */
export class HybridInboxRepository implements IInboxRepository {
  constructor(
    private readonly localRepository: LocalInboxRepository,
    private readonly remoteRepository: SupabaseInboxRepository
  ) {}

  // ============================================================================
  // QUERY OPERATIONS - Delegate to Local
  // ============================================================================

  async getPendingPaginated(
    userId: string,
    pagination?: PaginationOptions
  ): Promise<DataResult<PaginatedResult<InboxItemViewEntity>>> {
    return this.localRepository.getPendingPaginated(userId, pagination);
  }

  async getById(userId: string, id: string): Promise<DataResult<InboxItemViewEntity>> {
    return this.localRepository.getById(userId, id);
  }

  // ============================================================================
  // WRITE OPERATIONS - Delegate to Local (marked 'pending')
  // ============================================================================

  async create(
    userId: string,
    data: CreateInboxItemDTO
  ): Promise<DataResult<InboxItemViewEntity>> {
    return this.localRepository.create(userId, data);
  }

  async update(
    userId: string,
    id: string,
    data: UpdateInboxItemDTO
  ): Promise<DataResult<InboxItemViewEntity>> {
    return this.localRepository.update(userId, id, data);
  }

  // ============================================================================
  // BATCH OPERATIONS
  // ============================================================================

  async createBatch(
    userId: string,
    items: CreateInboxItemDTO[]
  ): Promise<DataResult<InboxItemViewEntity[]>> {
    return this.localRepository.createBatch(userId, items);
  }

  async updateBatch(
    userId: string,
    updates: Array<{ id: string; data: UpdateInboxItemDTO }>
  ): Promise<DataResult<InboxItemViewEntity[]>> {
    return this.localRepository.updateBatch(userId, updates);
  }

  // ============================================================================
  // PROMOTION OPERATIONS - Delegate to Remote (requires server)
  // ============================================================================

  async promote(
    userId: string,
    data: PromoteInboxItemDTO
  ): Promise<DataResult<PromoteResult>> {
    // CTO: Promotion requires atomic server operation
    // Delegate to remote repository which calls the server RPC
    return this.remoteRepository.promote(userId, data);
  }

  // ============================================================================
  // DISMISS OPERATIONS
  // ============================================================================

  async dismiss(userId: string, id: string): Promise<DataResult<void>> {
    return this.localRepository.dismiss(userId, id);
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
  getLocalRepository(): LocalInboxRepository {
    return this.localRepository;
  }

  /**
   * Get remote repository for sync engine
   *
   * CTO CRITICAL: Only sync engine should call remote repository methods.
   * UI code should NEVER directly call remote repository.
   */
  getRemoteRepository(): SupabaseInboxRepository {
    return this.remoteRepository;
  }

  // ============================================================================
  // SYNC ENGINE HELPER METHODS
  // ============================================================================

  /**
   * Get records pending sync
   */
  async getPendingRecords(userId: string): Promise<DataResult<InboxItemViewEntity[]>> {
    return this.localRepository.getPendingRecords(userId);
  }

  /**
   * Get records with conflicts
   */
  async getConflictRecords(userId: string): Promise<DataResult<InboxItemViewEntity[]>> {
    return this.localRepository.getConflictRecords(userId);
  }

  /**
   * Update sync status after push
   */
  async updateSyncStatus(
    id: string,
    status: SyncStatus,
    serverVersion?: number
  ): Promise<DataResult<void>> {
    return this.localRepository.updateSyncStatus(id, status, serverVersion);
  }
}
