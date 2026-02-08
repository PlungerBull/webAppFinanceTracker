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
import { dbInboxItemViewToDomain } from '@/lib/data/data-transformers';
import { validateOrThrow, validateArrayOrThrow } from '@/lib/data/validate';
import { TransactionInboxViewRowSchema } from '@/lib/data/db-row-schemas';
import type { InboxItemViewEntity } from '@/domain/inbox';
import { z } from 'zod';

/**
 * Schema for version-only query result (used in conflict detection)
 */
const VersionCheckSchema = z.object({
  version: z.number().int().min(0),
});

/**
 * Schema for version-checked RPC response (update_inbox_with_version, dismiss_inbox_with_version)
 */
const VersionRpcResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  newVersion: z.number().int().optional(),
  expectedVersion: z.number().int().optional(),
  currentVersion: z.number().int().optional(),
  currentData: z.object({
    description: z.string().nullable().optional(),
    amountCents: z.number().nullable().optional(),
    date: z.string().nullable().optional(),
  }).optional(),
  message: z.string().optional(),
});

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
      // Version is required for OCC - if not provided, fetch current version first
      let expectedVersion = data.lastKnownVersion;

      if (expectedVersion === undefined) {
        // Fetch current version for backwards compatibility
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
        const validated = validateOrThrow(VersionCheckSchema, currentItem, 'VersionCheck');
        expectedVersion = validated.version;
      }

      // Build JSONB updates object for RPC (only include defined fields)
      // RPC uses COALESCE so null means "keep existing value"
      const updates: {
        amount_cents?: number | null;
        description?: string | null;
        date?: string | null;
        account_id?: string | null;
        category_id?: string | null;
        exchange_rate?: number | null;
        notes?: string | null;
      } = {};

      if (data.amountCents !== undefined) updates.amount_cents = data.amountCents;
      if (data.description !== undefined) updates.description = data.description;
      if (data.date !== undefined) updates.date = data.date;
      if (data.accountId !== undefined) updates.account_id = data.accountId;
      if (data.categoryId !== undefined) updates.category_id = data.categoryId;
      if (data.exchangeRate !== undefined) updates.exchange_rate = data.exchangeRate;
      if (data.notes !== undefined) updates.notes = data.notes;

      // Call version-checked RPC (SYNC-01: S-Tier OCC)
      const { data: rpcResult, error: rpcError } = await this.supabase
        .rpc('update_inbox_with_version', {
          p_inbox_id: id,
          p_expected_version: expectedVersion,
          p_updates: updates,
        });

      if (rpcError) {
        return {
          success: false,
          data: null,
          error: new InboxRepositoryError(`Failed to update inbox item: ${rpcError.message}`),
        };
      }

      // Validate RPC response
      const validated = validateOrThrow(VersionRpcResponseSchema, rpcResult, 'UpdateInboxRpc');

      if (!validated.success) {
        // Handle specific error types
        if (validated.error === 'not_found') {
          return {
            success: false,
            data: null,
            error: new InboxNotFoundError(id),
          };
        }

        if (validated.error === 'version_conflict') {
          return {
            success: false,
            data: null,
            error: new VersionConflictError(
              id,
              expectedVersion,
              validated.currentVersion ?? -1
            ),
          };
        }

        // Generic error (concurrent_modification or unknown)
        return {
          success: false,
          data: null,
          error: new InboxRepositoryError(
            validated.message ?? 'Failed to update inbox item due to concurrent modification'
          ),
        };
      }

      // Read back from view for complete data
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
          // Parse actual server version from PostgreSQL error:
          // "Version conflict: Expected version X, but found Y."
          const versionMatch = error.message.match(/but found (\d+)/);
          const actualVersion = versionMatch ? parseInt(versionMatch[1], 10) : -1;
          return {
            success: false,
            data: null,
            error: new VersionConflictError(data.inboxId, data.lastKnownVersion ?? -1, actualVersion)
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
      // Fetch current version for OCC (SYNC-01: S-Tier)
      const { data: currentItem } = await this.supabase
        .from('transaction_inbox')
        .select('version')
        .eq('id', id)
        .eq('user_id', userId)
        .is('deleted_at', null) // Only active items
        .single();

      if (!currentItem) {
        return {
          success: false,
          data: null,
          error: new InboxNotFoundError(id),
        };
      }

      const validated = validateOrThrow(VersionCheckSchema, currentItem, 'VersionCheck');

      // Call version-checked RPC (SYNC-01: S-Tier OCC)
      const { data: rpcResult, error: rpcError } = await this.supabase
        .rpc('dismiss_inbox_with_version', {
          p_inbox_id: id,
          p_expected_version: validated.version,
        });

      if (rpcError) {
        return {
          success: false,
          data: null,
          error: new InboxRepositoryError(`Failed to dismiss inbox item: ${rpcError.message}`),
        };
      }

      // Validate RPC response
      const rpcValidated = validateOrThrow(VersionRpcResponseSchema, rpcResult, 'DismissInboxRpc');

      if (!rpcValidated.success) {
        // Handle specific error types
        if (rpcValidated.error === 'not_found') {
          return {
            success: false,
            data: null,
            error: new InboxNotFoundError(id),
          };
        }

        if (rpcValidated.error === 'version_conflict') {
          return {
            success: false,
            data: null,
            error: new VersionConflictError(
              id,
              validated.version,
              rpcValidated.currentVersion ?? -1
            ),
          };
        }

        // Generic error (concurrent_modification or unknown)
        return {
          success: false,
          data: null,
          error: new InboxRepositoryError(
            rpcValidated.message ?? 'Failed to dismiss inbox item due to concurrent modification'
          ),
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
