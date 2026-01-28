/**
 * Inbox Service
 *
 * Service layer for inbox operations.
 * Handles authentication and delegates to repository.
 *
 * Phase 2c: Hybrid Repository
 * - Uses dependency injection for repository
 * - Supports HybridInboxRepository for offline-first architecture
 * - Graceful degradation when WatermelonDB unavailable
 *
 * Pattern:
 * - Gets userId from auth provider
 * - Calls repository methods with userId
 * - Returns DataResult<T> (no throwing)
 *
 * @module inbox-service
 */

import type { IInboxRepository } from '../repository/inbox-repository.interface';
import type { IAuthProvider } from '@/lib/auth/auth-provider.interface';
import { reportServiceFailure } from '@/lib/sentry/reporter';
import type {
  DataResult,
  PaginatedResult,
  PaginationOptions,
  CreateInboxItemDTO,
  UpdateInboxItemDTO,
  PromoteInboxItemDTO,
  PromoteResult,
} from '../domain/types';
import type { InboxItemViewEntity } from '../domain/entities';
import { InboxRepositoryError } from '../domain/errors';

/**
 * Inbox Service Interface
 *
 * Platform-agnostic contract for inbox service operations.
 */
export interface IInboxService {
  getPendingPaginated(
    pagination?: PaginationOptions
  ): Promise<DataResult<PaginatedResult<InboxItemViewEntity>>>;
  getById(id: string): Promise<DataResult<InboxItemViewEntity>>;
  create(data: CreateInboxItemDTO): Promise<DataResult<InboxItemViewEntity>>;
  update(
    id: string,
    data: UpdateInboxItemDTO
  ): Promise<DataResult<InboxItemViewEntity>>;
  createBatch(items: CreateInboxItemDTO[]): Promise<DataResult<InboxItemViewEntity[]>>;
  updateBatch(
    updates: Array<{ id: string; data: UpdateInboxItemDTO }>
  ): Promise<DataResult<InboxItemViewEntity[]>>;
  promote(data: PromoteInboxItemDTO): Promise<DataResult<PromoteResult>>;
  dismiss(id: string): Promise<DataResult<void>>;
}

/**
 * Inbox Service
 *
 * Provides authenticated access to inbox operations.
 * All methods return DataResult<T> for explicit error handling.
 *
 * CTO MANDATES:
 * - Dependency Injection: Repository and auth provider passed via constructor
 * - DataResult Pattern: Never throws, always returns success/error
 */
export class InboxService implements IInboxService {
  constructor(
    private readonly repository: IInboxRepository,
    private readonly authProvider: IAuthProvider
  ) {}

  /**
   * Report DataResult failures to Sentry
   */
  private reportIfFailed<T>(result: DataResult<T>, operation: string): DataResult<T> {
    if (!result.success) {
      reportServiceFailure(result.error, 'inbox', operation);
    }
    return result;
  }

  /**
   * Get current user ID from auth provider
   */
  private async getUserId(): Promise<DataResult<string>> {
    try {
      const userId = await this.authProvider.getCurrentUserId();

      if (!userId) {
        return {
          success: false,
          data: null,
          error: new InboxRepositoryError('Not authenticated'),
        };
      }

      return {
        success: true,
        data: userId,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new InboxRepositoryError(
          err instanceof Error ? err.message : 'Failed to get user'
        ),
      };
    }
  }

  // ============================================================================
  // QUERY OPERATIONS
  // ============================================================================

  /**
   * Get paginated pending inbox items
   */
  async getPendingPaginated(
    pagination?: PaginationOptions
  ): Promise<DataResult<PaginatedResult<InboxItemViewEntity>>> {
    const userResult = await this.getUserId();
    if (!userResult.success) {
      return {
        success: false,
        data: null,
        error: userResult.error,
      };
    }

    return this.repository.getPendingPaginated(userResult.data, pagination);
  }

  /**
   * Get single inbox item by ID
   */
  async getById(id: string): Promise<DataResult<InboxItemViewEntity>> {
    const userResult = await this.getUserId();
    if (!userResult.success) {
      return {
        success: false,
        data: null,
        error: userResult.error,
      };
    }

    return this.repository.getById(userResult.data, id);
  }

  // ============================================================================
  // WRITE OPERATIONS
  // ============================================================================

