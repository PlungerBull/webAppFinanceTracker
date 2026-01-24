/**
 * Inbox Service
 *
 * Service layer for inbox operations.
 * Handles authentication and delegates to repository.
 *
 * Pattern:
 * - Gets userId from Supabase auth
 * - Calls repository methods with userId
 * - Returns DataResult<T> (no throwing)
 *
 * TODO [iOS Migration]: Replace singleton pattern with constructor injection.
 * iOS SwiftUI should use @EnvironmentObject or protocol-based DI container.
 * The getInboxService() function is a web convenience; Swift should inject
 * InboxService via init(repository: IInboxRepository) for testability.
 *
 * @module inbox-service
 */

import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/supabase';
import { SupabaseInboxRepository } from '../repository/supabase-inbox-repository';
import type { IInboxRepository } from '../repository/inbox-repository.interface';
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
 * Inbox Service
 *
 * Provides authenticated access to inbox operations.
 * All methods return DataResult<T> for explicit error handling.
 */
export class InboxService {
  private repository: IInboxRepository;
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.supabase = createClient();
    this.repository = new SupabaseInboxRepository(this.supabase);
  }

  /**
   * Get current user ID from Supabase auth
   */
  private async getUserId(): Promise<DataResult<string>> {
    try {
      const { data: { user }, error } = await this.supabase.auth.getUser();

      if (error || !user) {
        return {
          success: false,
          data: null,
          error: new InboxRepositoryError('Not authenticated'),
        };
      }

      return {
        success: true,
        data: user.id,
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

    return this.repository.create(userResult.data, data);
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

    return this.repository.promote(userResult.data, data);
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

    return this.repository.dismiss(userResult.data, id);
  }
}

/**
 * Singleton instance for use in hooks
 */
let inboxServiceInstance: InboxService | null = null;

export function getInboxService(): InboxService {
  if (!inboxServiceInstance) {
    inboxServiceInstance = new InboxService();
  }
  return inboxServiceInstance;
}
