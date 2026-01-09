import { createClient } from '@/lib/supabase/client';
import { TRANSACTIONS } from '@/lib/constants';
import type {
  CreateTransactionFormData,
  CreateTransactionLedgerData,
  UpdateTransactionFormData
} from '../schemas/transaction.schema';
import type { TransactionView, Transaction } from '@/types/domain';
import {
  dbTransactionViewToDomain,
  dbTransactionViewsToDomain,
  dbTransactionToDomain,
  domainTransactionToDbUpdate,
} from '@/lib/types/data-transformers';
import { applyTransactionFilters, type TransactionFilters } from './filters';

export const transactionsApi = {
  // Get all transactions with pagination for infinite scroll
  getAllPaginated: async (
    filters?: TransactionFilters,
    pagination?: {
      offset: number;
      limit: number;
    }
  ): Promise<{ data: TransactionView[]; count: number | null }> => {
    const supabase = createClient();
    const { offset = 0, limit = 50 } = pagination || {};
    const sortBy = filters?.sortBy || 'date'; // Default to Financial Ledger

    let query = supabase
      .from('transactions_view')
      .select('*', { count: 'exact' })
      // Primary sort by selected field (date or created_at)
      .order(
        sortBy === 'date' ? 'date' : 'created_at',
        { ascending: false }
      )
      // Tie-breaker: Always add created_at DESC for deterministic ordering
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply all standard filters (centralized)
    query = applyTransactionFilters(query, filters);

    const { data, error, count } = await query;

    if (error) {
      console.error(TRANSACTIONS.API.CONSOLE.FETCH_TRANSACTIONS, error);
      throw new Error(error.message || TRANSACTIONS.API.ERRORS.FETCH_ALL_FAILED);
    }

    return {
      data: data ? dbTransactionViewsToDomain(data) : [],
      count,
    };
  },

  // Get a single transaction by ID (RLS handles user filtering)
  getById: async (id: string): Promise<TransactionView> => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('transactions_view')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error(TRANSACTIONS.API.CONSOLE.FETCH_TRANSACTION, error);
      throw new Error(error.message || TRANSACTIONS.API.ERRORS.FETCH_ONE_FAILED);
    }

    // Transform snake_case to camelCase before returning to frontend
    return dbTransactionViewToDomain(data);
  },

  // Create a new transaction in the ledger
  // IMPORTANT: This function requires COMPLETE data that matches database constraints.
  // Use CreateTransactionLedgerData type - TypeScript enforces required fields at compile time.
  // For incomplete/draft transactions, route to the inbox instead.
  create: async (transactionData: CreateTransactionLedgerData): Promise<TransactionView> => {
    const supabase = createClient();

    // Get user for user_id (no DB default exists yet)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error(TRANSACTIONS.API.ERRORS.USER_NOT_AUTHENTICATED);
    }

    // TypeScript guarantees these fields are present due to CreateTransactionLedgerData type
    // No runtime checks needed - compilation will fail if required fields are missing
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        description: transactionData.description || null,
        amount_original: transactionData.amount_original,
        // ✅ SACRED LEDGER: amount_home is system-managed (DEFAULT 0, trigger overwrites)
        // Field is OMITTED - calculate_amount_home trigger sets correct value before INSERT completes
        date: transactionData.date,
        category_id: transactionData.category_id || null,
        account_id: transactionData.account_id, // ✅ Guaranteed non-null by type
        // ✅ SACRED LEDGER: currency_original is system-managed (DEFAULT 'PENDING', trigger overwrites)
        // Field is OMITTED - enforce_sacred_ledger_currency trigger sets correct value before INSERT completes
        exchange_rate: transactionData.exchange_rate,
        notes: transactionData.notes || null, // ✅ Capture notes
      })
      .select()
      .single();

    if (error) {
      console.error(TRANSACTIONS.API.CONSOLE.CREATE_TRANSACTION, error);
      throw new Error(error.message || TRANSACTIONS.API.ERRORS.CREATE_FAILED);
    }

    // Write-then-Read: Fetch from view to get complete data with currency
    // Raw table row lacks currency_original - must query transactions_view for complete object
    return transactionsApi.getById(data.id);
  },

  // Update an existing transaction (RLS handles user filtering)
  update: async (id: string, transactionData: UpdateTransactionFormData): Promise<TransactionView> => {
    const supabase = createClient();

    const { error } = await supabase
      .from('transactions')
      .update(transactionData) // amount_home will be recalculated by trigger if needed
      .eq('id', id);

    if (error) {
      console.error(TRANSACTIONS.API.CONSOLE.UPDATE_TRANSACTION, error);
      throw new Error(error.message || TRANSACTIONS.API.ERRORS.UPDATE_FAILED);
    }

    // Write-then-Read: Fetch from view to get complete data with currency
    // Raw table row lacks currency_original - must query transactions_view for complete object
    return transactionsApi.getById(id);
  },

  // Batch update transaction fields (used by unified detail panel)
  // Accepts EditedFields from the panel and transforms to database format
  updateBatch: async (
    id: string,
    updates: {
      description?: string;
      amountOriginal?: number;
      accountId?: string;
      categoryId?: string;
      date?: string;
      notes?: string;
      exchangeRate?: number;
    }
  ): Promise<TransactionView> => {
    const supabase = createClient();

    // Use centralized transformer for type-safe field mapping
    const dbUpdates = domainTransactionToDbUpdate(updates);

    const { error } = await supabase
      .from('transactions')
      .update(dbUpdates)
      .eq('id', id);

    if (error) {
      console.error(TRANSACTIONS.API.CONSOLE.UPDATE_TRANSACTION, error);
      throw new Error(error.message || TRANSACTIONS.API.ERRORS.UPDATE_FAILED);
    }

    // Write-then-Read: Fetch from view to get complete data with currency
    // Raw table row lacks currency_original - must query transactions_view for complete object
    return transactionsApi.getById(id);
  },

  // Delete a transaction (RLS handles user filtering)
  delete: async (id: string) => {
    const supabase = createClient();

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(TRANSACTIONS.API.CONSOLE.DELETE_TRANSACTION, error);
      throw new Error(error.message || TRANSACTIONS.API.ERRORS.DELETE_FAILED);
    }
  },

  // Bulk update multiple transactions
  // Uses RPC function for atomic operation with validation
  bulkUpdate: async (
    transactionIds: string[],
    updates: {
      categoryId?: string;
      accountId?: string;
      date?: string;
      notes?: string;
    }
  ): Promise<{
    success: boolean;
    successCount: number;
    errorCount: number;
    updatedIds: string[];
    errors: Array<{ transactionId: string; error: string }>;
  }> => {
    const supabase = createClient();

    // Transform camelCase to RPC JSON format (stays camelCase for JSON)
    const rpcUpdates: Record<string, unknown> = {};
    if (updates.categoryId !== undefined) rpcUpdates.categoryId = updates.categoryId;
    if (updates.accountId !== undefined) rpcUpdates.accountId = updates.accountId;
    if (updates.date !== undefined) rpcUpdates.date = updates.date;
    if (updates.notes !== undefined) rpcUpdates.notes = updates.notes;

    const { data, error } = await supabase.rpc('bulk_update_transactions', {
      p_transaction_ids: transactionIds,
      p_updates: rpcUpdates as any, // Cast to any since JSONB type is complex
    });

    if (error || !data) {
      console.error('Bulk update failed:', error);
      throw new Error(error?.message || 'Failed to update transactions');
    }

    // Cast data as our expected response type (JSONB from Postgres)
    const result = data as unknown as {
      success: boolean;
      successCount: number;
      errorCount: number;
      updatedIds: string[];
      errors: Array<{ transactionId: string; error: string }>;
    };

    return result;
  },

  // Get category counts for filtered transactions (server-side aggregation)
  // Used for filter dropdown to show accurate counts even with pagination
  getCategoryCounts: async (filters?: TransactionFilters): Promise<Record<string, number>> => {
    const supabase = createClient();

    // Build query with same filters as main query
    let query = supabase
      .from('transactions_view')
      .select('category_id');

    // Apply standard filters (centralized)
    query = applyTransactionFilters(query, filters);

    const { data, error } = await query;

    if (error) {
      console.error(TRANSACTIONS.API.CONSOLE.FETCH_TRANSACTIONS, error);
      throw new Error(error.message || TRANSACTIONS.API.ERRORS.FETCH_ALL_FAILED);
    }

    // Count transactions per category
    const counts: Record<string, number> = {};
    data?.forEach((row) => {
      const categoryId = row.category_id;
      if (categoryId) {
        counts[categoryId] = (counts[categoryId] || 0) + 1;
      }
    });

    return counts;
  },
};