import type { SupabaseClient } from '@supabase/supabase-js';
import type { IAuthProvider } from '@/lib/auth/auth-provider.interface';
import { createSupabaseAuthProvider } from '@/lib/auth/supabase-auth-provider';
import type { Reconciliation, ReconciliationSummary } from '@/types/domain';
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

export class ReconciliationsService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly authProvider: IAuthProvider
  ) {}

  private async getCurrentUserId(): Promise<string> {
    return this.authProvider.getCurrentUserId();
  }

  /**
   * Get all reconciliations for current user (optionally filtered by account)
   */
  async getAll(accountId?: string): Promise<Reconciliation[]> {
    let query = this.supabase
      .from('reconciliations')
      .select('*')
      .order('created_at', { ascending: false });

    if (accountId) {
      query = query.eq('account_id', accountId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch reconciliations:', error);
      throw new Error(error.message || 'Failed to fetch reconciliations');
    }

    const validated = validateArrayOrThrow(ReconciliationRowSchema, data, 'ReconciliationRow');
    return dbReconciliationsToDomain(validated);
  }

  /**
   * Get single reconciliation by ID
   */
  async getById(id: string): Promise<Reconciliation> {
    const { data, error } = await this.supabase
      .from('reconciliations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Failed to fetch reconciliation:', error);
      throw new Error(error.message || 'Failed to fetch reconciliation');
    }

    const validated = validateOrThrow(ReconciliationRowSchema, data, 'ReconciliationRow');
    return dbReconciliationToDomain(validated);
  }

  /**
   * Create new reconciliation
   */
  async create(data: {
    accountId: string;
    name: string;
    beginningBalance: number;
    endingBalance: number;
    dateStart?: string | null;
    dateEnd?: string | null;
  }): Promise<Reconciliation> {
    const userId = await this.getCurrentUserId();

    const insertData = domainReconciliationToDbInsert({
      userId,
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
      console.error('Failed to create reconciliation:', error);
      throw new Error(error.message || 'Failed to create reconciliation');
    }

    const validated = validateOrThrow(ReconciliationRowSchema, result, 'ReconciliationRow');
    return dbReconciliationToDomain(validated);
  }

  /**
   * Update reconciliation
   */
  async update(id: string, updates: {
    name?: string;
    beginningBalance?: number;
    endingBalance?: number;
    dateStart?: string | null;
    dateEnd?: string | null;
    status?: 'draft' | 'completed';
  }): Promise<Reconciliation> {
    const updateData = domainReconciliationToDbUpdate(updates);

    const { error } = await this.supabase
      .from('reconciliations')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Failed to update reconciliation:', error);
      throw new Error(error.message || 'Failed to update reconciliation');
    }

    // Fetch updated record
    return this.getById(id);
  }

  /**
   * Delete reconciliation
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('reconciliations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete reconciliation:', error);
      throw new Error(error.message || 'Failed to delete reconciliation');
    }
  }

  /**
   * Link transactions to reconciliation (bulk)
   * Uses RPC function for atomic operation with validation
   */
  async linkTransactions(
    reconciliationId: string,
    transactionIds: string[]
  ): Promise<{
    success: boolean;
    successCount: number;
    errorCount: number;
    errors: Array<{ transactionId: string; error: string }>;
  }> {
    const { data, error } = await this.supabase.rpc('link_transactions_to_reconciliation', {
      p_reconciliation_id: reconciliationId,
      p_transaction_ids: transactionIds,
    });

    if (error || !data) {
      console.error('Failed to link transactions:', error);
      throw new Error(error?.message || 'Failed to link transactions');
    }

    return validateOrThrow(LinkUnlinkRpcSchema, data, 'LinkTransactionsRpc');
  }

  /**
   * Unlink transactions from reconciliation (bulk)
   * Uses RPC function for atomic operation with validation
   */
  async unlinkTransactions(
    transactionIds: string[]
  ): Promise<{
    success: boolean;
    successCount: number;
    errorCount: number;
    errors: Array<{ transactionId: string; error: string }>;
  }> {
    const { data, error } = await this.supabase.rpc('unlink_transactions_from_reconciliation', {
      p_transaction_ids: transactionIds,
    });

    if (error || !data) {
      console.error('Failed to unlink transactions:', error);
      throw new Error(error?.message || 'Failed to unlink transactions');
    }

    return validateOrThrow(LinkUnlinkRpcSchema, data, 'UnlinkTransactionsRpc');
  }

  /**
   * Get reconciliation summary (real-time math)
   * Formula: Difference = Ending Balance - (Beginning Balance + Linked Sum)
   */
  async getSummary(reconciliationId: string): Promise<ReconciliationSummary> {
    const { data, error } = await this.supabase.rpc('get_reconciliation_summary', {
      p_reconciliation_id: reconciliationId,
    });

    if (error || !data) {
      console.error('Failed to get reconciliation summary:', error);
      throw new Error(error?.message || 'Failed to get reconciliation summary');
    }

    const validated = validateOrThrow(ReconciliationSummaryRpcSchema, data, 'ReconciliationSummaryRpc');
    return dbReconciliationSummaryToDomain(validated);
  }
}

/**
 * Factory function to create ReconciliationsService with proper DI.
 */
export function createReconciliationsService(supabase: SupabaseClient): ReconciliationsService {
  const authProvider = createSupabaseAuthProvider(supabase);
  return new ReconciliationsService(supabase, authProvider);
}
