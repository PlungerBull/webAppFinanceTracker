/**
 * Supabase Reconciliations Repository
 *
 * Data access layer for reconciliation operations.
 * Handles Supabase queries, validation, and error mapping.
 * Returns DataResult for S-Tier error handling.
 *
 * @module features/reconciliations/repository
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DataResult } from '@/lib/data-patterns';
import type { Reconciliation, ReconciliationSummary } from '@/domain/reconciliations';
import {
  dbReconciliationToDomain,
  dbReconciliationsToDomain,
  domainReconciliationToDbInsert,
  domainReconciliationToDbUpdate,
  dbReconciliationSummaryToDomain,
} from '@/lib/data/data-transformers';
import { validateOrThrow, validateArrayOrThrow } from '@/lib/data/validate';
import {
  ReconciliationRowSchema,
  ReconciliationSummaryRpcSchema,
  LinkUnlinkRpcSchema,
} from '@/lib/data/db-row-schemas';
import { reportError } from '@/lib/sentry/reporter';
import {
  ReconciliationRepositoryError,
  ReconciliationNotFoundError,
  ReconciliationVersionConflictError,
  ReconciliationCompletedError,
  ReconciliationLinkError,
} from '../domain/errors';
import type {
  IReconciliationsRepository,
  LinkUnlinkResult,
  CreateReconciliationInput,
  UpdateReconciliationInput,
} from './reconciliations-repository.interface';

export class SupabaseReconciliationsRepository implements IReconciliationsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getAll(accountId?: string): Promise<DataResult<Reconciliation[], ReconciliationRepositoryError>> {
    try {
      let query = this.supabase
        .from('reconciliations')
        .select('*')
        .is('deleted_at', null) // Tombstone filter: only active reconciliations
        .order('created_at', { ascending: false });

      if (accountId) {
        query = query.eq('account_id', accountId);
      }

      const { data, error } = await query;

      if (error) {
        return {
          success: false,
          data: null,
          error: new ReconciliationRepositoryError(
            error.message || 'Failed to fetch reconciliations',
            error
          ),
        };
      }

      const validated = validateArrayOrThrow(
        ReconciliationRowSchema,
        data ?? [],
        'ReconciliationRow'
      );
      return {
        success: true,
        data: dbReconciliationsToDomain(validated),
      };
    } catch (err) {
      reportError(
        err instanceof Error ? err : new Error(String(err)),
        'reconciliations',
        { operation: 'getAll', accountId }
      );
      return {
        success: false,
        data: null,
        error: new ReconciliationRepositoryError(
          'Unexpected error fetching reconciliations',
          err
        ),
      };
    }
  }

  async getById(
    id: string
  ): Promise<DataResult<Reconciliation, ReconciliationRepositoryError | ReconciliationNotFoundError>> {
    try {
      const { data, error } = await this.supabase
        .from('reconciliations')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null) // Tombstone filter: only active reconciliations
        .single();

      if (error) {
        // PGRST116 = "JSON object requested, multiple (or no) rows returned"
        if (error.code === 'PGRST116') {
          return {
            success: false,
            data: null,
            error: new ReconciliationNotFoundError(id, error),
          };
        }
        return {
          success: false,
          data: null,
          error: new ReconciliationRepositoryError(
            error.message || 'Failed to fetch reconciliation',
            error
          ),
        };
      }

      const validated = validateOrThrow(ReconciliationRowSchema, data, 'ReconciliationRow');
      return {
        success: true,
        data: dbReconciliationToDomain(validated),
      };
    } catch (err) {
      reportError(
        err instanceof Error ? err : new Error(String(err)),
        'reconciliations',
        { operation: 'getById', id }
      );
      return {
        success: false,
        data: null,
        error: new ReconciliationRepositoryError(
          'Unexpected error fetching reconciliation',
          err
        ),
      };
    }
  }

  async create(
    data: CreateReconciliationInput
  ): Promise<DataResult<Reconciliation, ReconciliationRepositoryError>> {
    try {
      const insertData = domainReconciliationToDbInsert({
        userId: data.userId,
        accountId: data.accountId,
        name: data.name,
        beginningBalance: data.beginningBalance,
        endingBalance: data.endingBalance,
        dateStart: data.dateStart,
        dateEnd: data.dateEnd,
        status: 'draft',
      });

      const { data: result, error } = await this.supabase
        .from('reconciliations')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          data: null,
          error: new ReconciliationRepositoryError(
            error.message || 'Failed to create reconciliation',
            error
          ),
        };
      }

      const validated = validateOrThrow(ReconciliationRowSchema, result, 'ReconciliationRow');
      return {
        success: true,
        data: dbReconciliationToDomain(validated),
      };
    } catch (err) {
      reportError(
        err instanceof Error ? err : new Error(String(err)),
        'reconciliations',
        { operation: 'create' }
      );
      return {
        success: false,
        data: null,
        error: new ReconciliationRepositoryError(
          'Unexpected error creating reconciliation',
          err
        ),
      };
    }
  }

  async update(
    id: string,
    updates: UpdateReconciliationInput
  ): Promise<DataResult<Reconciliation, ReconciliationRepositoryError | ReconciliationNotFoundError>> {
    try {
      const updateData = domainReconciliationToDbUpdate(updates);

      const { error } = await this.supabase
        .from('reconciliations')
        .update(updateData)
        .eq('id', id);

      if (error) {
        return {
          success: false,
          data: null,
          error: new ReconciliationRepositoryError(
            error.message || 'Failed to update reconciliation',
            error
          ),
        };
      }

      // Fetch updated record
      return this.getById(id);
    } catch (err) {
      reportError(
        err instanceof Error ? err : new Error(String(err)),
        'reconciliations',
        { operation: 'update', id }
      );
      return {
        success: false,
        data: null,
        error: new ReconciliationRepositoryError(
          'Unexpected error updating reconciliation',
          err
        ),
      };
    }
  }

  async delete(
    id: string,
    version: number
  ): Promise<
    DataResult<
      void,
      ReconciliationRepositoryError | ReconciliationVersionConflictError | ReconciliationCompletedError
    >
  > {
    try {
      const { data, error } = await this.supabase.rpc('delete_reconciliation_with_version', {
        p_reconciliation_id: id,
        p_expected_version: version,
      });

      if (error) {
        return {
          success: false,
          data: null,
          error: new ReconciliationRepositoryError(
            error.message || 'Failed to delete reconciliation',
            error
          ),
        };
      }

      const result = data as {
        success: boolean;
        error?: string;
        currentVersion?: number;
        currentData?: Record<string, unknown>;
        message?: string;
      };

      if (!result.success) {
        // Map RPC error strings to typed errors
        if (result.error === 'version_conflict') {
          return {
            success: false,
            data: null,
            error: new ReconciliationVersionConflictError(
              `Version conflict: expected ${version}, got ${result.currentVersion}`
            ),
          };
        }
        if (result.error === 'reconciliation_completed') {
          return {
            success: false,
            data: null,
            error: new ReconciliationCompletedError(id),
          };
        }
        return {
          success: false,
          data: null,
          error: new ReconciliationRepositoryError(
            result.error || 'Failed to delete reconciliation'
          ),
        };
      }

      return { success: true, data: undefined };
    } catch (err) {
      reportError(
        err instanceof Error ? err : new Error(String(err)),
        'reconciliations',
        { operation: 'delete', id, version }
      );
      return {
        success: false,
        data: null,
        error: new ReconciliationRepositoryError(
          'Unexpected error deleting reconciliation',
          err
        ),
      };
    }
  }

  async linkTransactions(
    reconciliationId: string,
    transactionIds: string[]
  ): Promise<DataResult<LinkUnlinkResult, ReconciliationRepositoryError | ReconciliationLinkError>> {
    try {
      const { data, error } = await this.supabase.rpc('link_transactions_to_reconciliation', {
        p_reconciliation_id: reconciliationId,
        p_transaction_ids: transactionIds,
      });

      if (error) {
        return {
          success: false,
          data: null,
          error: new ReconciliationLinkError(
            error.message || 'Failed to link transactions',
            error
          ),
        };
      }

      if (!data) {
        return {
          success: false,
          data: null,
          error: new ReconciliationLinkError('No response from link operation'),
        };
      }

      const validated = validateOrThrow(LinkUnlinkRpcSchema, data, 'LinkTransactionsRpc');
      return {
        success: true,
        data: validated,
      };
    } catch (err) {
      reportError(
        err instanceof Error ? err : new Error(String(err)),
        'reconciliations',
        { operation: 'linkTransactions', reconciliationId, transactionCount: transactionIds.length }
      );
      return {
        success: false,
        data: null,
        error: new ReconciliationLinkError(
          'Unexpected error linking transactions',
          err
        ),
      };
    }
  }

  async unlinkTransactions(
    transactionIds: string[]
  ): Promise<DataResult<LinkUnlinkResult, ReconciliationRepositoryError | ReconciliationLinkError>> {
    try {
      const { data, error } = await this.supabase.rpc('unlink_transactions_from_reconciliation', {
        p_transaction_ids: transactionIds,
      });

      if (error) {
        return {
          success: false,
          data: null,
          error: new ReconciliationLinkError(
            error.message || 'Failed to unlink transactions',
            error
          ),
        };
      }

      if (!data) {
        return {
          success: false,
          data: null,
          error: new ReconciliationLinkError('No response from unlink operation'),
        };
      }

      const validated = validateOrThrow(LinkUnlinkRpcSchema, data, 'UnlinkTransactionsRpc');
      return {
        success: true,
        data: validated,
      };
    } catch (err) {
      reportError(
        err instanceof Error ? err : new Error(String(err)),
        'reconciliations',
        { operation: 'unlinkTransactions', transactionCount: transactionIds.length }
      );
      return {
        success: false,
        data: null,
        error: new ReconciliationLinkError(
          'Unexpected error unlinking transactions',
          err
        ),
      };
    }
  }

  async getSummary(
    reconciliationId: string
  ): Promise<DataResult<ReconciliationSummary, ReconciliationRepositoryError>> {
    try {
      const { data, error } = await this.supabase.rpc('get_reconciliation_summary', {
        p_reconciliation_id: reconciliationId,
      });

      if (error) {
        return {
          success: false,
          data: null,
          error: new ReconciliationRepositoryError(
            error.message || 'Failed to get reconciliation summary',
            error
          ),
        };
      }

      if (!data) {
        return {
          success: false,
          data: null,
          error: new ReconciliationRepositoryError('No summary data returned'),
        };
      }

      const validated = validateOrThrow(
        ReconciliationSummaryRpcSchema,
        data,
        'ReconciliationSummaryRpc'
      );
      return {
        success: true,
        data: dbReconciliationSummaryToDomain(validated),
      };
    } catch (err) {
      reportError(
        err instanceof Error ? err : new Error(String(err)),
        'reconciliations',
        { operation: 'getSummary', reconciliationId }
      );
      return {
        success: false,
        data: null,
        error: new ReconciliationRepositoryError(
          'Unexpected error getting reconciliation summary',
          err
        ),
      };
    }
  }
}
