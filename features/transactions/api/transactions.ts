import { createClient } from '@/lib/supabase/client';
import type { CreateTransactionFormData, UpdateTransactionFormData } from '../schemas/transaction.schema';

export const transactionsApi = {
  // Get all transactions for the current user
  getAll: async () => {
    const supabase = createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        category:categories(id, name, icon, color),
        account:bank_accounts(id, name)
      `)
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
      throw new Error(error.message || 'Failed to fetch transactions');
    }

    return data;
  },

  // Get a single transaction by ID
  getById: async (id: string) => {
    const supabase = createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        category:categories(id, name, icon, color),
        account:bank_accounts(id, name)
      `)
      .eq('id', id)
      .eq('user_id', user.id)
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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        description: transactionData.description || null,
        amount_original: transactionData.amount_original,
        // ✅ amount_home is now automatically calculated by database trigger
        // No need to pass it - the calculate_amount_home() function handles it
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

  // Update an existing transaction
  update: async (id: string, transactionData: UpdateTransactionFormData) => {
    const supabase = createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('transactions')
      .update(transactionData) // amount_home will be recalculated by trigger if needed
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating transaction:', error);
      throw new Error(error.message || 'Failed to update transaction');
    }

    return data;
  },

  // Delete a transaction
  delete: async (id: string) => {
    const supabase = createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting transaction:', error);
      throw new Error(error.message || 'Failed to delete transaction');
    }
  },
};