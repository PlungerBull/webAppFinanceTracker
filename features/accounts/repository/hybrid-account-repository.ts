/**
 * Hybrid Account Repository Implementation
 *
 * Orchestrates between LocalAccountRepository (WatermelonDB) and
 * SupabaseAccountRepository for offline-first architecture.
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
 * │              HybridAccountRepository                │
 * │  ┌────────────────────┬────────────────────────┐   │
 * │  │ LocalAccount       │  SupabaseAccount       │   │
 * │  │   Repository       │    Repository          │   │
 * │  │  (reads + writes)  │    (sync engine only)  │   │
 * │  └────────────────────┴────────────────────────┘   │
 * └─────────────────────────────────────────────────────┘
 * ```
 *
 * @module hybrid-account-repository
 */

import type { IAccountRepository } from './account-repository.interface';
import type { LocalAccountRepository } from './local-account-repository';
import type { SupabaseAccountRepository } from './supabase-account-repository';
import type {
  AccountDataResult,
  CreateAccountDTO,
  UpdateAccountDTO,
  CreateAccountGroupResult,
  AccountFilters,
  AccountViewEntity,
} from '../domain';
import type { SyncStatus } from '@/lib/local-db';

/**
 * Hybrid Account Repository
 *
 * Implements IAccountRepository by delegating to local repository.
 * Exposes both repositories for sync engine access.
 *
 * CTO CRITICAL:
 * - All reads → LocalAccountRepository
 * - All writes → LocalAccountRepository (marked 'pending')
 * - Remote repository exposed ONLY for sync engine
 */
export class HybridAccountRepository implements IAccountRepository {
  constructor(
    private readonly localRepository: LocalAccountRepository,
    private readonly remoteRepository: SupabaseAccountRepository
  ) {}

  // ============================================================================
  // QUERY OPERATIONS (Read) - Delegate to Local
  // ============================================================================

  async getAll(
    userId: string,
    filters?: AccountFilters
  ): Promise<AccountDataResult<AccountViewEntity[]>> {
    return this.localRepository.getAll(userId, filters);
  }

  async getById(
    userId: string,
    id: string
  ): Promise<AccountDataResult<AccountViewEntity>> {
    return this.localRepository.getById(userId, id);
  }

  async getByGroupId(
    userId: string,
    groupId: string
  ): Promise<AccountDataResult<AccountViewEntity[]>> {
    return this.localRepository.getByGroupId(userId, groupId);
  }

  // ============================================================================
  // WRITE OPERATIONS - Delegate to Local (marked 'pending')
  // ============================================================================

  async createWithCurrencies(
    userId: string,
    data: CreateAccountDTO
  ): Promise<AccountDataResult<CreateAccountGroupResult>> {
    return this.localRepository.createWithCurrencies(userId, data);
  }

  async update(
    userId: string,
    id: string,
    data: UpdateAccountDTO
  ): Promise<AccountDataResult<AccountViewEntity>> {
    return this.localRepository.update(userId, id, data);
  }

  async delete(
    userId: string,
    id: string,
    version: number
  ): Promise<AccountDataResult<void>> {
    return this.localRepository.delete(userId, id, version);
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
  getLocalRepository(): LocalAccountRepository {
    return this.localRepository;
  }

  /**
   * Get remote repository for sync engine
   *
   * CTO CRITICAL: Only sync engine should call remote repository methods.
   * UI code should NEVER directly call remote repository.
   */
  getRemoteRepository(): SupabaseAccountRepository {
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
  async getPendingRecords(userId: string): Promise<AccountDataResult<AccountViewEntity[]>> {
    return this.localRepository.getPendingRecords(userId);
  }

  /**
   * Get records with conflicts
   *
   * Convenience method for conflict resolution UI.
   */
  async getConflictRecords(userId: string): Promise<AccountDataResult<AccountViewEntity[]>> {
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
  ): Promise<AccountDataResult<void>> {
    return this.localRepository.updateSyncStatus(id, status, serverVersion);
  }

  /**
   * Update balance from server
   *
   * Convenience method for sync engine.
   */
  async updateBalance(
    id: string,
    balanceCents: number,
    serverVersion: number
  ): Promise<AccountDataResult<void>> {
    return this.localRepository.updateBalance(id, balanceCents, serverVersion);
  }
}
