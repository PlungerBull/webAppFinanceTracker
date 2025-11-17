import { createClient } from '@/lib/supabase/client';
import type { CreateTransactionFormData, UpdateTransactionFormData } from '../schemas/transaction.schema';

export const transactionsApi = {
  // Get all transactions for the current user (RLS handles user filtering)
  getAll: async () => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        category:categories(id, name, icon, color),
        account:bank_accounts(id, name)
      `)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
      throw new Error(error.message || 'Failed to fetch transactions');
    }

    return data;
  },

  // Get a single transaction by ID (RLS handles user filtering)
  getById: async (id: string) => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        category:categories(id, name, icon, color),
        account:bank_accounts(id, name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching transaction:', error);
      throw new Error(error.message || 'Failed to fetch transaction');
    }

    return data;
  },

  // Create a new transaction
  create: async (transactionData: CreateTransactionFormData) => {
    const supabase = createClient();

    // Get user for user_id (no DB default exists yet)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
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
      console.error('Error creating transaction:', error);
      throw new Error(error.message || 'Failed to create transaction');
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
      console.error('Error updating transaction:', error);
      throw new Error(error.message || 'Failed to update transaction');
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
      console.error('Error deleting transaction:', error);
      throw new Error(error.message || 'Failed to delete transaction');
    }
  },
};