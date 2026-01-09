import { createClient } from '@/lib/supabase/client';
import type { Reconciliation, ReconciliationSummary } from '@/types/domain';
import {
  dbReconciliationToDomain,
  dbReconciliationsToDomain,
  domainReconciliationToDbInsert,
  domainReconciliationToDbUpdate,
  dbReconciliationSummaryToDomain,
} from '@/lib/types/data-transformers';

export const reconciliationsApi = {
  /**
   * Get all reconciliations for current user (optionally filtered by account)
   */
  getAll: async (accountId?: string): Promise<Reconciliation[]> => {
    const supabase = createClient();

    let query = supabase
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

    return dbReconciliationsToDomain(data);
  },

  /**
   * Get single reconciliation by ID
   */
  getById: async (id: string): Promise<Reconciliation> => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('reconciliations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Failed to fetch reconciliation:', error);
      throw new Error(error.message || 'Failed to fetch reconciliation');
    }

    return dbReconciliationToDomain(data);
  },

  /**
   * Create new reconciliation
   */
  create: async (data: {
    accountId: string;
    name: string;
    beginningBalance: number;
    endingBalance: number;
    dateStart?: string | null;
    dateEnd?: string | null;
  }): Promise<Reconciliation> => {
    const supabase = createClient();

    // Get user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const insertData = domainReconciliationToDbInsert({
      userId: user.id,
      accountId: data.accountId,
      name: data.name,
      beginningBalance: data.beginningBalance,
      endingBalance: data.endingBalance,
      dateStart: data.dateStart,
      dateEnd: data.dateEnd,
      status: 'draft',
    });

    const { data: result, error } = await supabase
      .from('reconciliations')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Failed to create reconciliation:', error);
      throw new Error(error.message || 'Failed to create reconciliation');
    }

    return dbReconciliationToDomain(result);
  },

  /**
   * Update reconciliation
   */
  update: async (id: string, updates: {
    name?: string;
    beginningBalance?: number;
    endingBalance?: number;
    dateStart?: string | null;
    dateEnd?: string | null;
    status?: 'draft' | 'completed';
  }): Promise<Reconciliation> => {
    const supabase = createClient();

    const updateData = domainReconciliationToDbUpdate(updates);

    const { error } = await supabase
      .from('reconciliations')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Failed to update reconciliation:', error);
      throw new Error(error.message || 'Failed to update reconciliation');
    }

    // Fetch updated record
    return reconciliationsApi.getById(id);
  },

  /**
   * Delete reconciliation
   */
  delete: async (id: string): Promise<void> => {
    const supabase = createClient();

    const { error } = await supabase
      .from('reconciliations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete reconciliation:', error);
      throw new Error(error.message || 'Failed to delete reconciliation');
    }
  },

  /**
   * Link transactions to reconciliation (bulk)
   * Uses RPC function for atomic operation with validation
   */
  linkTransactions: async (
    reconciliationId: string,
    transactionIds: string[]
  ): Promise<{
    success: boolean;
    successCount: number;
    errorCount: number;
    errors: Array<{ transactionId: string; error: string }>;
  }> => {
    const supabase = createClient();

    const { data, error } = await supabase.rpc('link_transactions_to_reconciliation', {
      p_reconciliation_id: reconciliationId,
      p_transaction_ids: transactionIds,
    });

    if (error || !data) {
      console.error('Failed to link transactions:', error);
      throw new Error(error?.message || 'Failed to link transactions');
    }

    return data as any;
  },

  /**
   * Unlink transactions from reconciliation (bulk)
   * Uses RPC function for atomic operation with validation
   */
  unlinkTransactions: async (
    transactionIds: string[]
  ): Promise<{
    success: boolean;
    successCount: number;
    errorCount: number;
    errors: Array<{ transactionId: string; error: string }>;
  }> => {
    const supabase = createClient();

    const { data, error } = await supabase.rpc('unlink_transactions_from_reconciliation', {
      p_transaction_ids: transactionIds,
    });

    if (error || !data) {
      console.error('Failed to unlink transactions:', error);
      throw new Error(error?.message || 'Failed to unlink transactions');
    }

    return data as any;
  },

  /**
   * Get reconciliation summary (real-time math)
   * Formula: Difference = Ending Balance - (Beginning Balance + Linked Sum)
   */
  getSummary: async (reconciliationId: string): Promise<ReconciliationSummary> => {
    const supabase = createClient();

    const { data, error } = await supabase.rpc('get_reconciliation_summary', {
      p_reconciliation_id: reconciliationId,
    });

    if (error || !data) {
      console.error('Failed to get reconciliation summary:', error);
      throw new Error(error?.message || 'Failed to get reconciliation summary');
    }

    return dbReconciliationSummaryToDomain(data);
  },
};
