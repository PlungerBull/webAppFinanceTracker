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
} from '@/lib/types/data-transformers';

export const transactionsApi = {
  // Get all transactions for the current user (RLS handles user filtering)
  getAll: async (filters?: {
    categoryId?: string;
    accountId?: string;
    categoryIds?: string[];
    searchQuery?: string;
    date?: Date | string;
  }): Promise<TransactionView[]> => {
    const supabase = createClient();

    let query = supabase
      .from('transactions_view')
      .select('*')
      .order('date', { ascending: false });

    // Apply category filter (single category)
    if (filters?.categoryId) {
      query = query.eq('category_id', filters.categoryId);
    }

    // Apply account filter
    if (filters?.accountId) {
      query = query.eq('account_id', filters.accountId);
    }

    // Apply category IDs filter (multiple categories, e.g., for grouping)
    if (filters?.categoryIds && filters.categoryIds.length > 0) {
      query = query.in('category_id', filters.categoryIds);
    }

    // Apply search filter (description)
    if (filters?.searchQuery) {
      query = query.ilike('description', `%${filters.searchQuery}%`);
    }

    // Apply date filter
    if (filters?.date) {
      // Ensure date is formatted as YYYY-MM-DD
      const dateStr = filters.date instanceof Date
        ? filters.date.toISOString().split('T')[0]
        : filters.date.split('T')[0];

      query = query.eq('date', dateStr);
    }

    const { data, error } = await query;

    if (error) {
      console.error(TRANSACTIONS.API.CONSOLE.FETCH_TRANSACTIONS, error);
      throw new Error(error.message || TRANSACTIONS.API.ERRORS.FETCH_ALL_FAILED);
    }

    // Transform snake_case to camelCase before returning to frontend
    return data ? dbTransactionViewsToDomain(data) : [];
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
      amount?: number;
      accountId?: string;
      categoryId?: string;
      date?: string;
      notes?: string;
      exchangeRate?: number;
    }
  ): Promise<TransactionView> => {
    const supabase = createClient();

    // Transform camelCase panel fields to snake_case database fields
    const dbUpdates: Record<string, unknown> = {};

    if (updates.description !== undefined) {
      dbUpdates.description = updates.description;
    }
    if (updates.amount !== undefined) {
      dbUpdates.amount_original = updates.amount;
    }
    if (updates.accountId !== undefined) {
      dbUpdates.account_id = updates.accountId;
    }
    if (updates.categoryId !== undefined) {
      dbUpdates.category_id = updates.categoryId;
    }
    if (updates.date !== undefined) {
      dbUpdates.date = updates.date;
    }
    if (updates.notes !== undefined) {
      dbUpdates.notes = updates.notes;
    }
    if (updates.exchangeRate !== undefined) {
      dbUpdates.exchange_rate = updates.exchangeRate;
    }

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
};