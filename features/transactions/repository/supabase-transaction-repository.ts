/**
 * Supabase Transaction Repository Implementation
 *
 * Web implementation of ITransactionRepository using Supabase Client SDK.
 *
 * Key Patterns:
 * 1. Decimal → Integer Cents Conversion (CTO Mandate #3)
 * 2. Write-then-Read for complete data
 * 3. DataResult<T> for explicit error handling
 * 4. Strict ISO 8601 validation
 *
 * CRITICAL: Database stores BIGINT (integer cents), domain uses INTEGER CENTS
 * - Database: amount_cents = 1050 (BIGINT)
 * - Domain: amountCents = 1050 (INTEGER)
 * - Direct pass-through: Number(bigint)
 * - After Move 0 migration (20260119000000_ledger_bigint_standardization.sql)
 *
 * @module supabase-transaction-repository
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import type { ITransactionRepository } from './transaction-repository.interface';
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
import {
  TransactionError,
  TransactionNotFoundError,
  TransactionVersionConflictError,
  TransactionRepositoryError,
  TransactionValidationError,
} from '../domain/errors';
import { validateISODate } from '@/lib/utils/date-validation';
import { TRANSACTION_VALIDATION, TRANSACTION_ERRORS } from '../domain/constants';

/**
 * Supabase Transaction Repository
 *
 * Implements transaction data access using Supabase Client SDK.
 * All methods return DataResult<T> (never throw exceptions).
 */
