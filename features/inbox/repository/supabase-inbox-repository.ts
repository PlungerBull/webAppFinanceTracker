/**
 * Supabase Inbox Repository Implementation
 *
 * Web implementation of IInboxRepository using Supabase Client SDK.
 *
 * Key Patterns:
 * 1. INTEGER CENTS - Direct BIGINT pass-through (CTO Mandate)
 * 2. Write-then-Read for complete data
 * 3. DataResult<T> for explicit error handling
 * 4. Transaction-inbox view for joined data
 *
 * CRITICAL: Database stores BIGINT (integer cents), domain uses INTEGER CENTS
 * - Database: amount_cents = 1050 (BIGINT)
 * - Domain: amountCents = 1050 (INTEGER)
 * - Direct pass-through: Number(bigint)
 *
 * @module supabase-inbox-repository
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import type { IInboxRepository } from './inbox-repository.interface';
import type {
  DataResult,
  PaginatedResult,
  PaginationOptions,
  CreateInboxItemDTO,
  UpdateInboxItemDTO,
  PromoteInboxItemDTO,
  PromoteResult,
} from '../domain/types';
import {
  InboxNotFoundError,
  InboxRepositoryError,
  InboxPromotionError,
  VersionConflictError,
  InboxDomainError,
} from '../domain/errors';
import { dbInboxItemViewToDomain } from '@/lib/types/data-transformers';
import { validateOrThrow, validateArrayOrThrow } from '@/lib/types/validate';
import { TransactionInboxViewRowSchema } from '@/lib/types/db-row-schemas';
import type { InboxItemViewEntity } from '../domain/entities';

/**
 * Default pagination constants
 */
const DEFAULT_LIMIT = 20;

/**
 * Supabase Inbox Repository
 *
 * Implements inbox data access using Supabase Client SDK.
 * All methods return DataResult<T> (never throw exceptions).
 */
