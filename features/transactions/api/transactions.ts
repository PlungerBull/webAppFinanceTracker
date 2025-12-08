import { createClient } from '@/lib/supabase/client';
import { TRANSACTIONS } from '@/lib/constants';
import type { CreateTransactionFormData, UpdateTransactionFormData } from '../schemas/transaction.schema';
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

  // Create a new transaction
  create: async (transactionData: CreateTransactionFormData): Promise<Transaction> => {
    const supabase = createClient();

    // Get user for user_id (no DB default exists yet)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error(TRANSACTIONS.API.ERRORS.USER_NOT_AUTHENTICATED);
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        description: transactionData.description || null,
        amount_original: transactionData.amount_original,
        // ✅ amount_home is automatically calculated by database trigger
        // Passing 0 as placeholder - trigger will override with correct value
        amount_home: 0,
        date: transactionData.date,
        category_id: transactionData.category_id || null,
        account_id: transactionData.account_id,
        currency_original: transactionData.currency_original,
        exchange_rate: transactionData.exchange_rate,
        notes: transactionData.notes || null, // ✅ Capture notes
      })
      .select()
      .single();

    if (error) {
      console.error(TRANSACTIONS.API.CONSOLE.CREATE_TRANSACTION, error);
      throw new Error(error.message || TRANSACTIONS.API.ERRORS.CREATE_FAILED);
    }

    // Transform snake_case to camelCase before returning to frontend
    return dbTransactionToDomain(data);
  },

  // Update an existing transaction (RLS handles user filtering)
  update: async (id: string, transactionData: UpdateTransactionFormData): Promise<Transaction> => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('transactions')
      .update(transactionData) // amount_home will be recalculated by trigger if needed
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(TRANSACTIONS.API.CONSOLE.UPDATE_TRANSACTION, error);
      throw new Error(error.message || TRANSACTIONS.API.ERRORS.UPDATE_FAILED);
    }

    // Transform snake_case to camelCase before returning to frontend
    return dbTransactionToDomain(data);
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