export class SupabaseTransactionRepository implements ITransactionRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * PITFALL #2 ELIMINATED: No conversion needed - Direct BIGINT pass-through
   *
   * CTO Mandate #3: Sacred Integer Arithmetic AT DATABASE LEVEL
   * - Database: 1050 (BIGINT)
   * - Domain: 1050 (INTEGER CENTS)
   * - No conversion, no float multiplication, no precision loss
   *
   * The "Split Brain" is eliminated - database and domain speak the same language.
   * After Move 0 migration (20260119000000_ledger_bigint_standardization.sql),
   * the transactions table stores amounts as BIGINT integer cents directly.
   *
   * All INSERT/UPDATE operations now pass integer cents directly.
   * All SELECT operations read integer cents directly via Number() cast.
   */

  /**
   * Transforms database transactions_view row to domain entity
   *
   * CRITICAL: Direct BIGINT pass-through - NO conversion
   * - Database: amount_cents (BIGINT) → amountCents (number)
   * - Database: amount_home_cents (BIGINT) → amountHomeCents (number)
   *
   * After Move 0 migration, the database stores INTEGER CENTS directly.
   */
  private dbTransactionViewToDomain(
    dbView: Database['public']['Views']['transactions_view']['Row']
  ): TransactionViewEntity {
    return {
      // IDs
      id: dbView.id || '',
      version: dbView.version ?? 1,
      userId: dbView.user_id || '',
      accountId: dbView.account_id || '',
      categoryId: dbView.category_id,

      // SACRED INTEGER ARITHMETIC: Direct BIGINT pass-through
      amountCents: Number(dbView.amount_cents ?? 0),
      amountHomeCents: Number(dbView.amount_home_cents ?? 0),

      // Currency and exchange
      currencyOriginal: dbView.currency_original || 'USD',
      exchangeRate: Number(dbView.exchange_rate ?? 1),

      // Transfer and reconciliation
      transferId: dbView.transfer_id,
      reconciliationId: dbView.reconciliation_id,
      cleared: dbView.cleared ?? false,

      // Dates (strict ISO 8601)
      date: dbView.date || new Date().toISOString(),
      createdAt: dbView.created_at || new Date().toISOString(),
      updatedAt: dbView.updated_at || new Date().toISOString(),
      deletedAt: dbView.deleted_at,

      // Text fields
      description: dbView.description,
      notes: dbView.notes,
      sourceText: dbView.source_text,
      inboxId: dbView.inbox_id,

      // Joined data from view
      accountName: dbView.account_name || 'Unknown Account',
      accountCurrency: dbView.account_currency || 'USD',
      accountColor: dbView.account_color,
      categoryName: dbView.category_name,
      categoryColor: dbView.category_color,
      categoryType: dbView.category_type as 'income' | 'expense' | 'opening_balance' | null,
      reconciliationStatus: dbView.reconciliation_status as 'draft' | 'completed' | null,
    };
  }

  /**
   * Batch transformer for arrays
   */
  private dbTransactionViewsToDomain(
    dbViews: Database['public']['Views']['transactions_view']['Row'][]
  ): TransactionViewEntity[] {
    return dbViews.map((view) => this.dbTransactionViewToDomain(view));
  }

  /**
   * Applies transaction filters to Supabase query
   */
  private applyFilters(
    query: any,
    filters?: TransactionFilters
  ): any {
    let result = query;

    // Filter: Single account
    if (filters?.accountId) {
      result = result.eq('account_id', filters.accountId);
    }

    // Filter: Single category
    if (filters?.categoryId) {
      result = result.eq('category_id', filters.categoryId);
    }

    // Filter: Date range
    if (filters?.startDate) {
      result = result.gte('date', filters.startDate);
    }
    if (filters?.endDate) {
      result = result.lte('date', filters.endDate);
    }

    // Filter: Amount range (convert cents → decimal for database query)
    if (filters?.minAmountCents !== undefined) {
      result = result.gte('amount_cents', filters.minAmountCents);
    }
    if (filters?.maxAmountCents !== undefined) {
      result = result.lte('amount_cents', filters.maxAmountCents);
    }

    // Filter: Search query (matches description or notes)
    if (filters?.searchQuery) {
      result = result.or(`description.ilike.%${filters.searchQuery}%,notes.ilike.%${filters.searchQuery}%`);
    }

    // Filter: Cleared status
    if (filters?.cleared !== undefined) {
      result = result.eq('cleared', filters.cleared);
    }

    // Filter: Transfer ID
    if (filters?.transferId) {
      result = result.eq('transfer_id', filters.transferId);
    }

    // Filter: Reconciliation ID
    if (filters?.reconciliationId) {
      result = result.eq('reconciliation_id', filters.reconciliationId);
    }

    // Filter: Include deleted (by default, view excludes deleted)
    if (filters?.includeDeleted) {
      // Need to query transactions table directly (not view)
      // View already filters WHERE deleted_at IS NULL
      // This is for future sync functionality
    }

    return result;
  }

  // ============================================================================
  // QUERY OPERATIONS (Read)
  // ============================================================================

  async getAllPaginated(
    userId: string,
    filters?: TransactionFilters,
    pagination?: PaginationOptions
  ): Promise<DataResult<PaginatedResult<TransactionViewEntity>>> {
    try {
      const { offset = 0, limit = 50 } = pagination || {};

      // Query transactions_view with filters
      let query = this.supabase
        .from('transactions_view')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)  // Explicit user filtering (even with RLS)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })  // Tie-breaker
        .range(offset, offset + limit - 1);

      // Apply filters
      query = this.applyFilters(query, filters);

      const { data, error, count } = await query;

      if (error) {
        return {
          success: false,
          data: null,
          error: new TransactionRepositoryError(`Failed to fetch transactions: ${error.message}`),
        };
      }

      return {
        success: true,
        data: {
          data: this.dbTransactionViewsToDomain(data || []),
          total: count || 0,
          offset,
          limit,
          hasMore: (count || 0) > offset + limit,
        },
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new TransactionRepositoryError(`Unexpected error: ${(err as Error).message}`),
      };
    }
  }

  async getById(
    userId: string,
    id: string
  ): Promise<DataResult<TransactionViewEntity>> {
    try {
      const { data, error } = await this.supabase
        .from('transactions_view')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)  // Explicit user filtering
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            success: false,
            data: null,
            error: new TransactionNotFoundError(id),
          };
        }
        return {
          success: false,
          data: null,
          error: new TransactionRepositoryError(`Failed to fetch transaction: ${error.message}`),
        };
      }

      return {
        success: true,
        data: this.dbTransactionViewToDomain(data),
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new TransactionRepositoryError(`Unexpected error: ${(err as Error).message}`),
      };
    }
  }

  async getCategoryCounts(
    userId: string,
    filters?: TransactionFilters
  ): Promise<DataResult<CategoryCounts>> {
    try {
      let query = this.supabase
        .from('transactions_view')
        .select('category_id')
        .eq('user_id', userId);

      // Apply filters (excluding category filter itself)
      query = this.applyFilters(query, { ...filters, categoryId: undefined });

      const { data, error } = await query;

      if (error) {
        return {
          success: false,
          data: null,
          error: new TransactionRepositoryError(`Failed to fetch category counts: ${error.message}`),
        };
      }

      // Aggregate counts
      const counts: CategoryCounts = {};
      data?.forEach((row) => {
        const categoryId = row.category_id || 'uncategorized';
        counts[categoryId] = (counts[categoryId] || 0) + 1;
      });

      return {
        success: true,
        data: counts,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new TransactionRepositoryError(`Unexpected error: ${(err as Error).message}`),
      };
    }
  }

  // ============================================================================
  // WRITE OPERATIONS (Create, Update, Delete)
  // ============================================================================

  async create(
    userId: string,
    transactionId: string,
    data: CreateTransactionDTO
  ): Promise<DataResult<TransactionViewEntity>> {
    try {
      // Validate date format (CTO Mandate #4)
      if (!validateISODate(data.date)) {
        return {
          success: false,
          data: null,
          error: new TransactionValidationError(TRANSACTION_ERRORS.INVALID_DATE_FORMAT),
        };
      }

      // Validate amount range
      if (data.amountCents > TRANSACTION_VALIDATION.MAX_AMOUNT_CENTS) {
        return {
          success: false,
          data: null,
          error: new TransactionValidationError(TRANSACTION_ERRORS.AMOUNT_TOO_LARGE),
        };
      }
      if (data.amountCents < TRANSACTION_VALIDATION.MIN_AMOUNT_CENTS) {
        return {
          success: false,
          data: null,
          error: new TransactionValidationError(TRANSACTION_ERRORS.AMOUNT_TOO_SMALL),
        };
      }

      // Insert into transactions table
      // Convert INTEGER CENTS → NUMERIC for database
      const { error: insertError } = await this.supabase
        .from('transactions')
        .insert({
          id: transactionId,
          user_id: userId,
          account_id: data.accountId,
          category_id: data.categoryId || null,
          amount_cents: data.amountCents,  // Direct BIGINT insert
          // amount_home calculated by trigger
          exchange_rate: 1,  // Default (trigger may override)
          date: data.date,
          description: data.description || null,
          notes: data.notes || null,
          source_text: data.sourceText || null,
          inbox_id: data.inboxId || null,
        });

      if (insertError) {
        return {
          success: false,
          data: null,
          error: new TransactionRepositoryError(`Failed to create transaction: ${insertError.message}`),
        };
      }

      // Write-then-Read: Fetch from view to get complete data
      return this.getById(userId, transactionId);
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new TransactionRepositoryError(`Unexpected error: ${(err as Error).message}`),
      };
    }
  }

  async update(
    userId: string,
    id: string,
    data: UpdateTransactionDTO
  ): Promise<DataResult<TransactionViewEntity>> {
    try {
      // Validate date format
      if (!validateISODate(data.date)) {
        return {
          success: false,
          data: null,
          error: new TransactionValidationError(TRANSACTION_ERRORS.INVALID_DATE_FORMAT),
          conflict: false,
        };
      }

      // Use version-checked RPC function
      const { data: rpcData, error: rpcError } = await this.supabase.rpc(
        'update_transaction_with_version',
        {
          p_transaction_id: id,
          p_expected_version: data.version,
          p_updates: {
            accountId: data.accountId,
            amountCents: data.amountCents,  // Direct BIGINT update
            categoryId: data.categoryId || null,
            date: data.date,
            description: data.description || null,
            notes: data.notes || null,
            exchangeRate: 1,  // TODO: Get from exchange rate service
          },
        }
      );

      if (rpcError) {
        return {
          success: false,
          data: null,
          error: new TransactionRepositoryError(`Failed to update transaction: ${rpcError.message}`),
        };
      }

      const result = rpcData as { success: boolean; error?: string };

      // Check for version conflict
      if (!result.success && result.error === 'version_conflict') {
        return {
          success: false,
          data: null,
          error: new TransactionVersionConflictError(id, data.version),
          conflict: true,
        };
      }

      // Check for not found
      if (!result.success && result.error === 'not_found') {
        return {
          success: false,
          data: null,
          error: new TransactionNotFoundError(id),
        };
      }

      // Other error
      if (!result.success) {
        return {
          success: false,
          data: null,
          error: new TransactionRepositoryError(`Update failed: ${result.error}`),
        };
      }

      // Success - fetch updated transaction
      return this.getById(userId, id);
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new TransactionRepositoryError(`Unexpected error: ${(err as Error).message}`),
      };
    }
  }

  async updateBatch(
    userId: string,
    id: string,
    updates: Partial<CreateTransactionDTO>,
    version: number
  ): Promise<DataResult<TransactionViewEntity>> {
    // Convert to UpdateTransactionDTO with version
    // Get current transaction first to fill in missing fields
    const currentResult = await this.getById(userId, id);
    if (!currentResult.success) {
      return currentResult;
    }

    const current = currentResult.data;

    // Build full update DTO
    const fullUpdate: UpdateTransactionDTO = {
      accountId: updates.accountId ?? current.accountId,
      amountCents: updates.amountCents ?? current.amountCents,
      date: updates.date ?? current.date,
      categoryId: updates.categoryId !== undefined ? updates.categoryId : current.categoryId,
      description: updates.description !== undefined ? updates.description : current.description,
      notes: updates.notes !== undefined ? updates.notes : current.notes,
      version,
    };

    return this.update(userId, id, fullUpdate);
  }

  async bulkUpdate(
    userId: string,
    data: BulkUpdateTransactionDTO
  ): Promise<DataResult<BulkUpdateResult>> {
    // TODO: Implement bulk update with version checking
    // This requires a new RPC function in the database
    return {
      success: false,
      data: null,
      error: new TransactionRepositoryError('Bulk update not yet implemented'),
    };
  }

  // ============================================================================
  // SOFT DELETE OPERATIONS
  // ============================================================================

  async delete(
    userId: string,
    id: string,
    version: number
  ): Promise<DataResult<void>> {
    try {
      // Use version-checked soft delete RPC
      const { data: rpcData, error: rpcError } = await this.supabase.rpc(
        'delete_transaction_with_version',
        {
          p_transaction_id: id,
          p_expected_version: version,
        }
      );

      if (rpcError) {
        return {
          success: false,
          data: null,
          error: new TransactionRepositoryError(`Failed to delete transaction: ${rpcError.message}`),
        };
      }

      const result = rpcData as { success: boolean; error?: string };

      // Check for version conflict
      if (!result.success && result.error === 'version_conflict') {
        return {
          success: false,
          data: null,
          error: new TransactionVersionConflictError(id, version),
          conflict: true,
        };
      }

      // Check for not found
      if (!result.success && result.error === 'not_found') {
        return {
          success: false,
          data: null,
          error: new TransactionNotFoundError(id),
        };
      }

      // Other error
      if (!result.success) {
        return {
          success: false,
          data: null,
          error: new TransactionRepositoryError(`Delete failed: ${result.error}`),
        };
      }

      return {
        success: true,
        data: undefined as any,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new TransactionRepositoryError(`Unexpected error: ${(err as Error).message}`),
      };
    }
  }

  async restore(
    userId: string,
    id: string
  ): Promise<DataResult<TransactionViewEntity>> {
    try {
      // Use restore RPC function
      const { data: rpcData, error: rpcError } = await this.supabase.rpc(
        'restore_transaction',
        {
          p_transaction_id: id,
        }
      );

      if (rpcError) {
        return {
          success: false,
          data: null,
          error: new TransactionRepositoryError(`Failed to restore transaction: ${rpcError.message}`),
        };
      }

      const result = rpcData as { success: boolean; error?: string };

      if (!result.success) {
        return {
          success: false,
          data: null,
          error: new TransactionRepositoryError(`Restore failed: ${result.error}`),
        };
      }

      // Fetch restored transaction
      return this.getById(userId, id);
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new TransactionRepositoryError(`Unexpected error: ${(err as Error).message}`),
      };
    }
  }

  async getDeleted(
    userId: string,
    sinceVersion?: number
  ): Promise<DataResult<SyncResponse<TransactionViewEntity[]>>> {
    try {
      // Use get_deleted_transactions RPC function
      const { data: rpcData, error: rpcError } = await this.supabase.rpc(
        'get_deleted_transactions',
        {
          p_user_id: userId,
          p_since_version: sinceVersion || 0,
        }
      );

      if (rpcError) {
        return {
          success: false,
          data: null,
          error: new TransactionRepositoryError(`Failed to fetch deleted transactions: ${rpcError.message}`),
        };
      }

      // Transform to domain entities
      const deletedTransactions = this.dbTransactionViewsToDomain(
        (rpcData as Database['public']['Views']['transactions_view']['Row'][]) || []
      );

      // Get current server version from max version in results
      // TODO: Create dedicated RPC for getting global version
      const currentServerVersion = deletedTransactions.length > 0
        ? Math.max(...deletedTransactions.map(t => t.version))
        : 0;

      return {
        success: true,
        data: {
          data: deletedTransactions,
          currentServerVersion,
          hasMore: false,  // TODO: Implement pagination for large result sets
        },
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: new TransactionRepositoryError(`Unexpected error: ${(err as Error).message}`),
      };
    }
  }

  // ============================================================================
  // DELTA SYNC OPERATIONS (Future - Phase 2)
  // ============================================================================

  async getChangesSince(
    userId: string,
    sinceVersion: number
  ): Promise<DataResult<SyncResponse<TransactionChanges>>> {
    // TODO: Implement delta sync
    return {
      success: false,
      data: null,
      error: new TransactionRepositoryError('Delta sync not yet implemented'),
    };
  }

  async permanentlyDelete(
    userId: string,
    id: string
  ): Promise<DataResult<void>> {
    // TODO: Implement permanent delete (ADMIN ONLY)
    return {
      success: false,
      data: null,
      error: new TransactionRepositoryError('Permanent delete not yet implemented'),
    };
  }
}