export class SupabaseInboxRepository implements IInboxRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) { }

  // ============================================================================
  // QUERY OPERATIONS
  // ============================================================================

  async getPendingPaginated(
    userId: string,
    pagination?: PaginationOptions
  ): Promise<DataResult<PaginatedResult<InboxItemViewEntity>>> {
    try {
      const offset = pagination?.offset ?? 0;
      const limit = pagination?.limit ?? DEFAULT_LIMIT;

      // Query from view for joined data
      const { data, error, count } = await this.supabase
        .from('transaction_inbox_view')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true }) // FIFO: oldest first
        .range(offset, offset + limit - 1);

      if (error) {
        return {
          success: false,
          data: null,
          error: new InboxRepositoryError(`Failed to fetch inbox items: ${error.message}`),
        };
      }

      const total = count ?? 0;
      const validatedData = validateArrayOrThrow(TransactionInboxViewRowSchema, data ?? [], 'TransactionInboxViewRow');
      const items = validatedData.map(row => this.dbViewToEntity(row));

      return {
        success: true,
        data: {
          data: items,
          total,
          offset,
          limit,
          hasMore: offset + items.length < total,
        },
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new InboxRepositoryError(
          err instanceof Error ? err.message : 'Unknown error fetching inbox items'
        ),
      };
    }
  }

  async getById(
    userId: string,
    id: string
  ): Promise<DataResult<InboxItemViewEntity>> {
    try {
      const { data, error } = await this.supabase
        .from('transaction_inbox_view')
        .select('*')
        .eq('user_id', userId)
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            success: false,
            data: null,
            error: new InboxNotFoundError(id),
          };
        }
        return {
          success: false,
          data: null,
          error: new InboxRepositoryError(`Failed to fetch inbox item: ${error.message}`),
        };
      }

      const validated = validateOrThrow(TransactionInboxViewRowSchema, data, 'TransactionInboxViewRow');
      return {
        success: true,
        data: this.dbViewToEntity(validated),
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new InboxRepositoryError(
          err instanceof Error ? err.message : 'Unknown error fetching inbox item'
        ),
      };
    }
  }

  // ============================================================================
  // WRITE OPERATIONS
  // ============================================================================

  async create(
    userId: string,
    data: CreateInboxItemDTO
  ): Promise<DataResult<InboxItemViewEntity>> {
    try {
      // Insert into table
      const { data: inserted, error: insertError } = await this.supabase
        .from('transaction_inbox')
        .insert({
          user_id: userId,
          amount_cents: data.amountCents ?? null,
          description: data.description ?? null,
          date: data.date ?? null,
          source_text: data.sourceText ?? null,
          account_id: data.accountId ?? null,
          category_id: data.categoryId ?? null,
          notes: data.notes ?? null,
          status: 'pending',
        })
        .select('id')
        .single();

      if (insertError || !inserted) {
        return {
          success: false,
          data: null,
          error: new InboxRepositoryError(`Failed to create inbox item: ${insertError?.message}`),
        };
      }

      // Read back from view for complete data
      return this.getById(userId, inserted.id);
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new InboxRepositoryError(
          err instanceof Error ? err.message : 'Unknown error creating inbox item'
        ),
      };
    }
  }

  async update(
    userId: string,
    id: string,
    data: UpdateInboxItemDTO
  ): Promise<DataResult<InboxItemViewEntity>> {
    try {
      // Build update object with only defined fields
      const dbUpdates: Database['public']['Tables']['transaction_inbox']['Update'] = {};

      if (data.amountCents !== undefined) dbUpdates.amount_cents = data.amountCents;
      if (data.description !== undefined) dbUpdates.description = data.description;
      if (data.date !== undefined) dbUpdates.date = data.date;
      if (data.accountId !== undefined) dbUpdates.account_id = data.accountId;
      if (data.categoryId !== undefined) dbUpdates.category_id = data.categoryId;
      if (data.exchangeRate !== undefined) dbUpdates.exchange_rate = data.exchangeRate;
      if (data.notes !== undefined) dbUpdates.notes = data.notes;

      // Optimistic Concurrency Control
      let query = this.supabase
        .from('transaction_inbox')
        .update(dbUpdates)
        .eq('id', id)
        .eq('user_id', userId);

      // If lastKnownVersion is provided, enforce it
      if (data.lastKnownVersion !== undefined) {
        query = query.eq('version', data.lastKnownVersion);
      }

      const { data: updatedRows, error: updateError } = await query.select();

      if (updateError) {
        return {
          success: false,
          data: null,
          error: new InboxRepositoryError(`Failed to update inbox item: ${updateError.message}`),
        };
      }

      // If no rows updated, check why
      if (!updatedRows || updatedRows.length === 0) {
        // Fetch the item to distinguish between Not Found and Version Conflict
        const { data: currentItem } = await this.supabase
          .from('transaction_inbox')
          .select('version')
          .eq('id', id)
          .eq('user_id', userId)
          .single();

        if (!currentItem) {
          return {
            success: false,
            data: null,
            error: new InboxNotFoundError(id),
          };
        }

        // Item exists, so it must be a version conflict
        return {
          success: false,
          data: null,
          error: new VersionConflictError(id, data.lastKnownVersion ?? -1, (currentItem as any).version),
        };
      }

      // Read back from view for complete data (using ID from updated row)
      return this.getById(userId, id);
    } catch (err) {
      return {
        success: false,
        data: null,
        error: err instanceof InboxDomainError ? err : new InboxRepositoryError(
          err instanceof Error ? err.message : 'Unknown error updating inbox item'
        ),
      };
    }
  }

  // ============================================================================
  // BATCH OPERATIONS (Offline Sync - CTO Mandate)
  // ============================================================================

  /**
   * Batch create inbox items (for offline sync push)
   *
   * Implementation Note:
   * Current implementation loops through individual create() calls.
   * TODO: Replace with single RPC for atomic batch insert when sync engine is ready.
   *
   * @param userId - User ID (UUID)
   * @param items - Array of inbox items to create
   * @returns DataResult with array of created inbox items or first error encountered
   */
  async createBatch(
    userId: string,
    items: CreateInboxItemDTO[]
  ): Promise<DataResult<InboxItemViewEntity[]>> {
    try {
      const createdItems: InboxItemViewEntity[] = [];

      for (const item of items) {
        const result = await this.create(userId, item);

        if (!result.success) {
          // Return first error encountered
          // Future RPC will handle atomicity (all-or-nothing)
          return {
            success: false,
            data: null,
            error: new InboxRepositoryError(
              `Batch create failed at item ${createdItems.length + 1}: ${result.error.message}`
            ),
          };
        }

        createdItems.push(result.data);
      }

      return {
        success: true,
        data: createdItems,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new InboxRepositoryError(
          err instanceof Error ? err.message : 'Unknown error in batch create'
        ),
      };
    }
  }

  /**
   * Batch update inbox items (for offline sync push)
   *
   * Implementation Note:
   * Current implementation loops through individual update() calls.
   * TODO: Replace with single RPC for atomic batch update when sync engine is ready.
   *
   * @param userId - User ID (UUID)
   * @param updates - Array of {id, data} update pairs
   * @returns DataResult with array of updated inbox items or first error encountered
   */
  async updateBatch(
    userId: string,
    updates: Array<{ id: string; data: UpdateInboxItemDTO }>
  ): Promise<DataResult<InboxItemViewEntity[]>> {
    try {
      const updatedItems: InboxItemViewEntity[] = [];

      for (const { id, data } of updates) {
        const result = await this.update(userId, id, data);

        if (!result.success) {
          // Return first error encountered
          // Future RPC will handle atomicity (all-or-nothing)
          return {
            success: false,
            data: null,
            error: result.error instanceof VersionConflictError
              ? result.error // Preserve version conflict errors
              : new InboxRepositoryError(
                  `Batch update failed at item ${updatedItems.length + 1} (${id}): ${result.error.message}`
                ),
          };
        }

        updatedItems.push(result.data);
      }

      return {
        success: true,
        data: updatedItems,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new InboxRepositoryError(
          err instanceof Error ? err.message : 'Unknown error in batch update'
        ),
      };
    }
  }

  // ============================================================================
  // PROMOTION OPERATIONS
  // ============================================================================

  async promote(
    userId: string,
    data: PromoteInboxItemDTO
  ): Promise<DataResult<PromoteResult>> {
    try {
      // Call the promote_inbox_item RPC
      // Convert null to undefined for optional parameters (RPC expects undefined, not null)
      const { data: result, error } = await this.supabase.rpc('promote_inbox_item', {
        p_inbox_id: data.inboxId,
        p_account_id: data.accountId,
        p_category_id: data.categoryId,
        p_final_description: data.finalDescription ?? undefined,
        p_final_date: data.finalDate ?? undefined,
        p_final_amount_cents: data.finalAmountCents ?? undefined,
        p_exchange_rate: data.exchangeRate ?? undefined,
        p_expected_version: data.lastKnownVersion ?? undefined, // Pass version for check
      });

      if (error) {
        // Check for custom version conflict code (P0001) or message
        if (error.code === 'P0001' || error.message.includes('Version conflict')) {
          // We don't have the actual version here easily without a separate fetch, 
          // so we pass -1 as actual. The UI should refresh regardless.
          return {
            success: false,
            data: null,
            error: new VersionConflictError(data.inboxId, data.lastKnownVersion ?? -1, -1)
          };
        }

        return {
          success: false,
          data: null,
          error: new InboxPromotionError(`Failed to promote inbox item: ${error.message}`),
        };
      }

      // RPC returns the transaction_id
      const transactionId = result as string;

      return {
        success: true,
        data: {
          transactionId,
          inboxId: data.inboxId,
        },
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new InboxPromotionError(
          err instanceof Error ? err.message : 'Unknown error promoting inbox item'
        ),
      };
    }
  }

  // ============================================================================
  // DISMISS OPERATIONS
  // ============================================================================

  async dismiss(userId: string, id: string): Promise<DataResult<void>> {
    try {
      const { error } = await this.supabase
        .from('transaction_inbox')
        .update({
          status: 'ignored',
          deleted_at: new Date().toISOString() // Tombstone
        })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        return {
          success: false,
          data: null,
          error: new InboxRepositoryError(`Failed to dismiss inbox item: ${error.message}`),
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
        error: new InboxRepositoryError(
          err instanceof Error ? err.message : 'Unknown error dismissing inbox item'
        ),
      };
    }
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Transforms database view row to domain entity
   *
   * Uses the shared transformer from data-transformers.ts
   * The transformer handles BIGINT → number conversion for amount_cents
   */
  private dbViewToEntity(
    row: Database['public']['Views']['transaction_inbox_view']['Row']
  ): InboxItemViewEntity {
    // dbInboxItemViewToDomain already returns the correct InboxItemViewEntity shape
    return dbInboxItemViewToDomain(row);
  }
}
