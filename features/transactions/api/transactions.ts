import { createClient } from '@/lib/supabase/client';
import { TRANSACTIONS } from '@/lib/constants';
import type { CreateTransactionFormData, UpdateTransactionFormData } from '../schemas/transaction.schema';

export const transactionsApi = {
  // Get all transactions for the current user (RLS handles user filtering)
  getAll: async (filters?: { categoryId?: string }) => {
    const supabase = createClient();

    let query = supabase
      .from('transactions_view')
      .select('*')
      .order('date', { ascending: false });

    if (filters?.categoryId) {
      query = query.eq('category_id', filters.categoryId);
    }

    const { data, error } = await query;

    if (error) {
      console.error(TRANSACTIONS.API.CONSOLE.FETCH_TRANSACTIONS, error);
      throw new Error(error.message || TRANSACTIONS.API.ERRORS.FETCH_ALL_FAILED);
    }

    return data;
  },

  // Get a single transaction by ID (RLS handles user filtering)
  getById: async (id: string) => {
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

    return data;
  },

  // Create a new transaction
  create: async (transactionData: CreateTransactionFormData) => {
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
      })
      .select()
      .single();

    if (error) {
      console.error(TRANSACTIONS.API.CONSOLE.CREATE_TRANSACTION, error);
      throw new Error(error.message || TRANSACTIONS.API.ERRORS.CREATE_FAILED);
    }

    return data;
  },

  // Update an existing transaction (RLS handles user filtering)
  update: async (id: string, transactionData: UpdateTransactionFormData) => {
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

    return data;
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