  /**
   * Create new inbox item
   */
  async create(data: CreateInboxItemDTO): Promise<DataResult<InboxItemViewEntity>> {
    const userResult = await this.getUserId();
    if (!userResult.success) {
      return {
        success: false,
        data: null,
        error: userResult.error,
      };
    }

    return this.reportIfFailed(
      await this.repository.create(userResult.data, data),
      'create'
    );
  }

  /**
   * Update draft inbox item
   */
  async update(
    id: string,
    data: UpdateInboxItemDTO
  ): Promise<DataResult<InboxItemViewEntity>> {
    const userResult = await this.getUserId();
    if (!userResult.success) {
      return {
        success: false,
        data: null,
        error: userResult.error,
      };
    }

    return this.repository.update(userResult.data, id, data);
  }

  // ============================================================================
  // BATCH OPERATIONS (Offline Sync - CTO Mandate)
  // ============================================================================

  /**
   * Batch create inbox items (for offline sync push)
   */
  async createBatch(
    items: CreateInboxItemDTO[]
  ): Promise<DataResult<InboxItemViewEntity[]>> {
    const userResult = await this.getUserId();
    if (!userResult.success) {
      return {
        success: false,
        data: null,
        error: userResult.error,
      };
    }

    return this.repository.createBatch(userResult.data, items);
  }

  /**
   * Batch update inbox items (for offline sync push)
   */
  async updateBatch(
    updates: Array<{ id: string; data: UpdateInboxItemDTO }>
  ): Promise<DataResult<InboxItemViewEntity[]>> {
    const userResult = await this.getUserId();
    if (!userResult.success) {
      return {
        success: false,
        data: null,
        error: userResult.error,
      };
    }

    return this.repository.updateBatch(userResult.data, updates);
  }

  // ============================================================================
  // PROMOTION OPERATIONS
  // ============================================================================

  /**
   * Promote inbox item to ledger
   */
  async promote(data: PromoteInboxItemDTO): Promise<DataResult<PromoteResult>> {
    const userResult = await this.getUserId();
    if (!userResult.success) {
      return {
        success: false,
        data: null,
        error: userResult.error,
      };
    }

    return this.reportIfFailed(
      await this.repository.promote(userResult.data, data),
      'promote'
    );
  }

  // ============================================================================
  // DISMISS OPERATIONS
  // ============================================================================

  /**
   * Dismiss (ignore) inbox item
   */
  async dismiss(id: string): Promise<DataResult<void>> {
    const userResult = await this.getUserId();
    if (!userResult.success) {
      return {
        success: false,
        data: null,
        error: userResult.error,
      };
    }

    return this.reportIfFailed(
      await this.repository.dismiss(userResult.data, id),
      'dismiss'
    );
  }
}

/**
 * Create Inbox Service
 *
 * Factory function for creating an inbox service instance.
 *
 * @param repository - Inbox repository implementation
 * @param authProvider - Auth provider implementation
 * @returns InboxService instance
 */
export function createInboxService(
  repository: IInboxRepository,
  authProvider: IAuthProvider
): IInboxService {
  return new InboxService(repository, authProvider);
}

// ============================================================================
// LEGACY SINGLETON (for backward compatibility)
// ============================================================================

import { createClient } from '@/lib/supabase/client';
import { SupabaseInboxRepository } from '../repository/supabase-inbox-repository';
import { createSupabaseAuthProvider } from '@/lib/auth/supabase-auth-provider';

/**
 * Singleton instance for legacy use
 * @deprecated Use createInboxService or useInboxService hook instead
 */
let inboxServiceInstance: InboxService | null = null;

/**
 * Get singleton inbox service instance
 * @deprecated Use createInboxService or useInboxService hook instead
 */
export function getInboxService(): InboxService {
  if (!inboxServiceInstance) {
    const supabase = createClient();
    const repository = new SupabaseInboxRepository(supabase);
    const authProvider = createSupabaseAuthProvider(supabase);
    inboxServiceInstance = new InboxService(repository, authProvider);
  }
  return inboxServiceInstance;
}

/**
 * Reset singleton instance (for testing only)
 * @internal
 */
export function resetInboxServiceInstance(): void {
  inboxServiceInstance = null;
}
